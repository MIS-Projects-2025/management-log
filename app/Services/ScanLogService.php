<?php

namespace App\Services;

use App\Models\VPLog;
use App\Models\EmployeeMasterlist;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Service class for handling VIP scan log operations
 * 
 * This service encapsulates business logic for scan logs,
 * keeping controllers thin and focused on HTTP concerns.
 */
class ScanLogService
{
    /**
     * Get all VIP employees with their latest log information
     *
     * @return Collection
     */
    public function getVipEmployeesWithLogs(): Collection
    {
        $employees = $this->getVipEmployees();

        return $employees->map(function ($employee) {
            return $this->enrichEmployeeWithLogData($employee);
        });
    }

    /**
     * Create a new scan log entry
     *
     * @param array $data
     * @return VPLog
     * @throws \Exception
     */
    public function createScanLog(array $data): VPLog
    {
        try {
            DB::connection('dtr')->beginTransaction();

            $log = $this->storeScanLog($data);

            DB::connection('dtr')->commit();

            $this->logScanLogCreation($log, $data);

            return $log;

        } catch (\Exception $e) {
            DB::connection('dtr')->rollBack();
            
            $this->logScanLogError($e, $data);
            
            throw $e;
        }
    }

    /**
     * Get latest log for an employee
     *
     * @param string $employeeId
     * @return VPLog|null
     */
    public function getLatestLog(string $employeeId): ?VPLog
    {
        return VPLog::forEmployee($employeeId)
            ->latest()
            ->first();
    }

    /**
     * Get logs for an employee on a specific date
     *
     * @param string $employeeId
     * @param Carbon|string $date
     * @return Collection
     */
    public function getEmployeeLogsForDate(string $employeeId, $date): Collection
    {
        $dateString = $date instanceof Carbon ? $date->toDateString() : $date;

        return VPLog::forEmployee($employeeId)
            ->onDate($dateString)
            ->latest()
            ->get();
    }

    /**
     * Get all logs for today
     *
     * @return Collection
     */
    public function getTodayLogs(): Collection
    {
        return VPLog::today()
            ->latest()
            ->get();
    }

    /**
     * Get VIP employees from database
     *
     * @return Collection
     */
    private function getVipEmployees(): Collection
    {
        return EmployeeMasterlist::query()
            ->whereIn('EMPPOSITION', [3, 4])
            ->where('ACCSTATUS', 1)
            ->orderBy('EMPNAME')
            ->get([
                'EMPID',
                'EMPLOYID',
                'EMPNAME',
                'DEPARTMENT',
                'PRODLINE',
                'STATION',
                'JOB_TITLE',
            ]);
    }

    /**
     * Enrich employee data with latest log information
     *
     * @param EmployeeMasterlist $employee
     * @return EmployeeMasterlist
     */
    private function enrichEmployeeWithLogData($employee)
    {
        $latestLog = $this->getLatestLog($employee->EMPLOYID);

        $employee->latest_log_type = $latestLog?->log_type;
        $employee->latest_log_time = $latestLog?->formatted_created_at;

        return $employee;
    }

    /**
     * Store scan log in database
     *
     * @param array $data
     * @return VPLog
     */
    private function storeScanLog(array $data): VPLog
    {
        $now = now();

        return VPLog::create([
            'employee_id' => $data['employee_id'],
            'employee_name' => $data['employee_name'],
            'department' => $data['department'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'prodline' => $data['prodline'] ?? null,
            'station' => $data['station'] ?? null,
            'log_date' => $now->toDateString(),
            'log_time' => $now->toTimeString(),
            'log_type' => $data['log_type'],
        ]);
    }

    /**
     * Log successful scan log creation
     *
     * @param VPLog $log
     * @param array $data
     * @return void
     */
    private function logScanLogCreation(VPLog $log, array $data): void
    {
        Log::info('VIP scan log created', [
            'log_id' => $log->id,
            'employee_id' => $data['employee_id'],
            'employee_name' => $data['employee_name'],
            'log_type' => $data['log_type'],
            'timestamp' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Log scan log creation error
     *
     * @param \Exception $e
     * @param array $data
     * @return void
     */
    private function logScanLogError(\Exception $e, array $data): void
    {
        Log::error('Failed to create scan log', [
            'error_message' => $e->getMessage(),
            'error_code' => $e->getCode(),
            'data' => $data,
            'trace' => $e->getTraceAsString(),
            'timestamp' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Get formatted log type label
     *
     * @param string $logType
     * @return string
     */
    public function getLogTypeLabel(string $logType): string
    {
        return ucwords(str_replace('_', ' ', $logType));
    }

    /**
     * Get today's check-in and check-out times for a list of employee IDs
     *
     * @param array $employeeIds
     * @return \Illuminate\Support\Collection  keyed by employee_id
     */
    public function getTodayCheckInOutTimes(array $employeeIds): \Illuminate\Support\Collection
    {
        $today = now()->toDateString();

        return VPLog::whereIn('employee_id', $employeeIds)
            ->whereDate('created_at', $today)
            ->whereIn('log_type', ['check_in', 'check_out'])
            ->orderBy('created_at')
            ->get(['employee_id', 'log_type', 'created_at'])
            ->groupBy('employee_id')
            ->map(function ($logs) {
                $checkIn  = $logs->first(fn($l) => $l->log_type === 'check_in');
                $checkOut = $logs->last(fn($l)  => $l->log_type === 'check_out');

                return [
                    'today_checkin_time'  => $checkIn?->created_at?->format('H:i:s'),
                    'today_checkout_time' => $checkOut?->created_at?->format('H:i:s'),
                ];
            });
    }

    /**
     * Check if log type is valid
     *
     * @param string $logType
     * @return bool
     */
    public function isValidLogType(string $logType): bool
    {
        return in_array($logType, VPLog::getValidLogTypes());
    }
}