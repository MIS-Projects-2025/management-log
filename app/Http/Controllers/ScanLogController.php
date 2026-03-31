<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Services\ScanLogService;
use App\Services\FingerprintService;
use App\Models\FingerprintTemplate;
use App\Models\EmployeeMasterlist;
use App\Models\WorkScheduler;
use App\Models\ShiftCode;
use App\Http\Requests\StoreScanLogRequest;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class ScanLogController extends Controller
{
    // ── Match tuning ──────────────────────────────────────────────────────────
    private const MATCH_THRESHOLD = 50;
    private const QUALITY_GATE    = 40;
    private const HIGH_CONFIDENCE = 150;
    private const CHUNK_SIZE      = 20;

    public function __construct(
        private ScanLogService     $scanLogService,
        private FingerprintService $fingerprintService,
    ) {}

    public function index(): Response
    {
        if (session('emp_data.emp_dept') === 'Human Resource') {
            abort(403, 'Unauthorized access.');
        }

        $employees      = $this->scanLogService->getVipEmployeesWithLogs();
        $vipEmployeeIds = collect($employees)->pluck('EMPLOYID')->map(fn($id) => (string) $id)->toArray();

        // ── WorkScheduler records ────────────────────────────────────────────
        $schedulerRecords = WorkScheduler::whereIn('EMPID', $vipEmployeeIds)
            ->orderBy('PAYROLL_DATE_START', 'asc')
            ->get(['EMPID', 'PAYROLL_DATE_START', 'PAYROLL_DATE_END', 'SCHEDULE'])
            ->groupBy(fn($row) => (string) $row->EMPID)
            ->map(fn($rows) => $rows->map(fn($row) => [
                'payroll_date_start' => $row->PAYROLL_DATE_START?->format('Y-m-d'),
                'payroll_date_end'   => $row->PAYROLL_DATE_END?->format('Y-m-d'),
                'schedule'           => $row->SCHEDULE ?? null,
            ])->values()->all())
            ->all();

        // ── ShiftCode lookup ──────────────────────────────────────────────────
        $allShiftIds = collect($schedulerRecords)
            ->flatMap(fn($records) => collect($records)
                ->flatMap(fn($record) => is_array($record['schedule'])
                    ? array_values($record['schedule'])
                    : []
                )
            )
            ->unique()
            ->filter()
            ->values()
            ->toArray();

        $shiftCodeMap = ShiftCode::whereIn('SHIFT_CODE_ID', $allShiftIds)
            ->get(['SHIFT_CODE_ID', 'SHIFTCODE', 'TIME_WINDOWS'])
            ->keyBy(fn($sc) => (string) $sc->SHIFT_CODE_ID)
            ->map(fn($sc) => [
                'shiftcode'    => $sc->SHIFTCODE,
                'time_windows' => [
                    'check_in'    => $sc->TIME_WINDOWS[0] ?? null,
                    'break_out_1' => $sc->TIME_WINDOWS[1] ?? null,
                    'break_in_1'  => $sc->TIME_WINDOWS[2] ?? null,
                    'break_out_2' => $sc->TIME_WINDOWS[3] ?? null,
                    'break_in_2'  => $sc->TIME_WINDOWS[4] ?? null,
                    'check_out'   => $sc->TIME_WINDOWS[5] ?? null,
                ],
            ])
            ->toArray();

        // ── Today's check-in / check-out times ────────────────────────────────
        $todayLogTimes = $this->scanLogService->getTodayCheckInOutTimes($vipEmployeeIds);

        // ── Attach scheduler_records + today log times to each employee ────────
        $employees = collect($employees)->map(function ($emp) use ($schedulerRecords, $todayLogTimes) {
            $empId = (string) ($emp['EMPLOYID'] ?? $emp->EMPLOYID ?? '');
            $emp['scheduler_records']   = $schedulerRecords[$empId] ?? [];
            $emp['today_checkin_time']  = $todayLogTimes[$empId]['today_checkin_time']  ?? null;
            $emp['today_checkout_time'] = $todayLogTimes[$empId]['today_checkout_time'] ?? null;
            return $emp;
        })->all();

        return Inertia::render('ScanLogs', [
            'employees'    => $employees,
            'shiftCodeMap' => $shiftCodeMap,
        ]);
    }

    public function store(StoreScanLogRequest $request): RedirectResponse
    {
        if (session('emp_data.emp_dept') === 'Human Resource') {
            abort(403, 'Unauthorized access.');
        }

        try {
            $validated = $request->validated();
            $this->scanLogService->createScanLog($validated);

            return back()->with('success', $this->getSuccessMessage($validated));

        } catch (\Exception $e) {
            Log::error('Failed to save scan log', [
                'error'       => $e->getMessage(),
                'employee_id' => $request->input('employee_id'),
                'log_type'    => $request->input('log_type'),
            ]);

            return back()->with('error', 'Failed to save scan log. Please try again.');
        }
    }

    /**
     * Capture a live fingerprint from the SecuGen device, then match it
     * against all stored templates using pure-PHP ISO-19794 minutiae matching.
     */
    public function fingerprintIdentify(): JsonResponse
    {
        if (session('emp_data.emp_dept') === 'Human Resource') {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        // ── 1. Capture from device ────────────────────────────────────────────
        try {
            $captured = $this->fingerprintService->capture();
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $templateBase64 = $captured['template'];
        $quality        = (int) ($captured['quality'] ?? 0);

        // ── 2. Quality gate ───────────────────────────────────────────────────
        if ($quality < self::QUALITY_GATE) {
            return response()->json([
                'success' => false,
                'message' => "Fingerprint quality too low ({$quality}/100). Please re-scan.",
            ], 422);
        }

        // ── 3. Decode probe template ──────────────────────────────────────────
        $probeBytes = base64_decode(trim($templateBase64));

        if ($probeBytes === false || strlen($probeBytes) < 32) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid fingerprint template from device.',
            ], 422);
        }

        $probeMinutiae = $this->parseISO19794($probeBytes);

        if (empty($probeMinutiae)) {
            return response()->json([
                'success' => false,
                'message' => 'Could not parse fingerprint template. Try scanning again.',
            ], 422);
        }

        // ── 4. Load all active templates ──────────────────────────────────────
        $templates = FingerprintTemplate::where('is_active', 1)
            ->where('device_type', 'secugen')
            ->where(fn($q) => $q->whereNull('quality')->orWhere('quality', '>=', 20))
            ->get();

        if ($templates->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No registered fingerprints found in the system.',
            ], 404);
        }

        // ── 5. Match ──────────────────────────────────────────────────────────
        $sorted       = $templates->sortByDesc(fn($t) => $t->quality ?? 0)->values();
        $bestScore    = 0;
        $bestTemplate = null;

        foreach ($sorted->chunk(self::CHUNK_SIZE) as $chunk) {
            foreach ($this->matchTemplatesBatch($probeMinutiae, $chunk) as $id => $score) {
                if ($score > $bestScore) {
                    $bestScore    = $score;
                    $bestTemplate = $chunk->firstWhere('id', $id);
                }
            }
            if ($bestScore >= self::HIGH_CONFIDENCE) break;
            if ($bestScore >= self::MATCH_THRESHOLD && $sorted->count() > 50) break;
        }

        // ── 6. Return result ──────────────────────────────────────────────────
        if ($bestScore >= self::MATCH_THRESHOLD && $bestTemplate) {
            Log::info('[SCAN-LOG] ✅ Fingerprint matched', [
                'employid' => $bestTemplate->employid,
                'score'    => $bestScore,
                'quality'  => $quality,
            ]);

            return response()->json([
                'success'     => true,
                'employee_id' => $bestTemplate->employid,
                'score'       => $bestScore,
                'quality'     => $quality,
            ]);
        }

        Log::warning('[SCAN-LOG] ❌ No fingerprint match', [
            'best_score' => $bestScore,
            'quality'    => $quality,
        ]);

        return response()->json([
            'success' => false,
            'message' => 'No matching fingerprint found.',
        ], 404);
    }

    // ── Pure-PHP ISO-19794-2 minutiae matching ────────────────────────────────

    private function matchTemplatesBatch(array $probeMinutiae, \Illuminate\Support\Collection $templates): array
    {
        $scores = [];
        foreach ($templates as $tpl) {
            $raw = is_resource($tpl->template_data)
                ? stream_get_contents($tpl->template_data)
                : (string) $tpl->template_data;
            $scores[$tpl->id] = $this->matchMinutiae($probeMinutiae, $this->parseISO19794($raw));
        }
        return $scores;
    }

    private function parseISO19794(string $bytes): array
    {
        if (strlen($bytes) < 32) return [];

        $count    = ord($bytes[27]);
        $minutiae = [];
        $offset   = 28;

        for ($i = 0; $i < $count; $i++) {
            if ($offset + 6 > strlen($bytes)) break;
            $typeX      = (ord($bytes[$offset]) << 8) | ord($bytes[$offset + 1]);
            $typeY      = (ord($bytes[$offset + 2]) << 8) | ord($bytes[$offset + 3]);
            $minutiae[] = [
                'x'     => $typeX & 0x3FFF,
                'y'     => $typeY & 0x3FFF,
                'angle' => ord($bytes[$offset + 4]),
                'type'  => ($typeX >> 14) & 0x03,
            ];
            $offset += 6;
        }

        return $minutiae;
    }

    private function matchMinutiae(array $probe, array $stored): int
    {
        if (empty($probe) || empty($stored)) return 0;

        $spatialTol     = 10;
        $angularTol     = 12;
        $bestMatchCount = 0;
        $probeAnchors   = array_slice($probe,  0, 10);
        $storedAnchors  = array_slice($stored, 0, 10);

        foreach ($probeAnchors as $p) {
            foreach ($storedAnchors as $s) {
                $rad = ($p['angle'] - $s['angle']) * (2 * M_PI / 255);
                $cos = cos($rad);
                $sin = sin($rad);
                $tx  = $p['x'] - ($s['x'] * $cos - $s['y'] * $sin);
                $ty  = $p['y'] - ($s['x'] * $sin + $s['y'] * $cos);

                $matchCount = 0;
                $usedStored = [];

                foreach ($probe as $pp) {
                    foreach ($stored as $si => $ss) {
                        if (isset($usedStored[$si])) continue;
                        $dx = abs($pp['x'] - ($ss['x'] * $cos - $ss['y'] * $sin + $tx));
                        $dy = abs($pp['y'] - ($ss['x'] * $sin + $ss['y'] * $cos + $ty));
                        $da = abs($pp['angle'] - $ss['angle']);
                        if ($da > 127) $da = 255 - $da;
                        if ($dx <= $spatialTol && $dy <= $spatialTol && $da <= $angularTol) {
                            $matchCount++;
                            $usedStored[$si] = true;
                            break;
                        }
                    }
                }

                if ($matchCount > $bestMatchCount) $bestMatchCount = $matchCount;
            }
        }

        $denom = min(count($probe), count($stored));
        return $denom === 0 ? 0 : min(200, (int) round(($bestMatchCount / $denom) * 200));
    }

    private function getSuccessMessage(array $validated): string
    {
        $logTypeLabel = $this->scanLogService->getLogTypeLabel($validated['log_type']);
        return "{$logTypeLabel} logged successfully for {$validated['employee_name']}";
    }
}