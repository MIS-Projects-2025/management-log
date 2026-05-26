<?php

namespace App\Services;

use App\Models\EmployeeMasterlist;
use App\Models\VPLog;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class VipLogsService
{
    /**
     * Get all VIP employees
     */
public function getVipEmployees(bool $includeMedical = false, bool $includeStatic = true): Collection
{
    $staticEmployeeIds = [
        50009,
        50010,
        50002,
        1094,
    ];

    $query = EmployeeMasterlist::query()
        ->where(function ($q) use ($includeMedical, $includeStatic, $staticEmployeeIds) {
            // ── Active VIP / medical staff ────────────────────────────────
            $q->where(function ($inner) use ($includeMedical) {
                $inner->where('ACCSTATUS', 1)
                    ->where('EMPLOYID', '!=', 50400);

                if ($includeMedical) {
                    $inner->where(function ($m) {
                        $m->whereIn('EMPPOSITION', [3, 4, 5])
                          ->orWhereIn('JOB_TITLE', ['Company Doctor', 'Company Nurse']);
                    });
                } else {
                    $inner->whereIn('EMPPOSITION', [3, 4, 5]);
                }
            });

            // ── Static IDs — only when includeStatic is true ──────────────
            if ($includeStatic) {
                $q->orWhere(function ($inner) use ($staticEmployeeIds) {
                    $inner->whereIn('EMPLOYID', $staticEmployeeIds)
                          ->where('EMPLOYID', '!=', 50400);
                });
            }
        })
        ->orderBy('EMPNAME');

    return $query->get([
            'EMPID',
            'EMPLOYID',
            'EMPNAME',
            'JOB_TITLE',
            'DEPARTMENT',
        ])
        ->map(fn($employee) => $this->mapEmployeeData($employee));
}

    /**
     * Get logs for VIP employees within an optional date range
     */
    public function getVipLogs(array $employeeIds, ?string $dateFrom = null, ?string $dateTo = null): Collection
    {
        $query = VPLog::query()
            ->whereIn('employee_id', $employeeIds)
            ->orderBy('log_date', 'desc')
            ->orderBy('log_time', 'asc');

        if ($dateFrom) {
            $query->whereDate('log_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('log_date', '<=', $dateTo);
        }

        return $query->get()->map(fn($log) => $this->mapLogData($log));
    }

    /**
     * Get logs for a specific employee
     */
    public function getEmployeeLogs(string $employeeId, ?string $dateFrom = null, ?string $dateTo = null): Collection
    {
        return $this->getVipLogs([$employeeId], $dateFrom, $dateTo);
    }

    /**
     * Get logs for a specific date
     */
    public function getLogsByDate(array $employeeIds, string $date): Collection
    {
        return VPLog::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('log_date', $date)
            ->orderBy('log_time', 'asc')
            ->get()
            ->map(fn($log) => $this->mapLogData($log));
    }

    /**
     * Map employee data — always cast employee_id to string
     */
    private function mapEmployeeData(EmployeeMasterlist $employee): array
    {
        return [
            'id'          => $employee->EMPID,
            'employee_id' => (string) $employee->EMPLOYID,
            'name'        => trim($employee->EMPNAME),
            'job'         => $employee->JOB_TITLE,
            'dept'        => $employee->DEPARTMENT,
        ];
    }

    /**
     * Map log data — always cast employee_id to string
     */
    private function mapLogData(VPLog $log): array
    {
        return [
            'id'            => $log->id,
            'employee_id'   => (string) $log->employee_id,
            'employee_name' => $log->employee_name,
            'department'    => $log->department,
            'job_title'     => $log->job_title,
            'log_date'      => $log->log_date->format('Y-m-d'),
            'log_time'      => Carbon::parse($log->log_time)->format('H:i:s'),
            'log_type'      => $log->log_type,
            'formatted_time'=> Carbon::parse($log->log_time)->format('h:i A'),
        ];
    }

    /**
     * Get VIP logs data for export
     */
    public function getExportData(array $employeeIds, string $dateFrom, string $dateTo): array
    {
        $logs = $this->getVipLogs($employeeIds, $dateFrom, $dateTo);

        return [
            'total_records' => $logs->count(),
            'date_from'     => $dateFrom,
            'date_to'       => $dateTo,
            'logs'          => $logs,
        ];
    }
}