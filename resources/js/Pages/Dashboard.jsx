import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { DashboardOutlined, SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useState, useMemo, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const NAVBAR_HEIGHT    = 64;
const PADDING_VERTICAL = 32;

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// ─── Hook: read current DaisyUI theme ────────────────────────────────────────
function useTheme() {
    const [isDark, setIsDark] = useState(() =>
        document.documentElement.getAttribute("data-theme") === "dark"
    );
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        return () => observer.disconnect();
    }, []);
    return isDark;
}

/**
 * generateMonthlyMockData
 * Real values (present, ob, absent) override mock when available.
 */
const generateDailyData = (
    selectedMonth       = new Date().getMonth(),
    selectedYear        = new Date().getFullYear(),
    realDailyAttendance = [],
    realDailyExpected   = {},
    realDailyRestDay    = {}
) => {
    const currentDate  = new Date();
    const currentYear  = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay   = currentDate.getDate();
    const daysInMonth  = getDaysInMonth(selectedYear, selectedMonth);

    const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;
    const isFutureMonth  =
        selectedYear > currentYear ||
        (selectedYear === currentYear && selectedMonth > currentMonth);

    if (isFutureMonth) {
        return {
            dailyData:      [],
            daysCount:      0,
            daysInMonth,
            monthName:      new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'short' }),
            year:           selectedYear,
            isCurrentMonth: false,
            isFutureMonth:  true,
        };
    }

    const daysToGenerate = isCurrentMonth ? currentDay : daysInMonth;
    const monthName      = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'short' });

    const realDataByDate = {};
    realDailyAttendance.forEach(d => {
        realDataByDate[d.date] = {
            present:     d.present     ?? 0,
            ob:          d.ob          ?? 0,
            absent:      d.absent      ?? 0,
            absentChart: d.absentChart ?? 0,
        };
    });

    const dailyData = [];

for (let day = 1; day <= daysToGenerate; day++) {
        const mm             = String(selectedMonth + 1).padStart(2, '0');
        const dd             = String(day).padStart(2, '0');
        const key            = `${selectedYear}-${mm}-${dd}`;
        const entry          = realDataByDate[key];
        const hasExpected    = realDailyExpected[key] !== undefined;
        const hasAttendance  = entry !== undefined;



        const presentValue     = entry?.present     ?? 0;
        const obValue          = entry?.ob          ?? 0;
        const absentValue      = entry?.absent      ?? 0;
        const absentChartValue = entry?.absentChart ?? 0;

        const PresentPerDay  = presentValue + obValue;
        const AbsentPerDay   = absentChartValue;
        const ExpectedPerDay = realDailyExpected[key] ?? (PresentPerDay + AbsentPerDay);

        dailyData.push({
            day:          `${day}`,
            fullDate:     `${monthName} ${day}`,
            Present:      presentValue,
            Absent:       absentValue,
            AbsentChart:  absentChartValue,
            OB:           obValue,
            PresentPerDay,
            AbsentPerDay,
            ExpectedPerDay,
            RestDayPerDay: realDailyRestDay[key] ?? 0,
            date:         new Date(selectedYear, selectedMonth, day),
            isRealData:   hasAttendance,
        });
    }

    return {
        dailyData,
        daysCount:      daysToGenerate,
        daysInMonth,
        monthName,
        year:           selectedYear,
        isCurrentMonth,
        isFutureMonth:  false,
    };
};

// ─── GaugeChart ───────────────────────────────────────────────────────────────
function GaugeChart({ value, max, color, sublabel, percentage, isExpected = false, isDark }) {
    const [animatedPct, setAnimatedPct] = useState(0);
    const targetPct = isExpected ? 1 : Math.min(Math.max(value / (max || 1), 0), 1);

    useEffect(() => {
        setAnimatedPct(0);
        const timeout = setTimeout(() => {
            const start    = performance.now();
            const duration = 1000;
            const animate  = (now) => {
                const elapsed  = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased    = 1 - Math.pow(1 - progress, 3);
                setAnimatedPct(eased * targetPct);
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        }, 100);
        return () => clearTimeout(timeout);
    }, [targetPct]);

    const trackColor   = isDark ? "#374151" : "#e5e7eb";
    const needleColor  = isDark ? "#d1d5db" : "#374151";
    const needleCenter = isDark ? "#1f2937" : "white";
    const labelColor   = isDark ? "#9ca3af" : "#6b7280";

    const pct       = animatedPct;
    const cx = 80, cy = 85, r = 58, strokeW = 12;
    const toRad     = (deg) => (deg * Math.PI) / 180;
    const ptX       = (deg) => cx + r * Math.cos(toRad(deg));
    const ptY       = (deg) => cy - r * Math.sin(toRad(deg));
    const startX    = ptX(180), startY = ptY(180);
    const endX      = ptX(0),   endY   = ptY(0);
    const trackD    = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`;
    const needleDeg = 180 - pct * 180;
    const needleX   = ptX(needleDeg), needleY = ptY(needleDeg);
    const valueD    = isExpected
        ? `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`
        : pct > 0 ? `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${needleX} ${needleY}` : "";
    const needleLen = r - 10;
    const nx = cx + needleLen * Math.cos(toRad(needleDeg));
    const ny = cy - needleLen * Math.sin(toRad(needleDeg));

    return (
        <div className="flex flex-col items-center w-full">
            <svg viewBox="0 0 160 110" className="w-full max-h-32">
                <path d={trackD} fill="none" stroke={trackColor} strokeWidth={strokeW} strokeLinecap="round" />
                {pct > 0 && <path d={valueD} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />}
                {pct > 0 && (
                    <>
                        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth={3} strokeLinecap="round" />
                        <circle cx={cx} cy={cy} r={6} fill={needleColor} />
                        <circle cx={cx} cy={cy} r={3} fill={needleCenter} />
                    </>
                )}
                {pct === 0 && (
                    <>
                        <circle cx={cx} cy={cy} r={6} fill={needleColor} />
                        <circle cx={cx} cy={cy} r={3} fill={needleCenter} />
                    </>
                )}
                <text x={startX - 2} y={startY + 18} textAnchor="middle" fontSize={9} fill={labelColor}>0</text>
                <text x={endX + 2}   y={endY   + 18} textAnchor="middle" fontSize={9} fill={labelColor}>
                    {isExpected ? value : max}
                </text>
                <text x={cx} y={cy - 18} textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}>
                    {isExpected ? "100%" : percentage !== undefined ? `${percentage}%` : ""}
                </text>
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={8} fill={labelColor}>{sublabel}</text>
            </svg>
        </div>
    );
}

// ─── RingGraph ────────────────────────────────────────────────────────────────
function RingGraph({ value, color, label }) {
    const size        = 50;
    const strokeWidth = 4;
    const radius      = (size - strokeWidth) / 2;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.3" />
                    <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="bold" fill={color}>
                        {value}
                    </text>
                </svg>
            </div>
            <div className="text-center mt-1">
                <div className="text-[10px] font-medium text-base-content">{label}</div>
            </div>
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, isDark }) {
    if (!active || !payload || !payload.length) return null;

    const expected  = payload.find(p => p.dataKey === "ExpectedPerDay")?.value ?? 0;
    const present   = payload.find(p => p.dataKey === "PresentPerDay")?.value  ?? 0;
    const absent    = payload.find(p => p.dataKey === "AbsentPerDay")?.value   ?? 0;
    const restDay   = payload[0]?.payload?.RestDayPerDay ?? 0;
    const isRealDay = payload[0]?.payload?.isRealData;

    const presentPct = expected > 0 ? Math.round((present / expected) * 100) : 0;
    const absentPct  = expected > 0 ? Math.round((absent  / expected) * 100) : 0;

    const rows = [
        { key: "ExpectedPerDay", label: "Expected Per Day",                    color: "#8b5cf6", value: expected, pct: null       },
        { key: "PresentPerDay",  label: "Present Per Day (incl. OB)",           color: "#10b981", value: present,  pct: presentPct },
        { key: "AbsentPerDay",   label: "Absent Per Day (incl. Leave w/ logs)", color: "#ef4444", value: absent,   pct: absentPct  },
    ];

    const bg     = isDark ? "#1f2937" : "#ffffff";
    const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
    const text   = isDark ? "#f3f4f6" : "#111827";
    const muted  = isDark ? "#9ca3af" : "#6b7280";
    const divider = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

    return (
        <div style={{
            background: bg, border: `1px solid ${border}`, borderRadius: 8,
            padding: "8px 12px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            minWidth: 220, color: text,
        }}>
            <p style={{ fontWeight: 600, marginBottom: 4, color: text }}>
                Day {label}
                {isRealDay && (
                    <span style={{ marginLeft: 6, fontSize: 9, color: "#10b981", fontWeight: 400 }}>● live</span>
                )}
            </p>
            {rows.map(({ key, label: rowLabel, color, value: rowValue, pct }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: muted }}>{rowLabel}</span>
                    </span>
                    <span style={{ fontWeight: 600, color }}>
                        {rowValue}
                        {pct !== null && (
                            <span style={{ fontWeight: 400, color: muted, marginLeft: 4 }}>({pct}%)</span>
                        )}
                    </span>
                </div>
            ))}
            {restDay > 0 && (
                <>
                    <div style={{ borderTop: `1px solid ${divider}`, margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6b7280", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ color: muted }}>Rest Day</span>
                        </span>
                        <span style={{ fontWeight: 600, color: "#6b7280" }}>{restDay}</span>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ tableData, leaveStats, pbStats, attendanceStats, shiftCodeMap, schedulerStats, authUser }) {

    const isDark = useTheme();

    const [search,          setSearch]          = useState("");
    const [selectedVip,     setSelectedVip]     = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(() =>
        ["Operations", "Human Resource", "Security"].includes(authUser?.emp_dept)
    );
    const [scheduleModal,   setScheduleModal]   = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(
        () => parseInt(new URLSearchParams(window.location.search).get('month') ?? new Date().getMonth() + 1) - 1
    );
    const [selectedYear] = useState(
        () => parseInt(new URLSearchParams(window.location.search).get('year') ?? new Date().getFullYear())
    );

    const handleMonthChange = (monthIndex) => {
        setSelectedMonth(monthIndex);
        router.get(
            route('dashboard'),
            { month: monthIndex + 1, year: selectedYear },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const currentDate  = new Date();
    const currentYear  = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

const realDailyAttendance = attendanceStats?.dailyAttendance ?? [];
    const realDailyExpected   = attendanceStats?.dailyExpected   ?? {};

const todayStr      = new Date().toLocaleDateString('en-CA');
    const monthStartStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const monthEndStr   = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth + 1, 0).getDate()).padStart(2, '0')}`;

    // ── Per-employee schedule breakdown (no dependency on monthlyData) ────
    const selectedVipSchedule = useMemo(() => {
        if (!selectedVip) return null;

        const expectedDates = {};
        let totalExpected   = 0;
        let totalRestDays   = 0;

        (selectedVip.scheduler_records ?? []).forEach(record => {
            if (!record.payroll_date_start || !record.schedule) return;
            const base = new Date(record.payroll_date_start);
            Object.entries(record.schedule).forEach(([dayNo, shiftId]) => {
                const d = new Date(base);
                d.setDate(base.getDate() + parseInt(dayNo) - 1);
                const dateStr   = d.toLocaleDateString('en-CA');
                if (dateStr < monthStartStr || dateStr > monthEndStr || dateStr > todayStr) return;
                const shiftInfo = shiftCodeMap?.[shiftId] ?? null;
                const shiftcode = shiftInfo?.shiftcode ?? '';
                if (shiftcode.toUpperCase().includes('RD')) {
                    totalRestDays++;
                } else {
                    totalExpected++;
                    expectedDates[dateStr] = (expectedDates[dateStr] ?? 0) + 1;
                }
            });
        });

        return { expectedDates, totalExpected, totalRestDays };
    }, [selectedVip, monthStartStr, monthEndStr, todayStr, shiftCodeMap]);

const activeDailyAttendance = useMemo(() => {
        if (!selectedVip) return realDailyAttendance;
        // Use the per-employee daily attendance sent from the backend
        const empId = String(selectedVip.employee_id);
        return attendanceStats?.perEmployee?.[empId] ?? [];
    }, [selectedVip, realDailyAttendance, attendanceStats]);

const activeDailyExpected = useMemo(() => {
        if (!selectedVip) return realDailyExpected;
        return selectedVipSchedule?.expectedDates ?? {};
    }, [selectedVip, realDailyExpected, selectedVipSchedule]);

    const vips           = tableData?.vips ?? [];
    const totalEmployees = vips.length;
    const clearSearch    = () => setSearch("");

    const isOpsOrHR  = ["Operations", "Human Resource", "Security"].includes(authUser?.emp_dept);
    const isSelfOnly = !isOpsOrHR;

    const selfVip = useMemo(() => {
        if (!isSelfOnly) return null;
        return vips.find(v => String(v.employee_id) === String(authUser?.emp_id)) ?? null;
    }, [isSelfOnly, vips, authUser]);

    useEffect(() => {
        if (isSelfOnly && selfVip) {
            setSelectedVip(selfVip);
        }
    }, [isSelfOnly, selfVip]);

    const realDailyRestDay = useMemo(() => {
        if (!selectedVip) {
            const map = {};
            vips.forEach(v => {
                (v.scheduler_records ?? []).forEach(record => {
                    if (!record.payroll_date_start || !record.schedule) return;
                    const base = new Date(record.payroll_date_start);
                    Object.entries(record.schedule).forEach(([dayNo, shiftId]) => {
                        const d = new Date(base);
                        d.setDate(base.getDate() + parseInt(dayNo) - 1);
                        const dateStr   = d.toLocaleDateString('en-CA');
                        if (dateStr < monthStartStr || dateStr > monthEndStr || dateStr > todayStr) return;
                        const shiftInfo = shiftCodeMap?.[shiftId] ?? null;
                        const shiftcode = shiftInfo?.shiftcode ?? '';
                        if (shiftcode.toUpperCase().includes('RD')) {
                            map[dateStr] = (map[dateStr] ?? 0) + 1;
                        }
                    });
                });
            });
            return map;
        }

        const map = {};
        (selectedVip.scheduler_records ?? []).forEach(record => {
            if (!record.payroll_date_start || !record.schedule) return;
            const base = new Date(record.payroll_date_start);
            Object.entries(record.schedule).forEach(([dayNo, shiftId]) => {
                const d = new Date(base);
                d.setDate(base.getDate() + parseInt(dayNo) - 1);
                const dateStr   = d.toLocaleDateString('en-CA');
                if (dateStr < monthStartStr || dateStr > monthEndStr || dateStr > todayStr) return;
                const shiftInfo = shiftCodeMap?.[shiftId] ?? null;
                const shiftcode = shiftInfo?.shiftcode ?? '';
                if (shiftcode.toUpperCase().includes('RD')) {
                    map[dateStr] = (map[dateStr] ?? 0) + 1;
                }
            });
        });
        return map;
    }, [selectedVip, vips, monthStartStr, monthEndStr, todayStr, shiftCodeMap]);

    const monthlyData = useMemo(
        () => generateDailyData(selectedMonth, selectedYear, activeDailyAttendance, activeDailyExpected, realDailyRestDay),
        [selectedMonth, selectedYear, activeDailyAttendance, activeDailyExpected, realDailyRestDay]
    );

    const monthLabel = monthlyData.isFutureMonth
        ? "No Data Available"
        : new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const filteredVips = useMemo(
        () => vips.filter(v => v.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
        [search, vips]
    );

// ── Console: Work Scheduler with shift code values ────────────────────────
const [schedulerRestDayTotal, setSchedulerRestDayTotal] = useState(
        schedulerStats?.totalRestDays ?? 0
    );

useEffect(() => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd   = new Date(selectedYear, selectedMonth + 1, 0);
    const monthLabel = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });

    const monthStartStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const monthEndStr   = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth + 1, 0).getDate()).padStart(2, '0')}`;

    const formatSchedule = (schedule, payrollStart) => {
        if (!schedule || typeof schedule !== 'object') return [];
        const base = new Date(payrollStart);
        return Object.entries(schedule)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([dayNo, shiftId]) => {
                const d = new Date(base);
                d.setDate(base.getDate() + parseInt(dayNo) - 1);

                const shiftInfo   = shiftCodeMap?.[shiftId] ?? null;
                const timeWindows = shiftInfo?.time_windows ?? null;
                const shiftcode   = shiftInfo?.shiftcode    ?? '—';
                const isRestDay   = shiftcode.toUpperCase().includes('RD');

                return {
                    day_no:       parseInt(dayNo),
                    date:         d.toLocaleDateString('en-CA'),
                    shift_id:     shiftId,
                    shiftcode,
                    remark:       isRestDay ? 'Rest Day' : 'Expected',
                    check_in:     timeWindows?.check_in    ?? '—',
                    break_out_1:  timeWindows?.break_out_1 ?? '—',
                    break_in_1:   timeWindows?.break_in_1  ?? '—',
                    break_out_2:  timeWindows?.break_out_2 ?? '—',
                    break_in_2:   timeWindows?.break_in_2  ?? '—',
                    check_out:    timeWindows?.check_out   ?? '—',
                };
            });
    };

    const getMatchingRecords = (schedulerRecords) => {
        if (!Array.isArray(schedulerRecords)) return [];
        return schedulerRecords.filter(r => {
            if (!r.payroll_date_start || !r.payroll_date_end) return false;
            const pStart = new Date(r.payroll_date_start);
            const pEnd   = new Date(r.payroll_date_end);
            return pStart <= monthEnd && pEnd >= monthStart;
        });
    };

    const covered = filteredVips.filter(v =>
        getMatchingRecords(v.scheduler_records).length > 0
    );

    if (covered.length === 0) {
        console.log(`Work Scheduler — no employees covered in ${monthLabel} ${selectedYear}`);
        return;
    }

let grandTotalRestDays = 0;
let grandTotalExpected = 0;
const dailyExpectedMap  = {};
const todayStr          = new Date().toLocaleDateString('en-CA');

    console.group(`Work Scheduler — ${monthLabel} ${selectedYear} (${covered.length} employees covered)`);

    covered.forEach(v => {
        const matchingRecords = getMatchingRecords(v.scheduler_records);

        let totalRestDays = 0;
        let totalExpected = 0;
        const periodRows  = [];

        matchingRecords.forEach((record) => {
            const scheduleDays = formatSchedule(record.schedule, record.payroll_date_start);

            let periodRestDays = 0;
            let periodExpected = 0;

            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

            scheduleDays.forEach(day => {
                if (day.date < monthStartStr || day.date > monthEndStr) return;
                if (day.date > todayStr) return; // skip future dates

                if (day.remark === 'Rest Day') {
                    periodRestDays++;
                    totalRestDays++;
                } else {
                    periodExpected++;
                    totalExpected++;
                    dailyExpectedMap[day.date] = (dailyExpectedMap[day.date] ?? 0) + 1;
                }
            });

            periodRows.push({
                period:    `${record.payroll_date_start} → ${record.payroll_date_end}`,
                rest_days: periodRestDays,
                expected:  periodExpected,
            });
        });

        grandTotalRestDays += totalRestDays;
        grandTotalExpected += totalExpected;

        console.group(
            `${v.name} [ID: ${v.employee_id}]  ` +
            `(${matchingRecords.length} record${matchingRecords.length > 1 ? 's' : ''})  |  ` +
            `Rest Days: ${totalRestDays}  |  Expected: ${totalExpected}`
        );

        console.table(periodRows);

        matchingRecords.forEach((record, idx) => {
            const scheduleDays = formatSchedule(record.schedule, record.payroll_date_start);
            const label = `Period ${idx + 1}: ${record.payroll_date_start} → ${record.payroll_date_end}`;

            if (scheduleDays.length > 0) {
                console.group(label);
                console.table(scheduleDays);
                console.groupEnd();
            } else {
                console.log(`${label} — (no schedule data)`);
            }
        });

        console.groupEnd();
    });

    console.log(
        `%cTotals — ${monthLabel} ${selectedYear}:  Rest Days = ${grandTotalRestDays}  |  Expected = ${grandTotalExpected}`,
        'font-weight: bold; color: #10b981;'
    );

// Build a per-day breakdown: who was Expected vs Rest Day
const dailyBreakdownMap = {};

covered.forEach(v => {
    const matchingRecords = getMatchingRecords(v.scheduler_records);
    matchingRecords.forEach(record => {
        const scheduleDays = formatSchedule(record.schedule, record.payroll_date_start);
        scheduleDays.forEach(day => {
            if (day.date < monthStartStr || day.date > monthEndStr) return;
            if (day.date > todayStr) return;

            if (!dailyBreakdownMap[day.date]) {
                dailyBreakdownMap[day.date] = { expected: [], rest_day: [] };
            }

            if (day.remark === 'Rest Day') {
                dailyBreakdownMap[day.date].rest_day.push(v.name);
            } else {
                dailyBreakdownMap[day.date].expected.push(v.name);
            }
        });
    });
});

const dailyExpectedRows = Object.entries(dailyBreakdownMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { expected, rest_day }]) => ({
        date,
        expected_count: expected.length,
        rest_day_count: rest_day.length,
        expected_employees: expected.join(', ') || '—',
        rest_day_employees: rest_day.join(', ') || '—',
    }));

if (dailyExpectedRows.length > 0) {
    console.group(`Daily Expected vs Rest Day — ${monthLabel} ${selectedYear}`);
    console.table(dailyExpectedRows);
    console.groupEnd();
}

    console.groupEnd();

    setSchedulerRestDayTotal(grandTotalRestDays);
}, [filteredVips, selectedMonth, selectedYear, shiftCodeMap]);

const daysCount   = monthlyData.daysCount;
    const daysInMonth = monthlyData.daysInMonth;

const activeStats = useMemo(() => {
        if (!selectedVip) {
        return {
            totalPresent:     attendanceStats?.totalPresent     ?? 0,
            totalOb:          attendanceStats?.totalOb          ?? 0,
            totalAbsent:      attendanceStats?.totalAbsent      ?? 0,
            totalAbsentChart: attendanceStats?.totalAbsentChart ?? 0,
            totalOnLeave:     leaveStats?.totalLeaveDays        ?? 0,
            totalPb:          pbStats?.totalPbDays              ?? 0,
            avgPresent:       attendanceStats?.averagePresent   ?? 0,
            avgOb:            attendanceStats?.averageOb        ?? 0,
            avgAbsent:        attendanceStats?.averageAbsent    ?? 0,
            totalExpected:    schedulerStats?.totalExpected     ?? null,
            avgExpected:      schedulerStats?.averageExpected   ?? null,
            totalRestDays:    schedulerStats?.totalRestDays     ?? 0,
        };
        }

// Use pre-computed schedule data — no dependency on monthlyData
        const empExpected  = selectedVipSchedule?.totalExpected ?? 0;
        const empRestDays  = selectedVipSchedule?.totalRestDays ?? 0;
        const empDaysCount = Object.keys(selectedVipSchedule?.expectedDates ?? {}).length;

        // Pull per-employee stats directly from backend breakdown
        const empId      = String(selectedVip.employee_id);
        const empDailyRows = attendanceStats?.perEmployee?.[empId] ?? [];

        let empPresent = 0, empOb = 0, empAbsent = 0, empAbsentChart = 0;
        empDailyRows.forEach(d => {
            empPresent     += d.present     ?? 0;
            empOb          += d.ob          ?? 0;
            empAbsent      += d.absent      ?? 0;
            empAbsentChart += d.absentChart ?? 0;
        });

        const empOnLeave = attendanceStats?.leaveTotals?.[empId] ?? 0;
        const empPb      = attendanceStats?.pbTotals?.[empId]    ?? 0;

        return {
            totalPresent:     empPresent,
            totalOb:          empOb,
            totalAbsent:      empAbsent,
            totalAbsentChart: empAbsentChart,
            totalOnLeave:     empOnLeave,
            totalPb:          empPb,
            avgPresent:       empDaysCount > 0 ? Math.round(empPresent  / empDaysCount) : 0,
            avgOb:            empDaysCount > 0 ? Math.round(empOb       / empDaysCount) : 0,
            avgAbsent:        empDaysCount > 0 ? Math.round(empAbsent   / empDaysCount) : 0,
            totalExpected:    empExpected,
            avgExpected:      empDaysCount > 0 ? Math.round(empExpected / empDaysCount) : 0,
            totalRestDays:    empRestDays,
        };
    }, [selectedVip, selectedVipSchedule, attendanceStats, leaveStats, pbStats, schedulerStats]);

    const totalPresent     = activeStats.totalPresent;
    const totalOb          = activeStats.totalOb;
    const totalAbsent      = activeStats.totalAbsent;
    const totalAbsentChart = activeStats.totalAbsentChart;
    const totalOnLeave     = activeStats.totalOnLeave;
    const totalPb          = activeStats.totalPb;
    const avgPresent       = activeStats.avgPresent;
    const avgOb            = activeStats.avgOb;
    const avgAbsent        = activeStats.avgAbsent;

    // Now safe to reference activeStats since it's fully resolved above
    const displayRestDayTotal = selectedVip
        ? activeStats.totalRestDays
        : schedulerRestDayTotal;

    const realExpectedTotal = activeStats.totalExpected;
    const realAvgExpected   = activeStats.avgExpected;

    const expectedTotal    = realExpectedTotal ?? (totalPresent + totalOb + totalAbsent + totalOnLeave);
    const dailyExpectedAvg = realAvgExpected   ?? (daysCount > 0 ? Math.round(expectedTotal / daysCount) : 0);

    // For gauge charts, use only Present and Absent (without OB and On Leave)
    const presentTotalForGauge   = totalPresent;
    const absentTotalForGauge    = totalAbsentChart;
    const presentPlusAbsentTotal = presentTotalForGauge + absentTotalForGauge;

    const presentPercentForGauge = presentPlusAbsentTotal > 0 
        ? ((presentTotalForGauge / presentPlusAbsentTotal) * 100).toFixed(2) 
        : "0.00";

    const absentPercentForGauge = presentPlusAbsentTotal > 0 
        ? ((absentTotalForGauge / presentPlusAbsentTotal) * 100).toFixed(2) 
        : "0.00";

    const axisTickColor = isDark ? "#9ca3af" : "#6b7280";
    const gridColor     = isDark ? "#374151" : "#e5e7eb";

const stats = [
        {
            label: "Rest Day", value: displayRestDayTotal, avgValue: 0,
            isReal: displayRestDayTotal > 0, color: "text-gray-500 dark:text-gray-400",
            badgeColor: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
        },
        {
            label: "Expected", value: expectedTotal, avgValue: dailyExpectedAvg,
            isReal: realExpectedTotal !== null, color: "text-purple-600 dark:text-purple-400",
            badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        },
        {
            label: "Present", value: totalPresent, avgValue: avgPresent,
            isReal: true, color: "text-emerald-600 dark:text-emerald-400",
            badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: "Absent", value: totalAbsent, avgValue: avgAbsent,
            isReal: true, color: "text-red-600 dark:text-red-400",
            badgeColor: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: "On Leave", value: totalOnLeave, avgValue: 0,
            isReal: true, color: "text-blue-600 dark:text-blue-400",
            badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        },
        {
            label: "Official Business", value: totalOb, avgValue: avgOb,
            isReal: true, color: "text-green-600 dark:text-green-400",
            badgeColor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
        },
        {
            label: "Personal Business", value: totalPb, avgValue: 0,
            isReal: true, color: "text-purple-600 dark:text-purple-400",
            badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
        },
    ];

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    const availableMonths = useMemo(() => {
        const months = [];
        for (let i = 0; i <= currentMonth; i++) months.push({ index: i, name: monthNames[i], year: currentYear });
        return months;
    }, [currentMonth, currentYear]);

    const getTickInterval = (n) => {
        if (n <= 10) return 1; if (n <= 15) return 2;
        if (n <= 20) return 3; if (n <= 25) return 4;
        return 5;
    };
    const tickInterval = getTickInterval(daysCount);
    const ticks = useMemo(() => {
        if (daysCount === 0) return [];
        const t = [];
        for (let i = 1; i <= daysCount; i += tickInterval) t.push(i.toString());
        if (daysCount > 0 && daysCount % tickInterval !== 0) t.push(daysCount.toString());
        return t;
    }, [daysCount, tickInterval]);

    return (
            <AuthenticatedLayout user={authUser}>
            <Head title="Dashboard" />

            <div className="overflow-hidden flex p-4" style={{ height: `calc(100vh - ${NAVBAR_HEIGHT}px - ${PADDING_VERTICAL}px)` }}>
                <div className="flex-1 flex flex-col min-h-0 border border-base-300 rounded-lg bg-base-100 shadow-sm">

                    {/* ── Header ──────────────────────────────────────────── */}
                    <div className="px-4 py-6 border-b border-base-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSidebarOpen(prev => !prev)}
                                    className="btn btn-ghost btn-sm"
                                    title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                                >
                                    {sidebarOpen ? <MenuFoldOutlined className="text-lg" /> : <MenuUnfoldOutlined className="text-lg" />}
                                </button>
                                <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
                                    <DashboardOutlined className="mr-1 text-yellow-500" />
                                    Dashboard
                                    <button
                                        onClick={() => setScheduleModal(true)}
                                        className="btn btn-sm btn-outline border-base-300 text-base-content hover:bg-base-200 gap-1.5 font-medium"
                                        style={{ fontSize: "clamp(8px, 0.75vw, 13px)" }}
                                        title="View Employee Work Schedules"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Work Schedule
                                    </button>
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 flex-nowrap">
                                <span className="text-base-content opacity-70 text-sm whitespace-nowrap">Viewing:</span>
                                <select
                                    className="select select-bordered select-sm bg-base-200 text-base-content min-w-[140px]"
                                    style={{ padding: 0 }}
                                    value={selectedMonth}
                                    onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                                >
                                    {availableMonths.map(({ index, name, year }) => (
                                        <option key={name} value={index}>{name} {year}</option>
                                    ))}
                                </select>
                                {monthlyData.isCurrentMonth && (
                                    <span className="badge badge-primary badge-sm shrink-0 whitespace-nowrap">Current Month</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">

                        {/* ── Sidebar ───────────────────────────────────────── */}
                        <aside className={`border-r border-base-300 flex flex-col bg-base-200 transition-all duration-300 overflow-hidden shrink-0
                            ${sidebarOpen ? "w-36 sm:w-44 md:w-52 xl:w-72 p-2 xl:p-4" : "w-0 p-0"}`}>
                            {sidebarOpen && (
                            <>
                                {isSelfOnly ? (
                                    <div className="flex-1 overflow-auto">
                                        <ul className="space-y-0.5">
                                            {selfVip ? (
                                                <li
                                                    className="rounded-lg font-medium text-base-content bg-primary text-primary-content cursor-default"
                                                    style={{ fontSize: "clamp(7px, 0.7vw, 14px)", padding: "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)" }}
                                                >
                                                    {selfVip.name}
                                                </li>
                                            ) : (
                                                <li className="text-base-content opacity-50 text-xs p-2">
                                                    Not in VIP list
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative w-full mb-2 xl:mb-4">
                                            <div
                                                className="flex items-center gap-1 w-full border border-base-300 rounded-lg bg-base-100"
                                                style={{ padding: "clamp(4px, 0.5vw, 12px) clamp(6px, 0.8vw, 16px)" }}
                                            >
                                                <SearchOutlined className="text-base-content opacity-70 shrink-0" style={{ fontSize: "clamp(8px, 0.8vw, 16px)" }} />
                                                <input
                                                    type="text"
                                                    className="grow bg-transparent text-base-content focus:outline-none min-w-0"
                                                    placeholder="Search..."
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    style={{ fontSize: "clamp(7px, 0.7vw, 14px)" }}
                                                />
                                                {search && (
                                                    <button onClick={clearSearch} className="btn btn-ghost btn-xs text-base-content px-1 shrink-0" type="button" style={{ fontSize: "clamp(6px, 0.6vw, 12px)" }}>
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {search && (
                                                <div className="absolute top-full mt-1 text-base-content opacity-70 truncate w-full" style={{ fontSize: "clamp(6px, 0.6vw, 12px)" }}>
                                                    Searching: "{search}"
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-auto">
                                            <ul className="space-y-0.5">
                                                <li
                                                    onClick={() => setSelectedVip(null)}
                                                    className={`rounded-lg cursor-pointer font-medium flex items-center justify-between text-base-content
                                                        ${selectedVip === null ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
                                                    style={{ padding: "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)" }}
                                                >
                                                    <span className="truncate" style={{ fontSize: "clamp(7px, 0.7vw, 14px)" }}>All Employees</span>
                                                    <span
                                                        className={`ml-1 rounded-full shrink-0 font-medium ${selectedVip === null ? "bg-primary-content/20 text-primary-content" : "bg-base-300 text-base-content"}`}
                                                        style={{ fontSize: "clamp(6px, 0.6vw, 12px)", padding: "1px clamp(3px, 0.4vw, 8px)" }}
                                                    >
                                                        {totalEmployees}
                                                    </span>
                                                </li>
                                                {filteredVips.map(vip => (
                                                    <li
                                                        key={vip.id}
                                                        onClick={() => setSelectedVip(vip)}
                                                        className={`rounded-lg cursor-pointer text-base-content truncate
                                                            ${selectedVip?.id === vip.id ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
                                                        style={{ fontSize: "clamp(7px, 0.7vw, 14px)", padding: "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)" }}
                                                    >
                                                        {vip.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        </aside>

                        {/* ── Main Content ─────────────────────────────────── */}
                        <div className="flex-1 p-2 xl:p-4 overflow-auto min-w-0 flex flex-col gap-2 xl:gap-4">

                            {/* Stats Grid */}
                            <div className="grid grid-cols-7 gap-1 w-full">
                                {stats.map(({ label, value, color, badgeColor, icon, isReal }) => (
                                    <div key={label} className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow duration-300 min-w-0 overflow-hidden">
                                        <div className="card-body p-1.5 xl:p-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1">
                                                    <div className="shrink-0 flex items-center justify-center" style={{ padding: "clamp(2px, 0.4vw, 10px)" }}>
                                                        <div style={{ width: "clamp(16px, 1.5vw, 32px)", height: "clamp(16px, 1.5vw, 32px)" }} className="[&>svg]:w-full [&>svg]:h-full">
                                                            {icon}
                                                        </div>
                                                    </div>
                                                    <p className="text-base-content opacity-60 font-medium leading-tight break-words min-w-0" style={{ fontSize: "clamp(7px, 0.7vw, 13px)" }}>
                                                        {label}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <span className={`font-bold leading-none ${color}`} style={{ fontSize: "clamp(11px, 1.4vw, 28px)" }}>
                                                            {value}
                                                        </span>
                                                        <span
                                                            className="shrink-0 rounded-full"
                                                            style={{
                                                                width: "clamp(5px, 0.45vw, 8px)",
                                                                height: "clamp(5px, 0.45vw, 8px)",
                                                                background: isReal ? "#10b981" : (isDark ? "#4b5563" : "#d1d5db"),
                                                                marginBottom: 2,
                                                            }}
                                                            title={isReal ? "Live data" : "Estimated data"}
                                                        />
                                                    </div>
                                                    <span className={`font-medium rounded-full whitespace-nowrap self-start ${badgeColor}`}
                                                        style={{ fontSize: "clamp(6px, 0.55vw, 11px)", padding: "2px clamp(3px, 0.4vw, 8px)" }}>
                                                        {monthLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Gauges */}
                            <div className="grid grid-cols-1 gap-1 w-full">
                                <div className="card bg-base-100 border border-base-300 shadow-sm min-w-0 overflow-hidden">
                                    <div className="card-body p-2 xl:p-3">
                                        <h2 className="font-semibold text-base-content mb-3" style={{ fontSize: "clamp(8px, 0.8vw, 14px)" }}>
                                            {monthlyData.isFutureMonth
                                                ? "No Data Available for Future Months"
                                                : `Monthly Attendance Overview (${monthLabel})`}
                                        </h2>
                                        {!monthlyData.isFutureMonth && daysCount > 0 && (
                                            <div className="flex items-center justify-center gap-2 w-full">
                                                <div className="flex-1 flex flex-col items-center">
                                                    <GaugeChart value={expectedTotal} max={expectedTotal} color="#8b5cf6" sublabel="Expected Employees" isExpected={true} isDark={isDark} />
                                                </div>
                                                <div className="flex flex-col items-center" style={{ marginTop: '-30px' }}>
                                                    <RingGraph value={displayRestDayTotal} color="#6b7280" label="Rest Day" />
                                                </div>
                                                                                                <div className="flex-1 flex flex-col items-center">
                                                    <GaugeChart value={presentTotalForGauge} max={presentPlusAbsentTotal} color="#10b981" sublabel="Present" percentage={presentPercentForGauge} isDark={isDark} />
                                                </div>
                                                <div className="flex flex-col items-center" style={{ marginTop: '-30px' }}>
                                                    <RingGraph value={totalPb} color="#a855f7" label="Personal Business" />
                                                </div>
                                                <div className="flex-1 flex flex-col items-center">
                                                    <GaugeChart value={absentTotalForGauge} max={presentPlusAbsentTotal} color="#ef4444" sublabel="Absent" percentage={absentPercentForGauge} isDark={isDark} />
                                                </div>
                                            </div>
                                        )}
                                        {monthlyData.isFutureMonth && (
                                            <div className="flex items-center justify-center h-32 text-base-content opacity-50">
                                                Select a past or current month to view data
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Line Chart */}
                            <div className="grid grid-cols-6 gap-1 w-full">
                                <div className="col-span-6 card bg-base-100 border border-base-300 shadow-sm min-w-0 overflow-hidden flex flex-col">
                                    <div className="card-body p-2 xl:p-4 flex flex-col" style={{ height: "clamp(250px, 30vh, 350px)" }}>
                                        <div className="flex items-center justify-between mb-1 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-semibold text-base-content" style={{ fontSize: "clamp(9px, 0.85vw, 15px)" }}>
                                                    {monthlyData.isFutureMonth ? "No Data Available" : `Daily Attendance Trend - ${monthLabel}`}
                                                </h2>
                                                {!monthlyData.isFutureMonth && daysCount > 0 && (
                                                    <>
                                                        <span className="text-base-content opacity-50" style={{ fontSize: "clamp(7px, 0.65vw, 12px)" }}>
                                                            Days 1-{daysCount} of {daysInMonth}
                                                        </span>
                                                        <span className="badge badge-sm badge-primary">{daysCount} Days</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {!monthlyData.isFutureMonth && daysCount > 0 ? (
                                            <>
                                                <div className="flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={monthlyData.dailyData} margin={{ top: 4, right: 20, left: 8, bottom: 10 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.5} />
                                                            <XAxis
                                                                dataKey="day"
                                                                tick={{ fontSize: 8, fill: axisTickColor }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                interval={0}
                                                                ticks={ticks}
                                                                angle={-45}
                                                                textAnchor="end"
                                                                height={50}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 9, fill: axisTickColor }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                orientation="right"
                                                            />
                                                            <Tooltip content={(props) => <ChartTooltip {...props} isDark={isDark} />} />
                                                            <Legend wrapperStyle={{ fontSize: 9, color: axisTickColor }} />

                                                            <Line
                                                                type="monotone"
                                                                dataKey="ExpectedPerDay"
                                                                name="Expected Per Day"
                                                                stroke="#8b5cf6"
                                                                strokeWidth={2}
                                                                strokeDasharray="5 3"
                                                                dot={{ r: 1.5 }}
                                                                activeDot={{ r: 4 }}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey="PresentPerDay"
                                                                name="Present Per Day (incl. OB)"
                                                                stroke="#10b981"
                                                                strokeWidth={2}
                                                                dot={({ cx, cy, payload }) => (
                                                                    <circle
                                                                        key={`dot-present-${payload.day}`}
                                                                        cx={cx} cy={cy}
                                                                        r={payload.isRealData ? 2.5 : 1.5}
                                                                        fill={payload.isRealData ? "#10b981" : "#a7f3d0"}
                                                                        stroke={payload.isRealData ? "#059669" : "none"}
                                                                        strokeWidth={1}
                                                                    />
                                                                )}
                                                                activeDot={{ r: 4 }}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey="AbsentPerDay"
                                                                name="Absent Per Day (incl. Leave w/ logs)"
                                                                stroke="#ef4444"
                                                                strokeWidth={2}
                                                                dot={({ cx, cy, payload }) => (
                                                                    <circle
                                                                        key={`dot-absent-${payload.day}`}
                                                                        cx={cx} cy={cy}
                                                                        r={payload.isRealData ? 2.5 : 1.5}
                                                                        fill={payload.isRealData ? "#ef4444" : "#fecaca"}
                                                                        stroke={payload.isRealData ? "#dc2626" : "none"}
                                                                        strokeWidth={1}
                                                                    />
                                                                )}
                                                                activeDot={{ r: 4 }}
                                                            />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                {/* Month progress bar */}
                                                <div className="mt-2 pt-1 border-t border-base-300">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-base-content opacity-60">Month Progress:</span>
                                                        <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary rounded-full" style={{ width: `${(daysCount / daysInMonth) * 100}%` }} />
                                                        </div>
                                                        <span className="text-xs font-medium text-base-content">{daysCount}/{daysInMonth} days</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-base-content opacity-50">
                                                {monthlyData.isFutureMonth ? "Future months are not available yet" : "No data available for this month"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
{/* ── Work Schedule Modal ───────────────────────────────────── */}
            {scheduleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
                    onClick={(e) => { if (e.target === e.currentTarget) setScheduleModal(false); }}
                >
<div className="bg-base-100 rounded-xl shadow-2xl border border-base-300 flex flex-col"
                        style={{ width: "min(98vw, 1400px)", maxHeight: "90vh" }}>

{/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-base-content">Work Schedule Overview</h2>
                                <p className="text-xs text-base-content opacity-50 mt-0.5">
                                    {new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                    {" — "}{vips.length} employees
                                </p>
                            </div>
                            <button onClick={() => setScheduleModal(false)} className="btn btn-ghost btn-sm btn-circle">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-base-300 shrink-0 bg-base-200">
                            <span className="text-xs text-base-content opacity-60 font-medium">Legend:</span>
                            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Has Schedule
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> No Schedule
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> Expected
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-gray-400 inline-block" /> Rest Day
                            </span>
                        </div>

                        {/* Employee List */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-base-200 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 text-base-content opacity-60 font-semibold w-44">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-base-content opacity-60 font-semibold w-28">Status</th>
                                        <th className="text-center px-3 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold w-20">Present</th>
                                        <th className="text-center px-3 py-2.5 text-red-500 dark:text-red-400 font-semibold w-20">Absent</th>
                                        <th className="text-center px-3 py-2.5 text-blue-600 dark:text-blue-400 font-semibold w-20">On Leave</th>
                                        <th className="text-center px-3 py-2.5 text-green-600 dark:text-green-400 font-semibold w-16">OB</th>
                                        <th className="text-left px-3 py-2.5 text-base-content opacity-60 font-semibold">Schedule Periods</th>
                                        <th className="text-center px-3 py-2.5 text-purple-600 dark:text-purple-400 font-semibold w-20">Expected</th>
                                        <th className="text-center px-3 py-2.5 text-gray-500 font-semibold w-20">Rest Days</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vips.map((vip, idx) => {
                                        const matchingRecords = (vip.scheduler_records ?? []).filter(r => {
                                            if (!r.payroll_date_start || !r.payroll_date_end) return false;
                                            return r.payroll_date_start <= monthEndStr
                                                && r.payroll_date_end   >= monthStartStr;
                                        });

                                        const hasSchedule = matchingRecords.length > 0;

                                        // Count expected and rest days for this employee this month
                                        let empExpected = 0, empRestDays = 0;
                                        matchingRecords.forEach(record => {
                                            if (!record.payroll_date_start || !record.schedule) return;
                                            const base = new Date(record.payroll_date_start);
                                            Object.entries(record.schedule).forEach(([dayNo, shiftId]) => {
                                                const d = new Date(base);
                                                d.setDate(base.getDate() + parseInt(dayNo) - 1);
                                                const dateStr   = d.toLocaleDateString('en-CA');
                                                if (dateStr < monthStartStr || dateStr > monthEndStr || dateStr > todayStr) return;
                                                const shiftInfo = shiftCodeMap?.[shiftId] ?? null;
                                                const shiftcode = shiftInfo?.shiftcode ?? '';
                                                if (shiftcode.toUpperCase().includes('RD')) {
                                                    empRestDays++;
                                                } else {
                                                    empExpected++;
                                                }
                                            });
                                        });

                                        // Pull per-employee attendance stats from backend
                                        const empId        = String(vip.employee_id);
                                        const empDailyRows = attendanceStats?.perEmployee?.[empId] ?? [];
                                        let modalPresent = 0, modalAbsent = 0, modalOb = 0;
                                        empDailyRows.forEach(d => {
                                            modalPresent += d.present ?? 0;
                                            modalAbsent  += d.absent  ?? 0;
                                            modalOb      += d.ob      ?? 0;
                                        });
                                        const modalOnLeave = attendanceStats?.leaveTotals?.[empId] ?? 0;

                                        return (
                                            <tr key={vip.id}
                                                className={`border-b border-base-200 hover:bg-base-200 transition-colors cursor-pointer
                                                    ${selectedVip?.id === vip.id ? "bg-primary/10" : idx % 2 === 0 ? "bg-base-100" : "bg-base-50"}`}
                                                onClick={() => { setSelectedVip(vip); setScheduleModal(false); }}
                                            >
                                                {/* Employee name */}
                                                <td className="px-4 py-2.5">
                                                    <div className="font-medium text-base-content truncate max-w-[160px]" title={vip.name}>
                                                        {vip.name}
                                                    </div>
                                                    <div className="text-base-content opacity-40 text-[10px]">{vip.job ?? "—"}</div>
                                                </td>

                                                {/* Has / No schedule badge */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {hasSchedule ? (
                                                        <span className="inline-flex items-center gap-1 badge badge-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 whitespace-nowrap">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Scheduled
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 badge badge-sm bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 border-0 whitespace-nowrap">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            No Schedule
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Present */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{modalPresent}</span>
                                                </td>

                                                {/* Absent */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="font-bold text-red-500 dark:text-red-400">{modalAbsent}</span>
                                                </td>

                                                {/* On Leave */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{modalOnLeave}</span>
                                                </td>

                                                {/* OB */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="font-bold text-green-600 dark:text-green-400">{modalOb}</span>
                                                </td>

                                                {/* Daily schedule chips for the selected month */}
                                                <td className="px-3 py-2.5">
                                                    {(() => {
                                                        // Build a date → remark map from all matching records
                                                        const dateRemarkMap = {};
                                                        matchingRecords.forEach(record => {
                                                            if (!record.payroll_date_start || !record.schedule) return;
                                                            const base = new Date(record.payroll_date_start);
                                                            Object.entries(record.schedule).forEach(([dayNo, shiftId]) => {
                                                                const d = new Date(base);
                                                                d.setDate(base.getDate() + parseInt(dayNo) - 1);
                                                                const dateStr = d.toLocaleDateString('en-CA');
                                                                if (dateStr < monthStartStr || dateStr > monthEndStr) return;
                                                                const shiftInfo = shiftCodeMap?.[shiftId] ?? null;
                                                                const shiftcode = shiftInfo?.shiftcode ?? '';
                                                                dateRemarkMap[dateStr] = shiftcode.toUpperCase().includes('RD') ? 'RD' : 'E';
                                                            });
                                                        });

                                                        // Generate chips for every day in the selected month up to today
                                                        const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                                                        const chips = [];

                                                        for (let day = 1; day <= daysInSelectedMonth; day++) {
                                                            const dd      = String(day).padStart(2, '0');
                                                            const mm      = String(selectedMonth + 1).padStart(2, '0');
                                                            const dateStr = `${selectedYear}-${mm}-${dd}`;
                                                            const remark  = dateRemarkMap[dateStr];

                                                            // Determine chip style
                                                            let label, chipStyle;
                                                            if (remark === 'E') {
                                                                label     = 'E';
                                                                chipStyle = {
                                                                    background: isDark ? "#1d4035" : "#d1fae5",
                                                                    color:      isDark ? "#6ee7b7" : "#065f46",
                                                                };
                                                            } else if (remark === 'RD') {
                                                                label     = 'RD';
                                                                chipStyle = {
                                                                    background: isDark ? "#1f2937" : "#f3f4f6",
                                                                    color:      isDark ? "#9ca3af" : "#4b5563",
                                                                };
                                                            } else {
                                                                label     = 'NS';
                                                                chipStyle = {
                                                                    background: isDark ? "#2d1515" : "#fee2e2",
                                                                    color:      isDark ? "#f87171" : "#991b1b",
                                                                };
                                                            }

                                                            chips.push(
                                                                <span
                                                                    key={dateStr}
                                                                    title={`${dateStr} — ${remark === 'E' ? 'Expected' : remark === 'RD' ? 'Rest Day' : 'No Schedule'}`}
                                                                    style={{
                                                                        ...chipStyle,
                                                                        display:       "inline-flex",
                                                                        flexDirection: "column",
                                                                        alignItems:    "center",
                                                                        borderRadius:  4,
                                                                        padding:       "1px 3px",
                                                                        fontSize:      9,
                                                                        fontWeight:    600,
                                                                        lineHeight:    1.3,
                                                                        minWidth:      22,
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.7 }}>{day}</span>
                                                                    <span>{label}</span>
                                                                </span>
                                                            );
                                                        }

                                                        return (
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                                                {chips}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Expected count */}
                                                <td className="px-3 py-2.5 text-center">
                                                    {hasSchedule ? (
                                                        <span className="font-bold text-purple-600 dark:text-purple-400">{empExpected}</span>
                                                    ) : (
                                                        <span className="text-base-content opacity-30">—</span>
                                                    )}
                                                </td>

                                                {/* Rest Day count */}
                                                <td className="px-3 py-2.5 text-center">
                                                    {hasSchedule ? (
                                                        <span className="font-bold text-gray-500 dark:text-gray-400">{empRestDays}</span>
                                                    ) : (
                                                        <span className="text-base-content opacity-30">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-base-300 shrink-0 flex items-center justify-between bg-base-200">
                            <span className="text-xs text-base-content opacity-50">
                                Click any employee to select and view their data
                            </span>
                            <button onClick={() => setScheduleModal(false)} className="btn btn-sm btn-ghost">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}