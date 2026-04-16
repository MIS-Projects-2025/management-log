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
        $vips = $this->vipLogsService->getVipEmployees(includeMedical: true);

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
    ->get(['SHIFT_CODE_ID', 'SHIFTCODE'])
    ->keyBy(fn($sc) => (string) $sc->SHIFT_CODE_ID)
    ->map(fn($sc) => ['shiftcode' => $sc->SHIFTCODE])
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
                $employeeExpectedDates[$empId][$dateStr] = true;
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

        $vips = $this->vipLogsService->getVipEmployees(includeMedical: true);
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
}