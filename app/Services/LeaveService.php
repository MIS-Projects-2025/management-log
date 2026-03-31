<?php

namespace App\Services;

use App\Models\EmployeeLeave;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class LeaveService
{
    /**
     * Get approved leaves for employees within date range
     */
    public function getApprovedLeaves(array $employeeIds, string $startDate, string $endDate = null)
    {
        $endDate = $endDate ?? Carbon::now()->format('Y-m-d');
        
        return EmployeeLeave::whereIn('EMPLOYID', $employeeIds)
            ->where('LEAVESTATUS', 'Approved')
            ->where(function($query) use ($startDate, $endDate) {
                // Overlap: leave starts before period ends AND leave ends after period starts
                $query->whereDate('DATESTART', '<=', $endDate)
                      ->whereDate('DATEEND', '>=', $startDate);
            })
            ->select('EMPLOYID', 'DATESTART', 'DATEEND', 'TIMESTART', 'TIMEEND', 'LEAVESTATUS')
            ->get()
            ->map(fn($leave) => $this->formatLeaveData($leave, $startDate, $endDate));
    }

    /**
     * Format leave data with calculations
     */
    private function formatLeaveData($leave, ?string $clampStart = null, ?string $clampEnd = null)
    {
        $leaveStart = Carbon::parse($leave->DATESTART);
        $leaveEnd   = Carbon::parse($leave->DATEEND);

        // Clamp effective range to the requested period so:
        // - cross-month leaves only count days within the period
        // - future days within an approved leave are excluded when clampEnd = today
        $effectiveStart = $clampStart ? Carbon::parse($clampStart)->max($leaveStart) : $leaveStart;
        $effectiveEnd   = $clampEnd   ? Carbon::parse($clampEnd)->min($leaveEnd)     : $leaveEnd;

        $durationInDays = $effectiveStart->diffInDays($effectiveEnd) + 1;

        $period = CarbonPeriod::create($effectiveStart, $effectiveEnd);
        $allDates = [];
        foreach ($period as $date) {
            $allDates[] = $date->format('Y-m-d');
        }

        return [
            'EMPLOYID' => (string) $leave->EMPLOYID,
            'DATESTART' => $leave->DATESTART,
            'DATEEND' => $leave->DATEEND,
            'TIMESTART' => $leave->TIMESTART,
            'TIMEEND' => $leave->TIMEEND,
            'LEAVESTATUS' => (string) $leave->LEAVESTATUS,
            'DURATION_DAYS' => $durationInDays,
            'ALL_DATES' => $allDates,
        ];
    }

    /**
     * Calculate leave statistics
     */
    public function calculateLeaveStats($leaves)
    {
        return [
            'total_leave_days' => $leaves->sum('DURATION_DAYS'),
            'total_leave_records' => $leaves->count(),
            'leaves_by_employee' => $leaves->groupBy('EMPLOYID')->map(function($employeeLeaves) {
                return [
                    'total_days' => $employeeLeaves->sum('DURATION_DAYS'),
                    'total_records' => $employeeLeaves->count(),
                    'leaves' => $employeeLeaves
                ];
            }),
        ];
    }
}