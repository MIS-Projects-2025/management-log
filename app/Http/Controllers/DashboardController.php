<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use App\Services\VipLogsService;
use App\Services\LeaveService;
use App\Services\ObRecordService;
use App\Models\ShiftCode;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use App\Models\WorkScheduler;

class DashboardController extends Controller
{
    protected VipLogsService $vipLogsService;
    protected LeaveService $leaveService;
    protected ObRecordService $obRecordService;

    public function __construct(
        VipLogsService $vipLogsService,
        LeaveService $leaveService,
        ObRecordService $obRecordService
    ) {
        $this->vipLogsService  = $vipLogsService;
        $this->leaveService    = $leaveService;
        $this->obRecordService = $obRecordService;
    }

    public function index(Request $request)
    {
        $vips           = $this->vipLogsService->getVipEmployees();
        $vipEmployeeIds = $vips->pluck('employee_id')->map(fn($id) => (string) $id)->toArray();

        // ── WorkScheduler payroll period lookup ──────────────────────────────
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

        // ── ShiftCode lookup ─────────────────────────────────────────────────────────
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

        // ── Daily Expected count from Work Scheduler ─────────────────────────────────
        $now2        = Carbon::now();
        $month2      = $request->integer('month', $now2->month);
        $year2       = $request->integer('year',  $now2->year);
        $periodStart = Carbon::createFromDate($year2, $month2, 1)->startOfMonth();
        $periodEnd   = ($year2 === $now2->year && $month2 === $now2->month)
            ? $now2->copy()->startOfDay()
            : Carbon::createFromDate($year2, $month2, 1)->endOfMonth();

        $dailyExpectedFromScheduler = [];

        foreach ($vipEmployeeIds as $empId) {
            $empId    = (string) $empId;
            $records  = $schedulerRecords[$empId] ?? [];

            foreach ($records as $record) {
                if (!$record['payroll_date_start'] || !$record['payroll_date_end']) continue;

                $payrollStart    = Carbon::parse($record['payroll_date_start']);
                $payrollEnd      = Carbon::parse($record['payroll_date_end']);
                $scheduleEntries = $record['schedule'] ?? [];

                if (empty($scheduleEntries) || !is_array($scheduleEntries)) continue;

                foreach ($scheduleEntries as $dayNo => $shiftId) {
                    $schedDate = (clone $payrollStart)->addDays((int)$dayNo - 1);

                    if ($schedDate->lt($periodStart) || $schedDate->gt($periodEnd)) continue;

                    $dateStr   = $schedDate->format('Y-m-d');
                    $shiftInfo = $shiftCodeMap[(string)$shiftId] ?? null;
                    $shiftCode = $shiftInfo ? strtoupper($shiftInfo['shiftcode']) : '';
                    $isRestDay = str_contains($shiftCode, 'RD');

                    if (!$isRestDay) {
                        $dailyExpectedFromScheduler[$dateStr] = ($dailyExpectedFromScheduler[$dateStr] ?? 0) + 1;
                    }
                }
            }
        }

        $totalExpectedFromScheduler = array_sum($dailyExpectedFromScheduler);
        $expectedDaysCount          = count($dailyExpectedFromScheduler);
        $avgExpectedFromScheduler   = $expectedDaysCount > 0
            ? round($totalExpectedFromScheduler / $expectedDaysCount)
            : 0;

        // Attach scheduler records to each VIP employee
        $vips = $vips->map(function ($vip) use ($schedulerRecords) {
            $empId = (string) $vip['employee_id'];
            $vip['scheduler_records'] = array_key_exists($empId, $schedulerRecords)
                ? $schedulerRecords[$empId]
                : [];
            return $vip;
        });

        $now   = Carbon::now();
        $month = $request->integer('month', $now->month);
        $year  = $request->integer('year',  $now->year);
        $month = max(1, min(12, $month));

        $startOfMonth   = Carbon::createFromDate($year, $month, 1)->startOfMonth()->format('Y-m-d');
        $isCurrentMonth = $year === $now->year && $month === $now->month;
        $endDate        = $isCurrentMonth
            ? $now->format('Y-m-d')
            : Carbon::createFromDate($year, $month, 1)->endOfMonth()->format('Y-m-d');

        // ── Leaves ───────────────────────────────────────────────────────────
        $leaves     = $this->leaveService->getApprovedLeaves($vipEmployeeIds, $startOfMonth, $endDate);
        $leaveStats = $this->leaveService->calculateLeaveStats(collect($leaves));

        // ── OB / PB Records ───────────────────────────────────────────────────
        $obPbRecords    = $this->obRecordService->getApprovedRecords($vipEmployeeIds, $startOfMonth, $endDate);
        $obPbCollection = collect($obPbRecords);

        $obDatesByEmployee = [];
        $pbDatesByEmployee = [];

        foreach ($obPbCollection as $obRecord) {
            $empId          = (string) $obRecord['EMPID'];
            $formType       = strtolower($obRecord['FORM_TYPE']);
            $obStart        = Carbon::parse($obRecord['DATE_OB_FROM']);
            $obEnd          = Carbon::parse($obRecord['DATE_OB_TO']);
            $effectiveStart = Carbon::parse($startOfMonth)->max($obStart);
            $effectiveEnd   = Carbon::parse($endDate)->min($obEnd);

            if ($effectiveStart->lte($effectiveEnd)) {
                $period = CarbonPeriod::create($effectiveStart, $effectiveEnd);
                foreach ($period as $date) {
                    $dateStr = $date->format('Y-m-d');
                    if ($formType === 'ob') {
                        $obDatesByEmployee[$empId][] = $dateStr;
                    } elseif ($formType === 'pb') {
                        $pbDatesByEmployee[$empId][] = $dateStr;
                    }
                }
            }
        }

        // ── Attendance Logs ───────────────────────────────────────────────────
        $logs = $this->vipLogsService->getVipLogs($vipEmployeeIds, $startOfMonth, $endDate);

        $checkInLogs  = $logs->filter(fn($log) => $log['log_type'] === 'check_in');
        $checkOutLogs = $logs->filter(fn($log) => $log['log_type'] === 'check_out');

        $checkInByDate = $checkInLogs
            ->groupBy('log_date')
            ->map(fn($dayLogs) => $dayLogs->pluck('employee_id')->unique()->flip()->toArray());

        $checkOutByDate = $checkOutLogs
            ->groupBy('log_date')
            ->map(fn($dayLogs) => $dayLogs->pluck('employee_id')->unique()->flip()->toArray());

        // ── Build daily buckets ───────────────────────────────────────────────
        $dailyPresent     = [];
        $dailyOb          = [];
        $dailyAbsent      = [];
        $dailyAbsentChart = [];

        $periodDates = CarbonPeriod::create($startOfMonth, $endDate);

        // ── Build a per-employee, per-date Expected lookup from scheduler ─────
        $employeeExpectedDates = [];

        foreach ($schedulerRecords as $empId => $records) {
            foreach ($records as $record) {
                if (empty($record['schedule']) || !is_array($record['schedule'])) continue;
                if (!$record['payroll_date_start']) continue;

                $payrollStart = Carbon::parse($record['payroll_date_start']);

                foreach ($record['schedule'] as $dayNo => $shiftId) {
                    $schedDate = (clone $payrollStart)->addDays((int)$dayNo - 1);
                    $dateStr   = $schedDate->format('Y-m-d');

                    if ($dateStr < $startOfMonth || $dateStr > $endDate) continue;

                    $shiftInfo = $shiftCodeMap[(string)$shiftId] ?? null;
                    $shiftCode = $shiftInfo ? strtoupper($shiftInfo['shiftcode']) : '';
                    $isRestDay = str_contains($shiftCode, 'RD');

                    if (!$isRestDay) {
                        $employeeExpectedDates[$empId][$dateStr] = true;
                    }
                }
            }
        }

        // ── Build leaveDatesByEmployee with schedule awareness ────────────────
        $leaveDatesByEmployee = [];
        $scheduledLeaveDays   = 0;
        foreach (collect($leaves) as $leave) {
            $empId = (string) $leave['EMPLOYID'];
            foreach ($leave['ALL_DATES'] as $date) {
                if ($date >= $startOfMonth && $date <= $endDate) {
                    if (isset($employeeExpectedDates[$empId][$date])) {
                        $leaveDatesByEmployee[$empId][] = $date;
                        $scheduledLeaveDays++;
                    }
                }
            }
        }

        // ── Build pbDatesByEmployee with schedule awareness ───────────────────
        $scheduledPbDays = 0;
        foreach ($pbDatesByEmployee as $empId => $dates) {
            foreach ($dates as $date) {
                if (isset($employeeExpectedDates[$empId][$date])) {
                    $scheduledPbDays++;
                }
            }
        }

        // ── Build restDayDates with schedule awareness ────────────────────────
        $restDayDatesByEmployee = [];
        foreach ($schedulerRecords as $empId => $records) {
            foreach ($records as $record) {
                if (empty($record['schedule']) || !is_array($record['schedule'])) continue;
                if (!$record['payroll_date_start']) continue;

                $payrollStart = Carbon::parse($record['payroll_date_start']);

                foreach ($record['schedule'] as $dayNo => $shiftId) {
                    $schedDate = (clone $payrollStart)->addDays((int)$dayNo - 1);
                    $dateStr   = $schedDate->format('Y-m-d');

                    if ($dateStr < $startOfMonth || $dateStr > $endDate) continue;

                    $shiftInfo = $shiftCodeMap[(string)$shiftId] ?? null;
                    $shiftCode = $shiftInfo ? strtoupper($shiftInfo['shiftcode']) : '';

                    if (str_contains($shiftCode, 'RD')) {
                        $restDayDatesByEmployee[$empId][$dateStr] = true;
                    }
                }
            }
        }

        $scheduledRestDays = collect($restDayDatesByEmployee)
            ->sum(fn($dates) => count($dates));

        // ── Build daily buckets (only count employees who are Expected that day) ──
        foreach ($periodDates as $carbonDate) {
            if ($carbonDate->isFuture()) continue;

            $date           = $carbonDate->format('Y-m-d');
            $checkInsOnDay  = $checkInByDate[$date]  ?? [];
            $checkOutsOnDay = $checkOutByDate[$date] ?? [];

            $presentCount     = 0;
            $obCount          = 0;
            $absentCount      = 0;
            $absentChartCount = 0;

            foreach ($vipEmployeeIds as $empId) {
                $empId = (string) $empId;

                $isOnOb    = isset($obDatesByEmployee[$empId])
                    && in_array($date, $obDatesByEmployee[$empId]);
                $isOnLeave = isset($leaveDatesByEmployee[$empId])
                    && in_array($date, $leaveDatesByEmployee[$empId]);

                // Only process employees who are Expected that day
                $isExpected = isset($employeeExpectedDates[$empId][$date]);
                if (!$isExpected) continue;

                $hasCheckIn  = isset($checkInsOnDay[$empId]);
                $hasCheckOut = isset($checkOutsOnDay[$empId]);
                $hasAnyLog   = $hasCheckIn || $hasCheckOut;

                // OB — skip from present/absent, already counted separately
                if ($isOnOb) {
                    $obCount++;
                    continue;
                }

                // On Leave — counts toward chart/gauge only, NOT the stat card absent count
                if ($isOnLeave) {
                    $absentChartCount++;
                    continue;
                }

                // Not on OB, not on Leave — present if they have ANY log:
                //   • check-in only   → Present
                //   • check-out only  → Present
                //   • check-in + check-out → Present
                //   • no logs at all  → Absent
                if ($hasAnyLog) {
                    $presentCount++;
                } else {
                    $absentCount++;
                    $absentChartCount++;
                }
            }

            if ($presentCount     > 0) $dailyPresent[$date]     = $presentCount;
            if ($obCount          > 0) $dailyOb[$date]          = $obCount;
            if ($absentCount      > 0) $dailyAbsent[$date]      = $absentCount;
            if ($absentChartCount > 0) $dailyAbsentChart[$date] = $absentChartCount;
        }

        // ── Build sorted daily attendance array ───────────────────────────────
        $allDates = array_unique(array_merge(
            array_keys($dailyPresent),
            array_keys($dailyOb),
            array_keys($dailyAbsent),
            array_keys($dailyAbsentChart)
        ));
        sort($allDates);

        $dailyAttendance = collect($allDates)->map(fn($date) => [
            'date'        => $date,
            'present'     => $dailyPresent[$date]     ?? 0,
            'ob'          => $dailyOb[$date]          ?? 0,
            'absent'      => $dailyAbsent[$date]      ?? 0,
            'absentChart' => $dailyAbsentChart[$date] ?? 0,
        ])->values()->toArray();

        // ── Summaries ─────────────────────────────────────────────────────────
        $totalPresent = array_sum($dailyPresent);
        $totalOb      = array_sum($dailyOb);
        $totalAbsent  = array_sum($dailyAbsent);

        $totalDays = count(array_filter(
            $dailyAttendance,
            fn($d) => $d['present'] > 0 || $d['ob'] > 0 || $d['absent'] > 0
        ));

        $averagePresent = $totalDays > 0 ? round($totalPresent / $totalDays) : 0;
        $averageOb      = $totalDays > 0 ? round($totalOb      / $totalDays) : 0;
        $averageAbsent  = $totalDays > 0 ? round($totalAbsent  / $totalDays) : 0;

        // ── Per-employee daily attendance breakdown ───────────────────────────
        $employeeDailyAttendance = [];

        foreach ($vipEmployeeIds as $empId) {
            $empId      = (string) $empId;
            $empPresent = [];
            $empOb      = [];
            $empAbsent  = [];
            $empChart   = [];

            foreach ($periodDates as $carbonDate) {
                if ($carbonDate->isFuture()) continue;

                $date        = $carbonDate->format('Y-m-d');
                $isExpected  = isset($employeeExpectedDates[$empId][$date]);
                if (!$isExpected) continue;

                $isOnOb    = isset($obDatesByEmployee[$empId])
                    && in_array($date, $obDatesByEmployee[$empId]);
                $isOnLeave = isset($leaveDatesByEmployee[$empId])
                    && in_array($date, $leaveDatesByEmployee[$empId]);

                $hasCheckIn  = isset($checkInByDate[$date][$empId]);
                $hasCheckOut = isset($checkOutByDate[$date][$empId]);
                $hasAnyLog   = $hasCheckIn || $hasCheckOut;

                if ($isOnOb) {
                    $empOb[$date] = 1;
                } elseif ($isOnLeave) {
                    // Leave: chart/gauge only, not the absent stat card
                    $empChart[$date] = 1;
                } elseif ($hasAnyLog) {
                    // Any log (check-in only, check-out only, or both) = Present
                    $empPresent[$date] = 1;
                } else {
                    $empAbsent[$date] = 1;
                    $empChart[$date]  = 1;
                }
            }

            $allEmpDates = array_unique(array_merge(
                array_keys($empPresent),
                array_keys($empOb),
                array_keys($empAbsent),
                array_keys($empChart)
            ));

            if (empty($allEmpDates)) continue;

            sort($allEmpDates);

            $employeeDailyAttendance[$empId] = collect($allEmpDates)->map(fn($date) => [
                'date'        => $date,
                'present'     => $empPresent[$date] ?? 0,
                'ob'          => $empOb[$date]      ?? 0,
                'absent'      => $empAbsent[$date]  ?? 0,
                'absentChart' => $empChart[$date]   ?? 0,
            ])->values()->toArray();
        }

        // ── Per-employee leave and PB totals ──────────────────────────────────
        $employeeLeaveTotals = [];
        foreach ($leaveDatesByEmployee as $empId => $dates) {
            $employeeLeaveTotals[$empId] = count(array_unique($dates));
        }

        $employeePbTotals = [];
        foreach ($pbDatesByEmployee as $empId => $dates) {
            $filtered = array_filter($dates, fn($date) => isset($employeeExpectedDates[$empId][$date]));
            if (!empty($filtered)) {
                $employeePbTotals[$empId] = count(array_unique($filtered));
            }
        }

        return Inertia::render('Dashboard', [
            'tableData'    => ['vips' => $vips],
            'authUser'     => [
                'emp_id'       => session('emp_data.emp_id'),
                'emp_name'     => session('emp_data.emp_name'),
                'emp_dept'     => session('emp_data.emp_dept'),
                'emp_position' => session('emp_data.emp_position'),
            ],
            'shiftCodeMap' => $shiftCodeMap,
            'leaveStats'   => [
                'totalLeaveDays'    => $scheduledLeaveDays,
                'totalLeaveRecords' => $leaveStats['total_leave_records'],
            ],
            'pbStats' => [
                'totalPbDays' => $scheduledPbDays,
            ],
            'attendanceStats' => [
                'totalPresent'     => $totalPresent,
                'totalOb'          => $totalOb,
                'totalAbsent'      => $totalAbsent,
                'totalAbsentChart' => array_sum($dailyAbsentChart),
                'averagePresent'   => $averagePresent,
                'averageOb'        => $averageOb,
                'averageAbsent'    => $averageAbsent,
                'dailyAttendance'  => $dailyAttendance,
                'dailyExpected'    => $dailyExpectedFromScheduler,
                'dateFrom'         => $startOfMonth,
                'dateTo'           => $endDate,
                'perEmployee'      => $employeeDailyAttendance,
                'leaveTotals'      => $employeeLeaveTotals,
                'pbTotals'         => $employeePbTotals,
            ],
            'schedulerStats' => [
                'totalExpected'   => $totalExpectedFromScheduler,
                'averageExpected' => $avgExpectedFromScheduler,
                'dailyExpected'   => $dailyExpectedFromScheduler,
                'totalRestDays'   => $scheduledRestDays,
            ],
        ]);
    }
}