<?php

namespace App\Jobs;

use App\Models\EmployeeMasterlist;
use App\Models\VPLog;
use App\Services\LeaveService;
use App\Services\VipLogsService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ExportManagementLogs implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;
    public int $tries   = 2;

    private const REMARK_COLORS = [
        'Present'            => ['FFC6EFCE', 'FF375623'],
        'On Leave'           => ['FFDAEEF3', 'FF17375E'],
        'On Leave (Present)' => ['FFE4DFEC', 'FF403151'],
        'Rest Day'           => ['FFF2F2F2', 'FF7F7F7F'],
        'Absent'             => ['FFFFC7CE', 'FF9C0006'],
        'Pending'            => ['FFDDEBF7', 'FF1F4E79'],
    ];

    public function __construct(
        private string $jobId,
        private string $dateFrom,
        private string $dateTo,
    ) {}

    public function handle(VipLogsService $vipLogsService, LeaveService $leaveService): void
    {
        ini_set('memory_limit', '256M');
        $this->updateProgress(5, 'Loading employees...');

        // ── 1. Employees ──────────────────────────────────────────────────
        $vips      = $vipLogsService->getVipEmployees(includeMedical: true);
        $empIds    = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();
        $empIndex  = $vips->keyBy('employee_id')->toArray();

        $this->updateProgress(15, 'Loading schedules...');

        // ── 2. employeeExpectedDates (same logic as controller index) ─────
        $schedulerRecords = \App\Models\WorkScheduler::whereIn('EMPID', $empIds)
            ->orderBy('PAYROLL_DATE_START', 'asc')
            ->get(['EMPID', 'PAYROLL_DATE_START', 'PAYROLL_DATE_END', 'SCHEDULE', 'SHIFT'])
            ->groupBy(fn($row) => (string) $row->EMPID)
            ->map(fn($rows) => $rows->map(fn($row) => [
                'payroll_date_start' => $row->PAYROLL_DATE_START?->format('Y-m-d'),
                'payroll_date_end'   => $row->PAYROLL_DATE_END?->format('Y-m-d'),
                'schedule'           => $row->SCHEDULE ?? null,
                'shift_field'        => (int) ($row->SHIFT ?? 0),
            ])->values()->all())
            ->all();

        $allShiftIds = collect($schedulerRecords)
            ->flatMap(fn($records) => collect($records)
                ->flatMap(fn($record) => is_array($record['schedule'])
                    ? array_values($record['schedule'])
                    : []
                )
            )
            ->unique()->filter()->values()->toArray();

        $shiftCodeMap = \App\Models\ShiftCode::whereIn('SHIFT_CODE_ID', $allShiftIds)
            ->get(['SHIFT_CODE_ID', 'SHIFTCODE', 'TIME_WINDOWS'])
            ->keyBy(fn($sc) => (string) $sc->SHIFT_CODE_ID)
            ->map(fn($sc) => [
                'shiftcode'    => $sc->SHIFTCODE,
                'time_windows' => [
                    'check_in'  => $sc->TIME_WINDOWS[0] ?? null,
                    'check_out' => $sc->TIME_WINDOWS[5] ?? null,
                ],
            ])
            ->toArray();

        $employeeExpectedDates = [];
        foreach ($schedulerRecords as $empId => $records) {
            foreach ($records as $record) {
                if (empty($record['schedule']) || !is_array($record['schedule'])) continue;
                if (!$record['payroll_date_start']) continue;
                $payrollStart = Carbon::parse($record['payroll_date_start']);
                foreach ($record['schedule'] as $dayNo => $shiftId) {
                    $schedDate = (clone $payrollStart)->addDays((int) $dayNo - 1);
                    $dateStr   = $schedDate->format('Y-m-d');
                    $shiftInfo = $shiftCodeMap[(string) $shiftId] ?? null;
                    $shiftCode = $shiftInfo ? strtoupper($shiftInfo['shiftcode']) : '';
                    if (!str_contains($shiftCode, 'RD')) {
                        $tw      = $shiftInfo['time_windows'] ?? [];
                        $checkIn  = $tw['check_in']  ?? null;
                        $checkOut = $tw['check_out'] ?? null;
                        $isNight  = false;
                        if ($checkIn && $checkOut) {
                            $inHour  = (int) explode(':', $checkIn)[0];
                            $outHour = (int) explode(':', $checkOut)[0];
                            $isNight = $outHour <= $inHour;
                        }
                        $employeeExpectedDates[$empId][$dateStr] = [
                            'shiftcode' => $shiftCode,
                            'is_night'  => $isNight,
                        ];
                    }
                }
            }
        }

        $this->updateProgress(30, 'Loading leaves...');

        // ── 3. Leaves ─────────────────────────────────────────────────────
        $leavesCollection = $leaveService->getApprovedLeaves($empIds, $this->dateFrom, $this->dateTo);
        // leaveSet[empId][date] = true
        $leaveSet = [];
        foreach ($leavesCollection as $leave) {
            $eid = (string) $leave['EMPLOYID'];
            foreach (($leave['ALL_DATES'] ?? []) as $d) {
                $leaveSet[$eid][$d] = true;
            }
        }

$this->updateProgress(40, 'Loading logs...');

// Fetch one extra day before and after for night-shift boundary logs
$fetchFrom = Carbon::parse($this->dateFrom)->subDay()->format('Y-m-d');
$fetchTo   = Carbon::parse($this->dateTo)->addDay()->format('Y-m-d');
$rawLogs   = $vipLogsService->getVipLogs($empIds, $fetchFrom, $fetchTo);

// ── Index all logs by employee, then sort chronologically ─────────────────
// allLogs[empId] = [ ['datetime'=>'Y-m-d H:i:s', 'type'=>'check_in'], ... ]
$allLogs = [];
foreach ($rawLogs as $log) {
    $eid      = (string) $log['employee_id'];
    $date     = is_string($log['log_date'])
        ? substr($log['log_date'], 0, 10)
        : Carbon::parse($log['log_date'])->format('Y-m-d');
    $time     = is_string($log['log_time'])
        ? substr($log['log_time'], 0, 8)
        : Carbon::parse($log['log_time'])->format('H:i:s');
    $datetime = $date . ' ' . $time;

    $allLogs[$eid][] = [
        'datetime' => $datetime,
        'date'     => $date,
        'time'     => $time,
        'hour'     => (int) substr($time, 0, 2),
        'type'     => $log['log_type'],
    ];
}

// Sort each employee's logs chronologically
foreach ($allLogs as $eid => &$empLogs) {
    usort($empLogs, fn($a, $b) => strcmp($a['datetime'], $b['datetime']));
}
unset($empLogs);

// ── Build logSlots by pairing each check_in with the next check_out ───────
// Strategy:
//   1. Walk the sorted log list for each employee
//   2. When we see a check_in at hour >= 18 (night shift start), the ANCHOR
//      date is that log's date
//   3. The next check_out that occurs before 14:00 belongs to that anchor date
//   4. For day shifts (check_in before 18:00), anchor = same date,
//      check_out = next check_out on the same date
// logSlots[empId][anchorDate] = ['check_in' => 'H:i:s', 'check_out' => 'H:i:s']
$logSlots = [];

foreach ($allLogs as $eid => $empLogs) {
    $pendingNightAnchor = null; // date of the open night shift waiting for check_out

    foreach ($empLogs as $log) {
        $date = $log['date'];
        $time = $log['time'];
        $hour = $log['hour'];
        $type = $log['type'];

        if ($type === 'check_in') {
            if ($hour >= 18) {
                // Night shift check_in — open a new night anchor
                // Only open if we don't already have a check_in for this date
                if (!isset($logSlots[$eid][$date]['check_in'])) {
                    $logSlots[$eid][$date]['check_in'] = $time;
                }
                $pendingNightAnchor = $date;
            } else {
                // Day shift check_in — anchor to same date
                if (!isset($logSlots[$eid][$date]['check_in'])) {
                    $logSlots[$eid][$date]['check_in'] = $time;
                }
                // Don't override a pending night anchor with a day check_in
            }

        } elseif ($type === 'check_out') {
            if ($hour < 14 && $pendingNightAnchor !== null) {
                // Early morning check_out — belongs to the pending night shift
                $anchor = $pendingNightAnchor;
                if (
                    !isset($logSlots[$eid][$anchor]['check_out']) ||
                    $time > $logSlots[$eid][$anchor]['check_out']
                ) {
                    $logSlots[$eid][$anchor]['check_out'] = $time;
                }
                // Night shift is now closed
                $pendingNightAnchor = null;

            } elseif ($hour >= 18 && $pendingNightAnchor !== null) {
                // Late check_out while a night shift is still open — bad tap, ignore
                // (real check_out should be early morning next day)

            } else {
                // Day shift check_out or night check_out with no open anchor
                // Assign to the same date
                if (
                    !isset($logSlots[$eid][$date]['check_out']) ||
                    $time > $logSlots[$eid][$date]['check_out']
                ) {
                    $logSlots[$eid][$date]['check_out'] = $time;
                }
            }
        }
    }
}
        $this->updateProgress(55, 'Writing file...');

        // ── 5. Build date list ────────────────────────────────────────────
        $dates    = [];
        $dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $cur      = strtotime($this->dateFrom);
        $endTs    = strtotime($this->dateTo);
        while ($cur <= $endTs) {
            $dates[] = date('Y-m-d', $cur);
            $cur    += 86400;
        }

        $today = date('Y-m-d');

        // ── 6. Write XLSX ─────────────────────────────────────────────────
        $filename = "mgmt_dtr_{$this->dateFrom}_to_{$this->dateTo}_{$this->jobId}.xlsx";
        $dir      = storage_path('app/exports');
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $path = $dir . '/' . $filename;

        $headers    = ['Employee ID', 'Employee Name', 'Date', 'Day', 'Time In', 'Time Out', 'Remarks'];
        $colWidths  = [12, 32, 12, 6, 10, 10, 14];
        $stylesXml  = $this->buildStylesXml();
        $styleIdxMap = $this->styleIdxMap();

        $legends = array_map(
            fn($remark) => ['label' => $remark, 'key' => $remark],
            array_keys(self::REMARK_COLORS)
        );

        $sheetTmp = tempnam(sys_get_temp_dir(), 'mgmt_sheet_');
        $fh       = fopen($sheetTmp, 'wb');

        fwrite($fh, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
        fwrite($fh, '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
                  . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
        fwrite($fh, '<sheetViews><sheetView tabSelected="1" workbookViewId="0">'
                  . '<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>'
                  . '</sheetView></sheetViews>');

        fwrite($fh, '<cols>');
        foreach ($colWidths as $i => $w) {
            $col = $i + 1;
            fwrite($fh, "<col min=\"{$col}\" max=\"{$col}\" width=\"{$w}\" customWidth=\"1\"/>");
        }
        fwrite($fh, '</cols><sheetData>');

        // Row 1: legend
        fwrite($fh, '<row r="1">');
        fwrite($fh, "<c r=\"A1\" s=\"1\" t=\"inlineStr\"><is><t>Legend:</t></is></c>");
        foreach ($legends as $li => $legend) {
            $col         = $this->colLetter($li + 1);
            $legendStyle = $styleIdxMap[$legend['key']] ?? 0;
            $labelEsc    = htmlspecialchars($legend['label'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
            fwrite($fh, "<c r=\"{$col}1\" s=\"{$legendStyle}\" t=\"inlineStr\"><is><t>{$labelEsc}</t></is></c>");
        }
        fwrite($fh, '</row>');

        // Row 2: blank separator
        fwrite($fh, '<row r="2">');
        for ($ci = 0; $ci < count($headers); $ci++) {
            $col = $this->colLetter($ci);
            fwrite($fh, "<c r=\"{$col}2\" s=\"0\" t=\"inlineStr\"><is><t></t></is></c>");
        }
        fwrite($fh, '</row>');

        // Row 3: headers
        fwrite($fh, '<row r="3">');
        foreach ($headers as $ci => $h) {
            $col = $this->colLetter($ci);
            $val = htmlspecialchars($h, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            fwrite($fh, "<c r=\"{$col}3\" s=\"1\" t=\"inlineStr\"><is><t>{$val}</t></is></c>");
        }
        fwrite($fh, '</row>');

        $rowNum  = 4;
        $written = 0;
        $total   = count($empIds) * count($dates);
        $done    = 0;

        foreach ($empIds as $empId) {
            foreach ($dates as $date) {
                $done++;
                if ($done % 200 === 0) {
                    $pct = (int) min(95, 55 + ($done / max(1, $total)) * 40);
                    $this->updateProgress($pct, "Writing rows ({$done}/{$total})...");
                }

                $slots    = $logSlots[$empId][$date] ?? [];
                $timeIn  = !empty($slots['check_in'])  ? Carbon::parse($slots['check_in'])->format('h:i A')  : null;
                $timeOut = !empty($slots['check_out']) ? Carbon::parse($slots['check_out'])->format('h:i A') : null;
                $dayName  = $dayNames[(int) date('w', strtotime($date))];
                $isOnLeave = isset($leaveSet[$empId][$date]);
                $isRestDay = !isset($employeeExpectedDates[$empId][$date]);
                $isFuture  = $date > $today;

                $remarks = $this->resolveRemarks(
                    $timeIn, $isOnLeave, $isRestDay, $isFuture,
                    $employeeExpectedDates[$empId][$date] ?? null
                );

                $s = $styleIdxMap[$remarks] ?? 0;

                $formattedDate = Carbon::parse($date)->format('m/d/Y');
                $emp           = $empIndex[$empId] ?? null;

                $vals = [
                    $empId,
                    $emp['name']     ?? '',
                    $formattedDate,
                    $dayName,
                    $timeIn  ?? '-',
                    $timeOut ?? '-',
                    $remarks,
                ];

                fwrite($fh, "<row r=\"{$rowNum}\">");
                foreach ($vals as $ci => $val) {
                    $col = $this->colLetter($ci);
                    $esc = htmlspecialchars((string) $val, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                    fwrite($fh, "<c r=\"{$col}{$rowNum}\" s=\"{$s}\" t=\"inlineStr\"><is><t>{$esc}</t></is></c>");
                }
                fwrite($fh, '</row>');
                $rowNum++;
                $written++;
            }
        }

        fwrite($fh, '</sheetData></worksheet>');
        fclose($fh);

        if (file_exists($path)) unlink($path);
        $zip = new \ZipArchive();
        $zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml',        $this->contentTypesXml());
        $zip->addFromString('_rels/.rels',                $this->relsXml());
        $zip->addFromString('xl/workbook.xml',            $this->workbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRelsXml());
        $zip->addFromString('xl/styles.xml',              $stylesXml);
        $sheetContent = file_get_contents($sheetTmp);
        @unlink($sheetTmp);
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetContent);
        $zip->close();

        Cache::put("mgmt_export_{$this->jobId}", [
            'status'   => 'done',
            'progress' => 100,
            'message'  => 'Export complete!',
            'filename' => $filename,
        ], now()->addMinutes(10));
    }

    public function failed(\Throwable $exception): void
    {
        Cache::put("mgmt_export_{$this->jobId}", [
            'status'   => 'failed',
            'progress' => 0,
            'message'  => 'Export failed: ' . $exception->getMessage(),
            'filename' => null,
        ], now()->addMinutes(5));
    }

    // ── Remarks ───────────────────────────────────────────────────────────

    private function resolveRemarks(
        ?string $timeIn,
        bool    $isOnLeave,
        bool    $isRestDay,
        bool    $isFuture,
        ?array  $expectedInfo
    ): string {
        if ($timeIn !== null) {
            if ($isOnLeave) return 'On Leave (Present)';
            return 'Present';
        }
        if ($isFuture) {
            if ($isRestDay)  return 'Rest Day';
            if ($isOnLeave)  return 'On Leave';
            return 'Pending';
        }
        if ($isOnLeave)  return 'On Leave';
        if ($isRestDay)  return 'Rest Day';
        return 'Absent';
    }

    // ── XLSX helpers ──────────────────────────────────────────────────────

    private static array $colLetterCache = [];
    private function colLetter(int $idx): string
    {
        if (isset(self::$colLetterCache[$idx])) return self::$colLetterCache[$idx];
        $letter = '';
        $n      = $idx;
        do {
            $letter = chr(65 + ($n % 26)) . $letter;
            $n      = intdiv($n, 26) - 1;
        } while ($n >= 0);
        return self::$colLetterCache[$idx] = $letter;
    }

    private function styleIdxMap(): array
    {
        $map = [];
        $idx = 2;
        foreach (self::REMARK_COLORS as $remark => $_) {
            $map[$remark] = $idx++;
        }
        return $map;
    }

    private function buildStylesXml(): string
    {
        $remarkCount = count(self::REMARK_COLORS);

        $fonts  = '<font><sz val="9"/><name val="Arial"/></font>';
        $fonts .= '<font><b/><sz val="9"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>';
        foreach (self::REMARK_COLORS as [$bg, $fg]) {
            $fonts .= "<font><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"{$fg}\"/></font>";
        }
        $fontCount = 2 + $remarkCount;

        $fills  = '<fill><patternFill patternType="none"/></fill>';
        $fills .= '<fill><patternFill patternType="gray125"/></fill>';
        $fills .= '<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>';
        foreach (self::REMARK_COLORS as [$bg, $fg]) {
            $fills .= "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"{$bg}\"/></patternFill></fill>";
        }
        $fillCount = 3 + $remarkCount;

        $borders = '<border><left/><right/><top/><bottom/><diagonal/></border>';

        $xfs  = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
        $xfs .= '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>';
        $xfCount = 2;
        foreach (array_values(self::REMARK_COLORS) as $i => $_) {
            $fi = $i + 2;
            $fl = $i + 3;
            $xfs .= "<xf numFmtId=\"0\" fontId=\"{$fi}\" fillId=\"{$fl}\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>";
            $xfCount++;
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . "<fonts count=\"{$fontCount}\">{$fonts}</fonts>"
            . "<fills count=\"{$fillCount}\">{$fills}</fills>"
            . "<borders count=\"1\">{$borders}</borders>"
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . "<cellXfs count=\"{$xfCount}\">{$xfs}</cellXfs>"
            . '</styleSheet>';
    }

    private function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>';
    }

    private function relsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private function workbookXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';
    }

    private function workbookRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>';
    }

    private function updateProgress(int $pct, string $message): void
    {
        Cache::put("mgmt_export_{$this->jobId}", [
            'status'   => 'processing',
            'progress' => $pct,
            'message'  => $message,
            'filename' => null,
        ], now()->addMinutes(10));
    }
}