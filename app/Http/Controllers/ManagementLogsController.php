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
        $vips = $this->vipLogsService->getVipEmployees();

        // Cast all employee IDs to string for consistent comparison
        $employeeIds = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        // Load ALL logs from Jan 1 to today so any date the user picks already has data
        $dateFrom = '2026-01-01';
        $dateTo   = Carbon::now()->format('Y-m-d');

        $logs   = $this->vipLogsService->getVipLogs($employeeIds, $dateFrom, $dateTo);
        $leaves = $this->leaveService->getApprovedLeaves($employeeIds, '2026-01-01');

        return Inertia::render('ManagementLogs', [
            'tableData' => [
                'vips'     => $vips,
                'logs'     => $logs,
                'leaves'   => $leaves,
                'dateFrom' => $dateFrom,
                'dateTo'   => $dateTo,
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

        $vips        = $this->vipLogsService->getVipEmployees();
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

        $vips        = $this->vipLogsService->getVipEmployees();
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
            : $this->vipLogsService->getVipEmployees()->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

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