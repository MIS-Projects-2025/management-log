<?php

namespace App\Services;

use App\Models\VPLog;
use App\Models\EmployeeMasterlist;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Service for importing VIP scan logs from Excel DTR files.
 *
 * Expected Excel format:
 *   Row 1:  headers (ignored)
 *   Row 2:  payroll period label (ignored)
 *   Row 3:  date row  — columns C, E, G … (every 2nd col starting at index 3)
 *   Row 4:  IN/OUT row (ignored; we derive IN/OUT from column position)
 *   Row 5+: employee data
 *            col A = ID No.
 *            col B = Name
 *            col C = Day1 IN, col D = Day1 OUT, col E = Day2 IN … etc.
 *
 * Matching logic:
 *   1. Try to match by ID (col A) → employee.EMPLOYID  (case-insensitive, trimmed)
 *   2. If ID is empty, try to match by Name (col B) → employee.EMPNAME (fuzzy: normalised)
 *   3. Only insert if the matched employee is in the VIP list (EMPPOSITION IN [3,4] AND ACCSTATUS=1)
 *   4. Skip cells that are "XXX", "XXXX", empty, or non-time values
 *   5. Recognised special codes: SL, VL, OB, LEAVE, BL → stored as-is in log_type
 */
class ExcelScanLogImportService
{
    /** Special codes that indicate leave / absence — stored as log entries with log_type = code */
    private const SPECIAL_CODES = ['SL', 'VL', 'OB', 'LEAVE', 'BL', 'CL', 'EL'];

    /** Values that mean "no data" */
    private const SKIP_VALUES = ['XXX', 'XXXX', '', '-', 'N/A'];

    /** Column index (0-based) of the first date pair (IN col) */
    private const FIRST_DATA_COL = 2; // Column C (0-based index 2)

    /** @var Collection|null cached VIP employees */
    private ?Collection $vipEmployees = null;

    /**
     * Import DTR Excel file and save logs to vp_logs.
     *
     * @param  UploadedFile $file
     * @return array{inserted: int, skipped: int, errors: array, details: array}
     */
    public function import(UploadedFile $file): array
    {
        $spreadsheet = IOFactory::load($file->getRealPath());
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = $sheet->toArray(null, true, true, false); // 0-based array

        $dates      = $this->parseDateRow($rows);
        $employees  = $this->loadVipEmployees();

        $inserted = 0;
        $skipped  = 0;
        $errors   = [];
        $details  = [];

        // Data starts at row index 4 (0-based), i.e. row 5 in Excel
        for ($rowIdx = 4; $rowIdx < count($rows); $rowIdx++) {
            $row = $rows[$rowIdx];

            // Skip completely empty rows
            if ($this->isEmptyRow($row)) {
                continue;
            }

            $rawId   = trim((string) ($row[0] ?? ''));
            $rawName = trim((string) ($row[1] ?? ''));

            // Skip header-like rows
            if (strtoupper($rawId) === 'ID NO.' || strtoupper($rawId) === 'ID') {
                continue;
            }

            // Try to resolve the employee
            $employee = $this->resolveEmployee($rawId, $rawName, $employees);

            if (!$employee) {
                $label = $rawId ?: $rawName;
                $skipped++;
                $details[] = [
                    'row'    => $rowIdx + 1,
                    'id'     => $rawId,
                    'name'   => $rawName,
                    'status' => 'skipped',
                    'reason' => "Not found in VIP list: [{$label}]",
                ];
                continue;
            }

            // Process each date pair (IN / OUT columns)
            $rowInserted = 0;
            $rowErrors   = [];

            foreach ($dates as $dateColIdx => $date) {
                $inColIdx  = $dateColIdx;          // e.g. 2, 4, 6 …
                $outColIdx = $dateColIdx + 1;       // e.g. 3, 5, 7 …

                $inValue  = trim((string) ($row[$inColIdx]  ?? ''));
                $outValue = trim((string) ($row[$outColIdx] ?? ''));

                // Process IN
                if (!$this->shouldSkip($inValue)) {
                    try {
                        $logEntry = $this->buildLogEntry($employee, $date, $inValue, 'check_in');
                        if ($logEntry) {
                            $this->saveLog($logEntry);
                            $rowInserted++;
                            $inserted++;
                        }
                    } catch (\Exception $e) {
                        $rowErrors[] = "IN [{$date}]: " . $e->getMessage();
                    }
                }

                // Process OUT
                if (!$this->shouldSkip($outValue)) {
                    try {
                        $logEntry = $this->buildLogEntry($employee, $date, $outValue, 'check_out');
                        if ($logEntry) {
                            $this->saveLog($logEntry);
                            $rowInserted++;
                            $inserted++;
                        }
                    } catch (\Exception $e) {
                        $rowErrors[] = "OUT [{$date}]: " . $e->getMessage();
                    }
                }
            }

            $details[] = [
                'row'      => $rowIdx + 1,
                'id'       => $employee->EMPLOYID,
                'name'     => $employee->EMPNAME,
                'status'   => $rowInserted > 0 ? 'imported' : 'no_data',
                'inserted' => $rowInserted,
                'errors'   => $rowErrors,
            ];

            if (!empty($rowErrors)) {
                $errors[] = "Row " . ($rowIdx + 1) . " ({$employee->EMPNAME}): " . implode('; ', $rowErrors);
                $skipped += count($rowErrors);
            }
        }

        Log::info('Excel scan log import completed', [
            'inserted' => $inserted,
            'skipped'  => $skipped,
            'errors'   => count($errors),
        ]);

        return compact('inserted', 'skipped', 'errors', 'details');
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Parse date row (row index 2, i.e. row 3 in Excel).
     * Dates appear at every even column starting from FIRST_DATA_COL.
     *
     * @param  array $rows
     * @return array<int, string>  map of colIndex → 'Y-m-d'
     */
    private function parseDateRow(array $rows): array
    {
        $dateRow = $rows[2] ?? [];
        $dates   = [];

        // Date cols: C, E, G, … (0-based: 2, 4, 6, …)
        for ($col = self::FIRST_DATA_COL; $col < count($dateRow); $col += 2) {
            $raw = $dateRow[$col] ?? '';

            if (empty($raw)) {
                continue;
            }

            $parsed = $this->parseDate($raw);
            if ($parsed) {
                $dates[$col] = $parsed;
            }
        }

        return $dates;
    }

    /**
     * Attempt to parse a cell value as a date string (Y-m-d).
     */
    private function parseDate($raw): ?string
    {
        if (is_numeric($raw)) {
            // Excel serial date
            try {
                $date = ExcelDate::excelToDateTimeObject($raw);
                return Carbon::instance($date)->format('Y-m-d');
            } catch (\Exception $e) {
                return null;
            }
        }

        $raw = trim((string) $raw);

        // Try common formats
        $formats = ['d-M', 'M d', 'd/m/Y', 'm/d/Y', 'Y-m-d', 'd-m-Y', 'M-d-Y', 'M d, Y'];
        foreach ($formats as $fmt) {
            try {
                // For formats without year, append current year
                $withYear = (strpos($fmt, 'Y') === false) ? $raw . '-' . date('Y') : $raw;
                $fmtWithYear = (strpos($fmt, 'Y') === false) ? $fmt . '-Y' : $fmt;
                $dt = Carbon::createFromFormat($fmtWithYear, $withYear);
                if ($dt) {
                    return $dt->format('Y-m-d');
                }
            } catch (\Exception $e) {
                // continue
            }
        }

        // Try Carbon's flexible parse as last resort
        try {
            return Carbon::parse($raw)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Load and cache VIP employees from masterlist.
     */
    private function loadVipEmployees(): Collection
    {
        if ($this->vipEmployees === null) {
            $this->vipEmployees = EmployeeMasterlist::query()
                ->whereIn('EMPPOSITION', [3, 4])
                ->where('ACCSTATUS', 1)
                ->get(['EMPID', 'EMPLOYID', 'EMPNAME', 'DEPARTMENT', 'PRODLINE', 'STATION', 'JOB_TITLE']);
        }

        return $this->vipEmployees;
    }

    /**
     * Try to resolve an employee from raw ID or name.
     * Priority: ID match → name match.
     */
    private function resolveEmployee(string $rawId, string $rawName, Collection $employees): ?EmployeeMasterlist
    {
        // 1. Match by ID
        if ($rawId !== '') {
            $byId = $employees->first(function ($emp) use ($rawId) {
                return strtolower(trim($emp->EMPLOYID)) === strtolower($rawId);
            });
            if ($byId) {
                return $byId;
            }
        }

        // 2. Match by name (normalise: lowercase, remove extra spaces, remove punctuation)
        if ($rawName !== '') {
            $normInput = $this->normaliseName($rawName);

            $byName = $employees->first(function ($emp) use ($normInput) {
                return $this->normaliseName($emp->EMPNAME) === $normInput;
            });

            if ($byName) {
                return $byName;
            }

            // Partial / substring match as fallback
            $byName = $employees->first(function ($emp) use ($normInput) {
                $normEmp = $this->normaliseName($emp->EMPNAME);
                return str_contains($normEmp, $normInput) || str_contains($normInput, $normEmp);
            });

            if ($byName) {
                return $byName;
            }
        }

        return null;
    }

    /**
     * Normalise a name for comparison.
     */
    private function normaliseName(string $name): string
    {
        // Remove special chars, lowercase, collapse spaces
        $name = strtolower($name);
        $name = preg_replace('/[^a-z0-9\s]/', '', $name);
        $name = preg_replace('/\s+/', ' ', trim($name));
        return $name;
    }

    /**
     * Determine whether a cell value should be skipped entirely.
     */
    private function shouldSkip(string $value): bool
    {
        if ($value === '') {
            return true;
        }

        $upper = strtoupper($value);

        foreach (self::SKIP_VALUES as $skip) {
            if ($upper === strtoupper($skip)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build a log entry array from a cell value.
     * Returns null if the value should produce no log (e.g. pure XXX checked earlier).
     *
     * @param  EmployeeMasterlist $employee
     * @param  string             $date       Y-m-d
     * @param  string             $value      raw cell e.g. "0714H", "SL", "LEAVE"
     * @param  string             $defaultLogType  'check_in' or 'check_out'
     * @return array|null
     */
    private function buildLogEntry(
        EmployeeMasterlist $employee,
        string $date,
        string $value,
        string $defaultLogType
    ): ?array {
        $upper = strtoupper(trim($value));

        // Special codes — treat as a single event on that day
        if (in_array($upper, self::SPECIAL_CODES, true)) {
            return [
                'employee_id'   => $employee->EMPLOYID,
                'employee_name' => $employee->EMPNAME,
                'department'    => $employee->DEPARTMENT,
                'job_title'     => $employee->JOB_TITLE,
                'prodline'      => $employee->PRODLINE,
                'station'       => $employee->STATION,
                'log_date'      => $date,
                'log_time'      => '00:00:00',
                'log_type'      => strtolower($upper), // e.g. 'sl', 'leave', 'ob'
            ];
        }

        // Try to parse as time (e.g. "0714H", "07:14", "0714")
        $time = $this->parseTime($value);
        if ($time === null) {
            // Unknown format — log a warning and skip
            Log::warning('ExcelScanLogImport: unrecognised time value', [
                'value' => $value,
                'date'  => $date,
            ]);
            return null;
        }

        return [
            'employee_id'   => $employee->EMPLOYID,
            'employee_name' => $employee->EMPNAME,
            'department'    => $employee->DEPARTMENT,
            'job_title'     => $employee->JOB_TITLE,
            'prodline'      => $employee->PRODLINE,
            'station'       => $employee->STATION,
            'log_date'      => $date,
            'log_time'      => $time,
            'log_type'      => $defaultLogType,
        ];
    }

    /**
     * Parse time strings like "0714H", "07:14", "0714", "17025H" (typo) into "HH:MM:SS".
     */
    private function parseTime(string $value): ?string
    {
        // Remove trailing 'H' (common in this format)
        $clean = preg_replace('/H$/i', '', trim($value));

        // If length > 4 after strip (e.g. "17025" which is a typo for "1702"), truncate to 4
        if (is_numeric($clean) && strlen($clean) > 4) {
            $clean = substr($clean, 0, 4);
        }

        // Numeric like "0714" or "1610"
        if (is_numeric($clean) && strlen($clean) === 4) {
            $h = substr($clean, 0, 2);
            $m = substr($clean, 2, 2);
            if ((int)$h <= 23 && (int)$m <= 59) {
                return sprintf('%02d:%02d:00', (int)$h, (int)$m);
            }
        }

        // "07:14" format
        if (preg_match('/^(\d{1,2}):(\d{2})$/', $clean, $match)) {
            if ((int)$match[1] <= 23 && (int)$match[2] <= 59) {
                return sprintf('%02d:%02d:00', (int)$match[1], (int)$match[2]);
            }
        }

        return null;
    }

    /**
     * Persist a log entry to the database, avoiding exact duplicates.
     */
    private function saveLog(array $data): void
    {
        // Avoid duplicate: same employee, date, time, log_type
        $exists = VPLog::on('dtr')
            ->where('employee_id', $data['employee_id'])
            ->where('log_date', $data['log_date'])
            ->where('log_time', $data['log_time'])
            ->where('log_type', $data['log_type'])
            ->exists();

        if ($exists) {
            return;
        }

        VPLog::create($data);
    }

    /**
     * Check if an entire row is empty / all whitespace.
     */
    private function isEmptyRow(array $row): bool
    {
        foreach ($row as $cell) {
            if (trim((string) $cell) !== '') {
                return false;
            }
        }
        return true;
    }
}