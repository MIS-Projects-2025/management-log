<?php

namespace App\Http\Controllers;

use App\Http\Requests\VipLogs\GetVipLogsRequest;
use App\Http\Requests\VipLogs\ExportVipLogsRequest;
use App\Services\VipLogsService;
use App\Services\LeaveService;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class ManagementLogsController extends Controller
{
    protected VipLogsService $vipLogsService;
    protected LeaveService $leaveService;

    public function __construct(
        VipLogsService $vipLogsService,
        LeaveService $leaveService
    ) {
        $this->vipLogsService = $vipLogsService;
        $this->leaveService = $leaveService;
    }

    public function index(GetVipLogsRequest $request): Response
    {
        $empPosition = (string) session('emp_data.emp_position');
        $isPosition5 = $empPosition === '5';

        $vips = $isPosition5
            ? $this->vipLogsService->getVipEmployees(includeMedical: false, includeStatic: false)
            : $this->vipLogsService->getVipEmployees(includeMedical: true,  includeStatic: true);

        if ($isPosition5) {
            $vips = $vips->filter(fn($vip) =>
                !in_array(strtolower($vip['job'] ?? ''), ['company nurse', 'company doctor'])
            )->values();
        }

        // Cast all employee IDs to string for consistent comparison
        $employeeIds = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        // Load ALL logs from Jan 1 to today so any date the user picks already has data
        $dateFrom = '2026-01-01';
        $dateTo   = Carbon::now()->format('Y-m-d');

        $logs   = $this->vipLogsService->getVipLogs($employeeIds, $dateFrom, $dateTo);
        $leaves = $this->leaveService->getApprovedLeaves($employeeIds, '2026-01-01');

        // ── Pull scheduler records for VIP employees ─────────────────────────────
$schedulerRecords = \App\Models\WorkScheduler::whereIn('EMPID', $employeeIds)
    ->orderBy('PAYROLL_DATE_START', 'asc')
    ->get(['EMPID', 'PAYROLL_DATE_START', 'PAYROLL_DATE_END', 'SCHEDULE'])
    ->groupBy(fn($row) => (string) $row->EMPID)
    ->map(fn($rows) => $rows->map(fn($row) => [
        'payroll_date_start' => $row->PAYROLL_DATE_START?->format('Y-m-d'),
        'payroll_date_end'   => $row->PAYROLL_DATE_END?->format('Y-m-d'),
        'schedule'           => $row->SCHEDULE ?? null,
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
            'check_in'    => $sc->TIME_WINDOWS[0] ?? null,
            'break_out_1' => $sc->TIME_WINDOWS[1] ?? null,
            'break_in_1'  => $sc->TIME_WINDOWS[2] ?? null,
            'break_out_2' => $sc->TIME_WINDOWS[3] ?? null,
            'break_in_2'  => $sc->TIME_WINDOWS[4] ?? null,
            'check_out'   => $sc->TIME_WINDOWS[5] ?? null,
        ],
    ])
    ->toArray();
// Build per-employee expected dates (non-rest days only)
$employeeExpectedDates = [];
foreach ($schedulerRecords as $empId => $records) {
    foreach ($records as $record) {
        if (empty($record['schedule']) || !is_array($record['schedule'])) continue;
        if (!$record['payroll_date_start']) continue;
        $payrollStart = Carbon::parse($record['payroll_date_start']);
        foreach ($record['schedule'] as $dayNo => $shiftId) {
            $schedDate = (clone $payrollStart)->addDays((int)$dayNo - 1);
            $dateStr   = $schedDate->format('Y-m-d');
            $shiftInfo = $shiftCodeMap[(string)$shiftId] ?? null;
            $shiftCode = $shiftInfo ? strtoupper($shiftInfo['shiftcode']) : '';

            if (!str_contains($shiftCode, 'RD')) {
                $timeWindows = $shiftInfo['time_windows'] ?? [];
                $checkIn     = $timeWindows['check_in']  ?? null;
                $checkOut    = $timeWindows['check_out'] ?? null;

                // Night shift: check_out hour <= check_in hour means the shift crosses midnight
                $isNight = false;
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

return Inertia::render('ManagementLogs', [
    'tableData' => [
        'vips'                  => $vips,
        'logs'                  => $logs,
        'leaves'                => $leaves,
        'dateFrom'              => $dateFrom,
        'dateTo'                => $dateTo,
        'employeeExpectedDates' => $employeeExpectedDates,
    ],
    'authUser' => [
        'emp_id'       => session('emp_data.emp_id'),
        'emp_name'     => session('emp_data.emp_name'),
        'emp_dept'     => session('emp_data.emp_dept'),
        'emp_position' => session('emp_data.emp_position'),
    ],
]);
    }

    /**
     * Get logs for all VIPs within a date range.
     * Called by the frontend fetch when the user navigates to a month not yet loaded.
     */
    public function getLogsByRange(GetVipLogsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $empPosition = (string) session('emp_data.emp_position');
        $isPosition5 = $empPosition === '5';

        $vips = $isPosition5
            ? $this->vipLogsService->getVipEmployees(includeMedical: false, includeStatic: false)
            : $this->vipLogsService->getVipEmployees(includeMedical: true,  includeStatic: true);

        if ($isPosition5) {
            $vips = $vips->filter(fn($vip) =>
                !in_array(strtolower($vip['job'] ?? ''), ['company nurse', 'company doctor'])
            )->values();
        }

        $employeeIds = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        $logs = $this->vipLogsService->getVipLogs(
            $employeeIds,
            $validated['date_from'] ?? null,
            $validated['date_to']   ?? null
        );

        return response()->json([
            'success' => true,
            'data'    => $logs,
        ]);
    }

    public function getEmployeeLogs(GetVipLogsRequest $request, string $employeeId): JsonResponse
    {
        $validated = $request->validated();

        $logs = $this->vipLogsService->getEmployeeLogs(
            $employeeId,
            $validated['date_from'] ?? null,
            $validated['date_to']   ?? null
        );

        return response()->json([
            'success' => true,
            'data'    => $logs,
        ]);
    }

    public function getLogsByDate(GetVipLogsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $vips = $this->vipLogsService->getVipEmployees(includeMedical: true);
        $employeeIds = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        $logs = $this->vipLogsService->getLogsByDate(
            $employeeIds,
            $validated['date']
        );

        return response()->json([
            'success' => true,
            'data'    => $logs,
        ]);
    }

    public function export(ExportVipLogsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $employeeIds = isset($validated['employee_ids'])
            ? array_map('strval', $validated['employee_ids'])
            : $this->vipLogsService->getVipEmployees(includeMedical: true)->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        $exportData = $this->vipLogsService->getExportData(
            $employeeIds,
            $validated['date_from'],
            $validated['date_to']
        );

        return response()->json([
            'success' => true,
            'data'    => $exportData,
        ]);
    }

    public function exportDispatch(\Illuminate\Http\Request $request): JsonResponse
{
    \Log::info('exportDispatch hit', $request->all());

    try {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
            'format'    => 'nullable|integer|in:1,2',
        ]);
    } catch (\Exception $e) {
        \Log::error('exportDispatch validation failed', ['error' => $e->getMessage()]);
        throw $e;
    }

    \Log::info('exportDispatch validation passed');

    $jobId = (string) \Illuminate\Support\Str::uuid();

    \Illuminate\Support\Facades\Cache::put("mgmt_export_{$jobId}", [
        'status'   => 'processing',
        'progress' => 0,
        'message'  => 'Queued...',
        'filename' => null,
    ], now()->addMinutes(10));

    try {
        \App\Jobs\ExportManagementLogs::dispatch($jobId, $request->date_from, $request->date_to, $request->format ?? 1);
        \Log::info('exportDispatch job dispatched', ['job_id' => $jobId]);
    } catch (\Exception $e) {
        \Log::error('exportDispatch dispatch failed', ['error' => $e->getMessage()]);
        throw $e;
    }

    return response()->json(['job_id' => $jobId]);
}

public function exportProgress(\Illuminate\Http\Request $request): JsonResponse
{
    $jobId = $request->get('job_id');
    $state = \Illuminate\Support\Facades\Cache::get("mgmt_export_{$jobId}");

    if (!$state) {
        return response()->json([
            'status'   => 'not_found',
            'progress' => 0,
            'message'  => 'Job not found or expired.',
            'filename' => null,
        ]);
    }

    return response()->json($state);
}

public function exportDownload(\Illuminate\Http\Request $request): mixed
{
    $jobId = $request->get('job_id');
    $state = \Illuminate\Support\Facades\Cache::get("mgmt_export_{$jobId}");

    if (!$state || $state['status'] !== 'done' || empty($state['filename'])) {
        abort(404, 'Export file not ready or not found.');
    }

    $path = storage_path('app/exports/' . $state['filename']);

    if (!file_exists($path)) {
        abort(404, 'Export file missing from disk.');
    }

    \Illuminate\Support\Facades\Cache::forget("mgmt_export_{$jobId}");

    return response()->download($path, $state['filename'], [
        'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])->deleteFileAfterSend(true);
}
}