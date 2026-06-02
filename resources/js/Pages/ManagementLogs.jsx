import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import {
    CrownOutlined,
    SearchOutlined,
    UploadOutlined,
    FileExcelOutlined,
    CloseCircleOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    WarningOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    EditOutlined,
    PlusOutlined,
    SaveOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
    formatDateDTR,
    formatTimeDTR,
    generateDateRange,
    groupLogsByEmployeeAndDate,
} from "@/utils/logFormatters";

const NAVBAR_HEIGHT = 64;
const PADDING_VERTICAL = 32;

const isEmployeeOnLeaveForDate = (
    employeeId,
    date,
    leaves,
    scheduledDates = null,
) => {
    if (!leaves || leaves.length === 0) return false;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const isLeaveDay = leaves.some((leave) => {
        if (String(leave.EMPLOYID) !== String(employeeId)) return false;
        const leaveStart = new Date(leave.DATESTART);
        const leaveEnd = new Date(leave.DATEEND);
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        return targetDate >= leaveStart && targetDate <= leaveEnd;
    });

    if (!isLeaveDay) return false;

    if (scheduledDates) {
        return scheduledDates.has(date);
    }

    return true;
};

const LoadingModal = ({
    show,
    message = "Preparing your export...",
    progress = 0,
}) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative z-10 flex flex-col items-center gap-4 bg-base-100 rounded-2xl shadow-2xl border border-base-300 px-10 py-8 min-w-[320px]">
                <div className="relative w-14 h-14">
                    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="currentColor"
                            className="text-base-300"
                            strokeWidth="2.5"
                        />
                        <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="currentColor"
                            className="text-primary transition-all duration-500"
                            strokeWidth="2.5"
                            strokeDasharray={`${progress}, 100`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-base-content">
                            {progress}%
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center w-full">
                    <p className="text-[13px] font-semibold text-base-content">
                        {message}
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-base-300 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-base-content opacity-50">
                        This may take a moment for large date ranges.
                    </p>
                </div>
            </div>
        </div>
    );
};

const InlineEditRow = ({ row, onSave, onCancel, isSaving }) => {
    const toInputTime = (val) => {
        if (!val || val === "—") return "";
        const str = String(val).trim();
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return str.slice(0, 5);
        const dtMatch = str.match(/\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/);
        if (dtMatch) return dtMatch[1];
        const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
        if (ampmMatch) {
            let h = parseInt(ampmMatch[1], 10);
            const m = ampmMatch[2];
            const period = ampmMatch[3].toUpperCase();
            if (period === "AM" && h === 12) h = 0;
            if (period === "PM" && h !== 12) h += 12;
            return `${String(h).padStart(2, "0")}:${m}`;
        }
        const plain = str.match(/(\d{2}:\d{2})/);
        return plain ? plain[1] : "";
    };

    console.log("[InlineEditRow] raw row", {
        check_in: row.check_in,
        check_out: row.check_out,
        date: row.date,
    });

    const parsedIn = toInputTime(row.check_in);
    const parsedOut = toInputTime(row.check_out);

    console.log("[InlineEditRow] parsed", {
        parsedIn,
        parsedOut,
    });

    const [checkIn, setCheckIn] = useState(parsedIn);
    const [checkOut, setCheckOut] = useState(parsedOut);

    const effectiveCheckIn = checkIn || parsedIn;

    console.log("[InlineEditRow] effectiveCheckIn", effectiveCheckIn);

    return (
        <tr className="border-b border-base-200 bg-primary/5">
            {!row._selectedVip && (
                <td
                    className="font-medium truncate max-w-[120px] text-base-content opacity-60"
                    style={{
                        padding:
                            "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                    }}
                >
                    {row.employee_name}
                </td>
            )}
            <td
                className="whitespace-nowrap text-base-content"
                style={{
                    padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                    fontSize: "clamp(8px, 0.75vw, 13px)",
                }}
            >
                {new Date(row.date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "numeric",
                })}
            </td>
            <td
                className="whitespace-nowrap text-base-content"
                style={{
                    padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                    fontSize: "clamp(8px, 0.75vw, 13px)",
                }}
            >
                {row.day}
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <input
                    type="time"
                    step="1"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="appearance-none bg-base-100 border border-base-300 rounded-md text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                        padding:
                            "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 8px)",
                        width: "clamp(80px, 8vw, 130px)",
                    }}
                />
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <input
                    type="time"
                    step="1"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="appearance-none bg-base-100 border border-base-300 rounded-md text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                        padding:
                            "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 8px)",
                        width: "clamp(80px, 8vw, 130px)",
                    }}
                />
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <div className="flex items-center gap-1">
                    <button
                        className="btn btn-xs btn-success gap-1"
                        onClick={() =>
                            onSave(checkIn, checkOut, effectiveCheckIn)
                        }
                        disabled={isSaving}
                        title="Save"
                    >
                        {isSaving ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <SaveOutlined />
                        )}
                        <span
                            className="hidden sm:inline"
                            style={{ fontSize: "clamp(7px, 0.65vw, 11px)" }}
                        >
                            Save
                        </span>
                    </button>
                    <button
                        className="btn btn-xs btn-ghost gap-1"
                        onClick={onCancel}
                        disabled={isSaving}
                        title="Cancel"
                    >
                        <CloseOutlined />
                    </button>
                </div>
            </td>
        </tr>
    );
};

// ── Add Log Row ────────────────────────────────────────────────────────────────
// A "ghost" row shown for empty dates in month view so Ops/HR can add a log.
const AddLogRow = ({
    empId,
    date,
    selectedVip,
    onSave,
    onCancel,
    isSaving,
    existingCheckIn = "",
}) => {
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");

    const dayStr = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
    });

    return (
        <tr className="border-b border-base-200 bg-info/5">
            {!selectedVip && (
                <td
                    className="font-medium truncate max-w-[120px] text-base-content opacity-40 italic"
                    style={{
                        padding:
                            "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                    }}
                >
                    —
                </td>
            )}
            <td
                className="whitespace-nowrap text-base-content"
                style={{
                    padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                    fontSize: "clamp(8px, 0.75vw, 13px)",
                }}
            >
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "numeric",
                })}
            </td>
            <td
                className="whitespace-nowrap text-base-content"
                style={{
                    padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                    fontSize: "clamp(8px, 0.75vw, 13px)",
                }}
            >
                {dayStr}
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <input
                    type="time"
                    step="1"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="appearance-none bg-base-100 border border-base-300 rounded-md text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                        padding:
                            "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 8px)",
                        width: "clamp(80px, 8vw, 130px)",
                    }}
                />
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <input
                    type="time"
                    step="1"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="appearance-none bg-base-100 border border-base-300 rounded-md text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{
                        fontSize: "clamp(8px, 0.75vw, 13px)",
                        padding:
                            "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 8px)",
                        width: "clamp(80px, 8vw, 130px)",
                    }}
                />
            </td>
            <td
                style={{
                    padding: "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                }}
            >
                <div className="flex items-center gap-1">
                    <button
                        className="btn btn-xs btn-success gap-1"
                        onClick={() =>
                            onSave(checkIn || existingCheckIn, checkOut)
                        }
                        disabled={
                            isSaving ||
                            (!checkIn && !checkOut && !existingCheckIn)
                        }
                        title="Save new log"
                    >
                        {isSaving ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <SaveOutlined />
                        )}
                        <span
                            className="hidden sm:inline"
                            style={{ fontSize: "clamp(7px, 0.65vw, 11px)" }}
                        >
                            Save
                        </span>
                    </button>
                    <button
                        className="btn btn-xs btn-ghost"
                        onClick={onCancel}
                        disabled={isSaving}
                        title="Cancel"
                    >
                        <CloseOutlined />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default function ManagementLogs({ tableData, authUser }) {
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [search, setSearch] = useState("");
    const [selectedVip, setSelectedVip] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [allLogs, setAllLogs] = useState(tableData?.logs ?? []);
    const [loadedMonths, setLoadedMonths] = useState(() => {
        const months = new Set();
        (tableData?.logs ?? []).forEach((l) => {
            if (l.log_date) months.add(l.log_date.slice(0, 7));
        });
        return months;
    });
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(() =>
        ["Operations", "Human Resource", "Security"].includes(
            authUser?.emp_dept,
        ),
    );

    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportDateFrom, setExportDateFrom] = useState("2026-01-01");
    const [exportDateTo, setExportDateTo] = useState(today);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportMessage, setExportMessage] = useState(
        "Preparing your export...",
    );
    const [exportFormat, setExportFormat] = useState(1);

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);
    const [showImportDetails, setShowImportDetails] = useState(false);
    const fileInputRef = useRef(null);

    const [editingRowKey, setEditingRowKey] = useState(null);
    const [addingLogKey, setAddingLogKey] = useState(null);
    const [savingKey, setSavingKey] = useState(null);
    // Toast notification
    const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

    // Add Log modal state
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [addLogEmpId, setAddLogEmpId] = useState("");
    const [addLogDate, setAddLogDate] = useState(today);
    const [addLogTime, setAddLogTime] = useState("");
    const [addLogType, setAddLogType] = useState("check_in");
    const [isAddLogSaving, setIsAddLogSaving] = useState(false);

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const vips = tableData?.vips ?? [];
    const leaves = tableData?.leaves ?? [];
    const employeeExpectedDates = tableData?.employeeExpectedDates ?? {};
    const totalEmployees = vips.length;

    const isOpsOrHR = ["Operations", "Human Resource", "Security"].includes(
        authUser?.emp_dept,
    );
    const canEditLogs = authUser?.emp_dept === "Security";
    const isSelfOnly = !isOpsOrHR;

    const selfVip = useMemo(() => {
        if (!isSelfOnly) return null;
        return (
            vips.find(
                (v) => String(v.employee_id) === String(authUser?.emp_id),
            ) ?? null
        );
    }, [isSelfOnly, vips, authUser]);

    const filteredVips = useMemo(() => {
        return vips
            .filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [search, vips]);

    const fetchMonthIfNeeded = useCallback(
        async (month) => {
            if (loadedMonths.has(month)) return;
            const [year, mon] = month.split("-").map(Number);
            const dateFrom = `${month}-01`;
            const lastDay = new Date(year, mon, 0).getDate();
            const dateTo = `${month}-${String(lastDay).padStart(2, "0")}`;
            setIsLoadingLogs(true);
            try {
                const url =
                    route("vip-logs.by-range") +
                    `?date_from=${dateFrom}&date_to=${dateTo}`;
                const res = await fetch(url, {
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        Accept: "application/json",
                    },
                });
                const json = await res.json();
                if (json.success) {
                    setAllLogs((prev) => {
                        const existingIds = new Set(prev.map((l) => l.id));
                        const newLogs = json.data.filter(
                            (l) => !existingIds.has(l.id),
                        );
                        return [...prev, ...newLogs];
                    });
                    setLoadedMonths((prev) => new Set([...prev, month]));
                }
            } catch (e) {
                console.error("Failed to fetch logs for month:", month, e);
            } finally {
                setIsLoadingLogs(false);
            }
        },
        [loadedMonths],
    );

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        fetchMonthIfNeeded(month);
        // Cancel any open edit when navigating months
        setEditingRowKey(null);
        setAddingLogKey(null);
    };

    useEffect(() => {
        if (isSelfOnly && selfVip) {
            setSelectedVip(selfVip);
            fetchMonthIfNeeded(selectedMonth);
        }
    }, [isSelfOnly, selfVip]);

    const handleDateChange = (date) => {
        setSelectedDate(date);
        fetchMonthIfNeeded(date.slice(0, 7));
        setEditingRowKey(null);
        setAddingLogKey(null);
    };
    const handleSelectVip = (vip) => {
        setSelectedVip(vip);
        fetchMonthIfNeeded(selectedMonth);
        setEditingRowKey(null);
        setAddingLogKey(null);
    };
    const clearSearch = () => setSearch("");

    const groupedLogs = useMemo(() => {
        return groupLogsByEmployeeAndDate(allLogs, employeeExpectedDates);
    }, [allLogs, employeeExpectedDates]);

    const filteredLogs = useMemo(() => {
        let logs = [];

        Object.entries(groupedLogs).forEach(([empId, empData]) => {
            Object.entries(empData).forEach(([date, slots]) => {
                const employee = vips.find(
                    (v) => String(v.employee_id) === empId,
                );
                if (!employee) return;

                if (selectedVip && String(selectedVip.employee_id) !== empId)
                    return;

                if (selectedVip) {
                    const logMonth = date.slice(0, 7);
                    if (logMonth !== selectedMonth) return;
                } else {
                    if (date !== selectedDate) return;
                }

                const entry = {
                    id: `${empId}_${date}`,
                    employee_id: empId,
                    employee_name: employee.name,
                    date: date,
                    day: new Date(date).toLocaleDateString("en-US", {
                        weekday: "short",
                    }),
                    check_in: slots.check_in || "—",
                    check_out: slots.check_out || "—",
                };

                if (date === "2026-05-30") {
                    console.log("[filteredLogs] May 30 entry", entry);
                    console.log("[filteredLogs] May 30 raw slots", slots);
                }

                logs.push(entry);
            });
        });

        return logs.sort((a, b) => a.date.localeCompare(b.date));
    }, [groupedLogs, selectedVip, selectedDate, selectedMonth, vips]);

    const visibleLogs = useMemo(() => {
        if (isOpsOrHR) return filteredLogs;

        if (selfVip)
            return filteredLogs.filter(
                (row) =>
                    String(row.employee_id ?? "") ===
                        String(selfVip.employee_id) ||
                    row.employee_name === selfVip.name,
            );

        return [];
    }, [filteredLogs, isOpsOrHR, selfVip]);

    // ── Build "missing" dates for month view (Add Log rows) ───────────────────
    // When a single VIP is selected in month view, fill in every day of that
    // month that has no log yet, so Ops/HR can tap "+" to add one.
    const missingDatesInMonth = useMemo(() => {
        if (!canEditLogs || !selectedVip || !selectedMonth) return [];
        const [year, mon] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, mon, 0).getDate();
        const existingDates = new Set(visibleLogs.map((r) => r.date));
        const missing = [];
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
            if (!existingDates.has(dateStr)) missing.push(dateStr);
        }
        return missing;
    }, [isOpsOrHR, selectedVip, selectedMonth, visibleLogs]);

    const getRowStatus = (row, empId, leaves) => {
        const empScheduled = employeeExpectedDates[String(empId)];
        const scheduledSet = empScheduled
            ? new Set(Object.keys(empScheduled))
            : null;
        if (isEmployeeOnLeaveForDate(empId, row.date, leaves, scheduledSet))
            return "leave";
        if (row.check_in && row.check_in !== "—") return "present";
        // Night-shift overflow row: has check_out stored on the next day but no check_in
        if (row.check_out && row.check_out !== "—") return "present";
        return "absent";
    };

    const getExportRemarks = (
        empId,
        date,
        timeIn,
        leaves,
        employeeExpectedDates,
    ) => {
        const empScheduled = employeeExpectedDates[String(empId)];
        const scheduledSet = empScheduled
            ? new Set(Object.keys(empScheduled))
            : null;
        if (isEmployeeOnLeaveForDate(empId, date, leaves, scheduledSet))
            return "On Leave";
        if (scheduledSet && !scheduledSet.has(date)) return "Rest Day";
        if (timeIn && timeIn !== "-") return "Present";
        return "Absent";
    };

    const STATUS_ROW_STYLE = {
        present: { backgroundColor: "oklch(var(--su) / 0.12)" },
        absent: { backgroundColor: "oklch(var(--er) / 0.12)" },
        leave: { backgroundColor: "oklch(var(--wa) / 0.12)" },
    };

    const STATUS_BADGE = {
        present: {
            label: "Present",
            cls: "badge badge-sm bg-success/20 text-success border-0",
        },
        absent: {
            label: "Absent",
            cls: "badge badge-sm bg-error/20  text-error  border-0",
        },
        leave: {
            label: "On Leave",
            cls: "badge badge-sm bg-warning/20 text-warning border-0",
        },
    };

    // ── Save helper: formats a "HH:MM" or "HH:MM:SS" string into the datetime
    //    value the backend expects: "YYYY-MM-DD HH:MM:SS"
    const buildDatetime = (date, time, checkInTime = null) => {
        if (!time) return null;
        const t = time.length === 5 ? `${time}:00` : time;

        console.log("[buildDatetime]", { date, time, checkInTime, t });

        if (checkInTime && checkInTime.trim() !== "") {
            const [inH, inM] = checkInTime.split(":").map(Number);
            const [outH, outM] = time.split(":").map(Number);
            const inMins = inH * 60 + inM;
            const outMins = outH * 60 + outM;

            console.log("[buildDatetime] night check", {
                inMins,
                outMins,
                willBump: outMins < inMins,
            });

            if (outMins < inMins) {
                const next = new Date(date + "T00:00:00");
                next.setDate(next.getDate() + 1);
                const nextDate = next.toISOString().split("T")[0];
                console.log("[buildDatetime] BUMPED to next day", nextDate);
                return `${nextDate} ${t}`;
            }
        }

        return `${date} ${t}`;
    };

    // ── Core upsert: POST to route("vip-logs.upsert") ─────────────────────────
    // Payload: { employee_id, date, check_in, check_out }
    // check_in / check_out are "YYYY-MM-DD HH:MM:SS" or null to clear the punch.
    const upsertLog = async (
        empId,
        date,
        checkInTime,
        checkOutTime,
        rowKey,
        effectiveCheckIn = null,
    ) => {
        const checkInRef = effectiveCheckIn || checkInTime;

        console.log("[upsertLog] called", {
            empId,
            date,
            checkInTime,
            checkOutTime,
            effectiveCheckIn,
            checkInRef,
        });

        const checkInPayload = buildDatetime(date, checkInTime) ?? null;
        const checkOutPayload =
            buildDatetime(date, checkOutTime, checkInRef) ?? null;

        console.log("[upsertLog] FINAL PAYLOAD BEING SENT", {
            employee_id: empId,
            date: date,
            check_in: checkInPayload,
            check_out: checkOutPayload,
            checkInTime,
            checkOutTime,
            checkInRef,
            effectiveCheckIn,
        });

        setSavingKey(rowKey);
        try {
            await new Promise((resolve, reject) => {
                router.post(
                    route("vip-logs.upsert"),
                    {
                        employee_id: empId,
                        date: date,
                        check_in: checkInPayload,
                        check_out: checkOutPayload,
                    },
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: (page) => {
                            const returned = page.props?.flash?.updated_logs;
                            if (returned && Array.isArray(returned)) {
                                const next = new Date(date + "T00:00:00");
                                next.setDate(next.getDate() + 1);
                                const nextDate = next
                                    .toISOString()
                                    .split("T")[0];

                                setAllLogs((prev) => {
                                    const filtered = prev.filter(
                                        (l) =>
                                            !(
                                                String(l.employee_id) ===
                                                    String(empId) &&
                                                (l.log_date?.slice(0, 10) ===
                                                    date ||
                                                    l.log_date?.slice(0, 10) ===
                                                        nextDate)
                                            ),
                                    );
                                    return [...filtered, ...returned];
                                });
                            } else {
                                setLoadedMonths((prev) => {
                                    const next = new Set(prev);
                                    next.delete(date.slice(0, 7));
                                    return next;
                                });
                                fetchMonthIfNeeded(date.slice(0, 7));
                            }
                            resolve();
                        },
                        onError: (errors) =>
                            reject(new Error(Object.values(errors).join(", "))),
                    },
                );
            });

            showToast("success", "Log saved successfully.");
            setEditingRowKey(null);
            setAddingLogKey(null);
        } catch (e) {
            showToast(
                "error",
                "Failed to save: " + (e.message ?? "Unknown error"),
            );
        } finally {
            setSavingKey(null);
        }
    };

    const handleAddSingleLog = async () => {
        if (!addLogEmpId || !addLogDate || !addLogTime) {
            showToast("error", "Please fill in all fields.");
            return;
        }
        setIsAddLogSaving(true);
        try {
            await new Promise((resolve, reject) => {
                router.post(
                    route("vip-logs.add-single"),
                    {
                        employee_id: addLogEmpId,
                        date: addLogDate,
                        time: addLogTime,
                        log_type: addLogType,
                    },
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: (page) => {
                            const returned = page.props?.flash?.updated_logs;
                            if (returned && Array.isArray(returned)) {
                                const next = new Date(addLogDate + "T00:00:00");
                                next.setDate(next.getDate() + 1);
                                const nextDate = next
                                    .toISOString()
                                    .split("T")[0];
                                const prev = new Date(addLogDate + "T00:00:00");
                                prev.setDate(prev.getDate() - 1);
                                const prevDate = prev
                                    .toISOString()
                                    .split("T")[0];
                                setAllLogs((prevLogs) => {
                                    const filtered = prevLogs.filter(
                                        (l) =>
                                            !(
                                                String(l.employee_id) ===
                                                    String(addLogEmpId) &&
                                                (l.log_date?.slice(0, 10) ===
                                                    prevDate ||
                                                    l.log_date?.slice(0, 10) ===
                                                        addLogDate ||
                                                    l.log_date?.slice(0, 10) ===
                                                        nextDate)
                                            ),
                                    );
                                    return [...filtered, ...returned];
                                });
                            }
                            resolve();
                        },
                        onError: (errors) =>
                            reject(new Error(Object.values(errors).join(", "))),
                    },
                );
            });
            showToast("success", "Log added successfully.");
            setIsAddLogOpen(false);
            setAddLogEmpId("");
            setAddLogDate(today);
            setAddLogTime("");
            setAddLogType("check_in");
        } catch (e) {
            showToast(
                "error",
                "Failed to add log: " + (e.message ?? "Unknown error"),
            );
        } finally {
            setIsAddLogSaving(false);
        }
    };

    // ── Export helpers (unchanged) ─────────────────────────────────────────────
    const handleExport = async () => {
        if (!exportDateFrom || !exportDateTo) {
            alert("Please select both dates");
            return;
        }
        if (new Date(exportDateFrom) > new Date(exportDateTo)) {
            alert("Date from cannot be after date to");
            return;
        }

        setIsExportOpen(false);
        setExportLoading(true);
        setExportProgress(0);
        setExportMessage("Queuing export job...");

        try {
            const { data } = await axios.post(route("mgmt-logs.export"), {
                date_from: exportDateFrom,
                date_to: exportDateTo,
                format: exportFormat,
            });

            const jobId = data.job_id;
            if (!jobId) throw new Error("No job ID returned from server.");

            await new Promise((resolve, reject) => {
                const interval = setInterval(async () => {
                    try {
                        const { data: state } = await axios.get(
                            route("mgmt-logs.export-progress"),
                            { params: { job_id: jobId } },
                        );

                        setExportProgress(state.progress ?? 0);
                        setExportMessage(state.message ?? "Processing...");

                        if (state.status === "done") {
                            clearInterval(interval);
                            resolve(jobId);
                        } else if (
                            state.status === "failed" ||
                            state.status === "not_found"
                        ) {
                            clearInterval(interval);
                            reject(
                                new Error(state.message ?? "Export failed."),
                            );
                        }
                    } catch (pollErr) {
                        clearInterval(interval);
                        reject(pollErr);
                    }
                }, 1500);
            });

            setExportMessage("Downloading...");
            const link = document.createElement("a");
            link.href = route("mgmt-logs.export-download") + `?job_id=${jobId}`;
            link.setAttribute(
                "download",
                `VIP_DTR_${exportDateFrom}_to_${exportDateTo}.xlsx`,
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert("Export failed: " + (e.message ?? "Unknown error"));
        } finally {
            setExportLoading(false);
            setExportProgress(0);
            setExportMessage("Preparing your export...");
        }
    };

    const handleImportFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setImportFile(selected);
            setImportResult(null);
            setImportError(null);
        }
    };
    const handleImportDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (
            dropped &&
            (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))
        ) {
            setImportFile(dropped);
            setImportResult(null);
            setImportError(null);
        }
    };
    const handleImportSubmit = () => {
        if (!importFile) return;
        setIsUploading(true);
        setImportError(null);
        router.post(
            route("import-scan-logs.store"),
            { file: importFile },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const result = page.props.flash?.import_result;
                    if (result) setImportResult(result);
                    setLoadedMonths(new Set());
                    setImportFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                },
                onError: (errors) =>
                    setImportError(
                        Object.values(errors).join(", ") || "Import failed.",
                    ),
                onFinish: () => setIsUploading(false),
            },
        );
    };
    const closeImportModal = () => {
        setIsImportOpen(false);
        setImportFile(null);
        setImportResult(null);
        setImportError(null);
        setShowImportDetails(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    const statusIcon = (status) => {
        if (status === "imported")
            return <CheckCircleOutlined className="text-success" />;
        if (status === "skipped")
            return <CloseCircleOutlined className="text-error" />;
        if (status === "no_data")
            return <InfoCircleOutlined className="text-warning" />;
        return null;
    };

    // ── Merged rows for rendering: existing logs + missing-date "add" slots ───
    // We interleave them so the table stays date-sorted.
    const mergedRows = useMemo(() => {
        if (!isOpsOrHR || !selectedVip) return visibleLogs;

        const existing = visibleLogs.map((r) => ({ ...r, _type: "existing" }));
        const adding = missingDatesInMonth.map((date) => ({
            id: `${selectedVip.employee_id}_${date}_add`,
            employee_id: String(selectedVip.employee_id),
            employee_name: selectedVip.name,
            date,
            day: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
            }),
            check_in: "—",
            check_out: "—",
            _type: "missing",
        }));

        return [...existing, ...adding].sort((a, b) =>
            a.date.localeCompare(b.date),
        );
    }, [isOpsOrHR, selectedVip, visibleLogs, missingDatesInMonth]);

    // In date view (no selectedVip) we also want to allow adding for employees
    // who have zero logs that day. We'll handle that via an "Add Log" button
    // in the "no logs" empty state, but for now the merged list covers month view.
    const rowsToRender = selectedVip ? mergedRows : visibleLogs;

    return (
        <AuthenticatedLayout user={authUser}>
            <Head title="Management Logs" />

            <LoadingModal
                show={exportLoading}
                message={exportMessage}
                progress={exportProgress}
            />

            {/* ── Toast ─────────────────────────────────────────────────────── */}
            {toast && (
                <div className="toast toast-top toast-end z-50">
                    <div
                        className={`alert ${toast.type === "success" ? "alert-success" : "alert-error"} shadow-lg`}
                    >
                        {toast.type === "success" ? (
                            <CheckCircleOutlined />
                        ) : (
                            <CloseCircleOutlined />
                        )}
                        <span className="text-sm">{toast.msg}</span>
                    </div>
                </div>
            )}

            <div
                className="overflow-hidden flex p-4"
                style={{
                    height: `calc(100vh - ${NAVBAR_HEIGHT}px - ${PADDING_VERTICAL}px)`,
                }}
            >
                <div className="flex-1 flex flex-col min-h-0 border border-base-300 rounded-lg bg-base-100 shadow-sm">
                    {/* ── Header ────────────────────────────────────────────── */}
                    <div className="px-4 py-6 border-b border-base-300 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() =>
                                        setSidebarOpen((prev) => !prev)
                                    }
                                    className="btn btn-ghost btn-sm"
                                    title={
                                        sidebarOpen
                                            ? "Collapse sidebar"
                                            : "Expand sidebar"
                                    }
                                >
                                    {sidebarOpen ? (
                                        <MenuFoldOutlined className="text-lg" />
                                    ) : (
                                        <MenuUnfoldOutlined className="text-lg" />
                                    )}
                                </button>
                                <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
                                    <CrownOutlined className="mr-1 text-yellow-500" />
                                    Management Logs
                                </h1>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                                {canEditLogs && (
                                    <button
                                        className="btn btn-sm btn-outline btn-warning gap-1"
                                        onClick={() => setIsAddLogOpen(true)}
                                    >
                                        <PlusOutlined />
                                        <span className="hidden sm:inline">
                                            Add Log
                                        </span>
                                    </button>
                                )}
                                {isOpsOrHR && (
                                    <>
                                        <button
                                            className="btn btn-sm btn-outline btn-info gap-1"
                                            onClick={() =>
                                                setIsImportOpen(true)
                                            }
                                        >
                                            <UploadOutlined />
                                            <span className="hidden sm:inline">
                                                Import DTR
                                            </span>
                                        </button>
                                        <button
                                            className="btn btn-sm btn-primary gap-1"
                                            onClick={() =>
                                                setIsExportOpen(true)
                                            }
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            <span className="hidden sm:inline">
                                                Export Date Range
                                            </span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* ── Sidebar ───────────────────────────────────────── */}
                        <aside
                            className={`border-r border-base-300 flex flex-col bg-base-200 transition-all duration-300 overflow-hidden shrink-0
                            ${sidebarOpen ? "w-36 sm:w-44 md:w-52 xl:w-72 p-2 xl:p-4" : "w-0 p-0"}`}
                        >
                            {sidebarOpen && (
                                <>
                                    {isSelfOnly ? (
                                        <div className="flex-1 overflow-auto">
                                            <ul className="space-y-0.5">
                                                {selfVip ? (
                                                    <li
                                                        className="rounded-lg font-medium text-base-content bg-primary text-primary-content cursor-default"
                                                        style={{
                                                            fontSize:
                                                                "clamp(7px, 0.7vw, 14px)",
                                                            padding:
                                                                "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)",
                                                        }}
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
                                                    style={{
                                                        padding:
                                                            "clamp(4px, 0.5vw, 12px) clamp(6px, 0.8vw, 16px)",
                                                    }}
                                                >
                                                    <SearchOutlined
                                                        className="text-base-content opacity-70 shrink-0"
                                                        style={{
                                                            fontSize:
                                                                "clamp(8px, 0.8vw, 16px)",
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="grow bg-transparent text-base-content focus:outline-none min-w-0"
                                                        placeholder="Search..."
                                                        value={search}
                                                        onChange={(e) =>
                                                            setSearch(
                                                                e.target.value,
                                                            )
                                                        }
                                                        style={{
                                                            fontSize:
                                                                "clamp(7px, 0.7vw, 14px)",
                                                        }}
                                                    />
                                                    {search && (
                                                        <button
                                                            onClick={
                                                                clearSearch
                                                            }
                                                            className="btn btn-ghost btn-xs text-base-content px-1 shrink-0"
                                                            type="button"
                                                            style={{
                                                                fontSize:
                                                                    "clamp(6px, 0.6vw, 12px)",
                                                            }}
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                {search && (
                                                    <div
                                                        className="absolute top-full mt-1 text-base-content opacity-70 truncate w-full"
                                                        style={{
                                                            fontSize:
                                                                "clamp(6px, 0.6vw, 12px)",
                                                        }}
                                                    >
                                                        Searching: "{search}"
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-auto">
                                                <ul className="space-y-0.5">
                                                    <li
                                                        onClick={() =>
                                                            setSelectedVip(null)
                                                        }
                                                        className={`rounded-lg cursor-pointer font-medium flex items-center justify-between text-base-content
                                                            ${selectedVip === null ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
                                                        style={{
                                                            padding:
                                                                "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)",
                                                        }}
                                                    >
                                                        <span
                                                            className="truncate"
                                                            style={{
                                                                fontSize:
                                                                    "clamp(7px, 0.7vw, 14px)",
                                                            }}
                                                        >
                                                            All Employees
                                                        </span>
                                                        <span
                                                            className={`ml-1 rounded-full shrink-0 font-medium ${selectedVip === null ? "bg-primary-content/20 text-primary-content" : "bg-base-300 text-base-content"}`}
                                                            style={{
                                                                fontSize:
                                                                    "clamp(6px, 0.6vw, 12px)",
                                                                padding:
                                                                    "1px clamp(3px, 0.4vw, 8px)",
                                                            }}
                                                        >
                                                            {totalEmployees}
                                                        </span>
                                                    </li>
                                                    {filteredVips.map((vip) => (
                                                        <li
                                                            key={vip.id}
                                                            onClick={() =>
                                                                handleSelectVip(
                                                                    vip,
                                                                )
                                                            }
                                                            className={`rounded-lg cursor-pointer text-base-content truncate
                                                                ${selectedVip?.id === vip.id ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
                                                            style={{
                                                                fontSize:
                                                                    "clamp(7px, 0.7vw, 14px)",
                                                                padding:
                                                                    "clamp(3px, 0.4vw, 8px) clamp(4px, 0.6vw, 12px)",
                                                            }}
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

                        {/* ── Main Content ──────────────────────────────────── */}
                        <div className="flex-1 p-2 xl:p-4 overflow-auto min-w-0 flex flex-col gap-2 xl:gap-4">
                            {/* Toolbar row */}
                            <div className="flex items-center justify-between shrink-0 gap-2 flex-wrap">
                                <h2
                                    className="font-semibold text-base-content"
                                    style={{
                                        fontSize: "clamp(9px, 0.9vw, 16px)",
                                    }}
                                >
                                    {selectedVip
                                        ? `Attendance History — ${selectedVip.name}`
                                        : "Management Logs (By Date)"}
                                </h2>
                                <div className="flex items-center gap-2">
                                    {isLoadingLogs && (
                                        <span className="loading loading-spinner loading-sm text-primary" />
                                    )}
                                    {selectedVip ? (
                                        <input
                                            type="month"
                                            className="appearance-none bg-base-100 border border-base-300 rounded-lg text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                            style={{
                                                fontSize:
                                                    "clamp(8px, 0.75vw, 13px)",
                                                padding:
                                                    "clamp(3px, 0.4vw, 8px) clamp(6px, 0.7vw, 14px)",
                                            }}
                                            value={selectedMonth}
                                            onChange={(e) =>
                                                handleMonthChange(
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    ) : (
                                        <input
                                            type="date"
                                            className="appearance-none bg-base-100 border border-base-300 rounded-lg text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                            style={{
                                                fontSize:
                                                    "clamp(8px, 0.75vw, 13px)",
                                                padding:
                                                    "clamp(3px, 0.4vw, 8px) clamp(6px, 0.7vw, 14px)",
                                            }}
                                            value={selectedDate}
                                            onChange={(e) =>
                                                handleDateChange(e.target.value)
                                            }
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto min-h-0 border border-base-300 rounded-lg">
                                <table
                                    className="w-full"
                                    style={{
                                        fontSize: "clamp(8px, 0.75vw, 13px)",
                                    }}
                                >
                                    <thead className="sticky top-0 bg-base-200 z-10">
                                        <tr>
                                            {!selectedVip && (
                                                <th
                                                    className="text-left font-semibold text-base-content opacity-60 whitespace-nowrap"
                                                    style={{
                                                        padding:
                                                            "clamp(4px, 0.5vw, 10px) clamp(6px, 0.7vw, 14px)",
                                                    }}
                                                >
                                                    Employee
                                                </th>
                                            )}
                                            {[
                                                "Date",
                                                "Day",
                                                "Check In",
                                                "Check Out",
                                                "Status",
                                            ].map((col) => (
                                                <th
                                                    key={col}
                                                    className="text-left font-semibold text-base-content opacity-60 whitespace-nowrap"
                                                    style={{
                                                        padding:
                                                            "clamp(4px, 0.5vw, 10px) clamp(6px, 0.7vw, 14px)",
                                                    }}
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                            {/* Extra column header for edit actions (Ops/HR only) */}
                                            {canEditLogs && (
                                                <th
                                                    className="text-left font-semibold text-base-content opacity-60 whitespace-nowrap"
                                                    style={{
                                                        padding:
                                                            "clamp(4px, 0.5vw, 10px) clamp(6px, 0.7vw, 14px)",
                                                    }}
                                                >
                                                    Actions
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rowsToRender.length > 0 ? (
                                            rowsToRender.map((row) => {
                                                const rowKey = `${row.employee_id}_${row.date}`;
                                                const isEditing =
                                                    editingRowKey === rowKey;
                                                const isAdding =
                                                    addingLogKey === rowKey;
                                                const isSavingThis =
                                                    savingKey === rowKey;
                                                const isMissing =
                                                    canEditLogs &&
                                                    row._type === "missing";

                                                const empId = selectedVip
                                                    ? selectedVip.employee_id
                                                    : vips.find(
                                                          (v) =>
                                                              v.name ===
                                                              row.employee_name,
                                                      )?.employee_id;

                                                // ── "Add" slot row (no log exists yet) ──
                                                if (isMissing) {
                                                    if (isAdding) {
                                                        return (
                                                            <AddLogRow
                                                                key={rowKey}
                                                                empId={
                                                                    row.employee_id
                                                                }
                                                                date={row.date}
                                                                selectedVip={
                                                                    selectedVip
                                                                }
                                                                isSaving={
                                                                    isSavingThis
                                                                }
                                                                onSave={(
                                                                    ci,
                                                                    co,
                                                                ) =>
                                                                    upsertLog(
                                                                        row.employee_id,
                                                                        row.date,
                                                                        ci,
                                                                        co,
                                                                        rowKey,
                                                                    )
                                                                }
                                                                onCancel={() =>
                                                                    setAddingLogKey(
                                                                        null,
                                                                    )
                                                                }
                                                            />
                                                        );
                                                    }
                                                    // Collapsed "missing" row — just a subtle "+ Add" trigger
                                                    const dayStr = new Date(
                                                        row.date + "T00:00:00",
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        { weekday: "short" },
                                                    );
                                                    return (
                                                        <tr
                                                            key={rowKey}
                                                            className="border-b border-base-200 opacity-30 hover:opacity-60 transition-opacity group"
                                                        >
                                                            {!selectedVip && (
                                                                <td
                                                                    className="text-base-content italic"
                                                                    style={{
                                                                        padding:
                                                                            "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                    }}
                                                                >
                                                                    —
                                                                </td>
                                                            )}
                                                            <td
                                                                className="whitespace-nowrap text-base-content"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                {new Date(
                                                                    row.date +
                                                                        "T00:00:00",
                                                                ).toLocaleDateString(
                                                                    "en-US",
                                                                    {
                                                                        month: "numeric",
                                                                        day: "numeric",
                                                                        year: "numeric",
                                                                    },
                                                                )}
                                                            </td>
                                                            <td
                                                                className="whitespace-nowrap text-base-content"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                {dayStr}
                                                            </td>
                                                            <td
                                                                className="opacity-40"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                —
                                                            </td>
                                                            <td
                                                                className="opacity-40"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                —
                                                            </td>
                                                            <td
                                                                className="opacity-40"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                —
                                                            </td>
                                                            {/* Add button */}
                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                                                                }}
                                                            >
                                                                <button
                                                                    className="btn btn-xs btn-ghost gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => {
                                                                        setAddingLogKey(
                                                                            rowKey,
                                                                        );
                                                                        setEditingRowKey(
                                                                            null,
                                                                        );
                                                                    }}
                                                                    title="Add log for this date"
                                                                >
                                                                    <PlusOutlined />
                                                                    <span
                                                                        className="hidden sm:inline"
                                                                        style={{
                                                                            fontSize:
                                                                                "clamp(7px, 0.65vw, 11px)",
                                                                        }}
                                                                    >
                                                                        Add
                                                                    </span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                // ── Existing log row ─────────────────────
                                                const status = getRowStatus(
                                                    row,
                                                    empId,
                                                    leaves,
                                                );
                                                const badge =
                                                    STATUS_BADGE[status];

                                                if (isEditing) {
                                                    return (
                                                        <InlineEditRow
                                                            key={rowKey}
                                                            row={{
                                                                ...row,
                                                                _selectedVip:
                                                                    !!selectedVip,
                                                            }}
                                                            isSaving={
                                                                isSavingThis
                                                            }
                                                            onSave={(
                                                                ci,
                                                                co,
                                                                effectiveCi,
                                                            ) =>
                                                                upsertLog(
                                                                    empId,
                                                                    row.date,
                                                                    ci,
                                                                    co,
                                                                    rowKey,
                                                                    effectiveCi,
                                                                )
                                                            }
                                                            onCancel={() =>
                                                                setEditingRowKey(
                                                                    null,
                                                                )
                                                            }
                                                        />
                                                    );
                                                }

                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className="border-b border-base-200 transition-colors group"
                                                        style={
                                                            STATUS_ROW_STYLE[
                                                                status
                                                            ]
                                                        }
                                                    >
                                                        {!selectedVip && (
                                                            <td
                                                                className="font-medium truncate max-w-[120px]"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                                title={
                                                                    row.employee_name
                                                                }
                                                            >
                                                                {
                                                                    row.employee_name
                                                                }
                                                            </td>
                                                        )}
                                                        {[
                                                            new Date(
                                                                row.date +
                                                                    "T00:00:00",
                                                            ).toLocaleDateString(
                                                                "en-US",
                                                                {
                                                                    month: "numeric",
                                                                    day: "numeric",
                                                                    year: "numeric",
                                                                },
                                                            ),
                                                            row.day,
                                                        ].map((val, i) => (
                                                            <td
                                                                key={i}
                                                                className="whitespace-nowrap"
                                                                style={{
                                                                    padding:
                                                                        "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                                }}
                                                            >
                                                                {val}
                                                            </td>
                                                        ))}
                                                        {/* Check In */}
                                                        <td
                                                            className={`whitespace-nowrap ${!row.check_in || row.check_in === "—" ? "opacity-40" : ""}`}
                                                            style={{
                                                                padding:
                                                                    "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                            }}
                                                        >
                                                            {row.check_in ??
                                                                "—"}
                                                        </td>
                                                        {/* Check Out — badge +1d if night shift crosses midnight */}
                                                        <td
                                                            className={`whitespace-nowrap ${!row.check_out || row.check_out === "—" ? "opacity-40" : ""}`}
                                                            style={{
                                                                padding:
                                                                    "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                            }}
                                                        >
                                                            {row.check_out &&
                                                            row.check_out !==
                                                                "—" &&
                                                            row.check_in &&
                                                            row.check_in !== "—"
                                                                ? (() => {
                                                                      const [
                                                                          inH,
                                                                      ] =
                                                                          row.check_in
                                                                              .split(
                                                                                  ":",
                                                                              )
                                                                              .map(
                                                                                  Number,
                                                                              );
                                                                      const [
                                                                          outH,
                                                                      ] =
                                                                          row.check_out
                                                                              .split(
                                                                                  ":",
                                                                              )
                                                                              .map(
                                                                                  Number,
                                                                              );
                                                                      return outH <=
                                                                          inH ? (
                                                                          <>
                                                                              {
                                                                                  row.check_out
                                                                              }{" "}
                                                                              <span className="badge badge-xs bg-info/20 text-info border-0 align-middle">
                                                                                  +1d
                                                                              </span>
                                                                          </>
                                                                      ) : (
                                                                          row.check_out
                                                                      );
                                                                  })()
                                                                : "—"}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)",
                                                            }}
                                                        >
                                                            <span
                                                                className={
                                                                    badge.cls
                                                                }
                                                            >
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        {/* Edit action cell */}
                                                        {canEditLogs && (
                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "clamp(2px, 0.3vw, 6px) clamp(4px, 0.5vw, 10px)",
                                                                }}
                                                            >
                                                                {row.check_in &&
                                                                    row.check_in !==
                                                                        "—" && (
                                                                        <button
                                                                            className="btn btn-xs btn-ghost gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            onClick={() => {
                                                                                setEditingRowKey(
                                                                                    rowKey,
                                                                                );
                                                                                setAddingLogKey(
                                                                                    null,
                                                                                );
                                                                            }}
                                                                            title="Edit this log"
                                                                        >
                                                                            <EditOutlined />
                                                                            <span
                                                                                className="hidden sm:inline"
                                                                                style={{
                                                                                    fontSize:
                                                                                        "clamp(7px, 0.65vw, 11px)",
                                                                                }}
                                                                            >
                                                                                Edit
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        selectedVip
                                                            ? canEditLogs
                                                                ? 6
                                                                : 5
                                                            : canEditLogs
                                                              ? 7
                                                              : 6
                                                    }
                                                    className="text-center text-base-content opacity-50 py-12"
                                                    style={{
                                                        fontSize:
                                                            "clamp(9px, 0.8vw, 14px)",
                                                    }}
                                                >
                                                    {isLoadingLogs
                                                        ? "Loading…"
                                                        : "No logs found"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Import Modal ───────────────────────────────────────────────── */}
            {isImportOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-base-content flex items-center gap-2">
                                <FileExcelOutlined className="text-success" />
                                Import DTR Excel File
                            </h3>
                            <button
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={closeImportModal}
                            >
                                ✕
                            </button>
                        </div>
                        {importError && (
                            <div className="alert alert-error mb-4">
                                <CloseCircleOutlined />
                                <span>{importError}</span>
                            </div>
                        )}
                        {importResult && (
                            <div className="mb-6">
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="stat bg-success/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">
                                            Inserted
                                        </div>
                                        <div className="stat-value text-success text-2xl">
                                            {importResult.inserted}
                                        </div>
                                        <div className="stat-desc text-xs">
                                            log entries saved
                                        </div>
                                    </div>
                                    <div className="stat bg-warning/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">
                                            Skipped
                                        </div>
                                        <div className="stat-value text-warning text-2xl">
                                            {importResult.skipped}
                                        </div>
                                        <div className="stat-desc text-xs">
                                            rows not imported
                                        </div>
                                    </div>
                                    <div className="stat bg-error/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">
                                            Errors
                                        </div>
                                        <div className="stat-value text-error text-2xl">
                                            {importResult.errors?.length ?? 0}
                                        </div>
                                        <div className="stat-desc text-xs">
                                            parse / save errors
                                        </div>
                                    </div>
                                </div>
                                {importResult.errors?.length > 0 && (
                                    <div className="alert alert-warning mb-3 text-sm">
                                        <WarningOutlined />
                                        <ul className="list-disc list-inside space-y-1">
                                            {importResult.errors.map(
                                                (err, i) => (
                                                    <li key={i}>{err}</li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                )}
                                {importResult.details?.length > 0 && (
                                    <>
                                        <button
                                            className="btn btn-ghost btn-xs mb-2"
                                            onClick={() =>
                                                setShowImportDetails((v) => !v)
                                            }
                                        >
                                            {showImportDetails
                                                ? "Hide"
                                                : "Show"}{" "}
                                            row details (
                                            {importResult.details.length})
                                        </button>
                                        {showImportDetails && (
                                            <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                                <table className="table table-xs table-zebra w-full">
                                                    <thead>
                                                        <tr>
                                                            <th>Row</th>
                                                            <th>ID</th>
                                                            <th>Name</th>
                                                            <th>Status</th>
                                                            <th>Inserted</th>
                                                            <th>Note</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importResult.details.map(
                                                            (d, i) => (
                                                                <tr key={i}>
                                                                    <td>
                                                                        {d.row}
                                                                    </td>
                                                                    <td className="font-mono">
                                                                        {d.id}
                                                                    </td>
                                                                    <td>
                                                                        {d.name}
                                                                    </td>
                                                                    <td className="flex items-center gap-1 text-xs">
                                                                        {statusIcon(
                                                                            d.status,
                                                                        )}
                                                                        <span className="capitalize">
                                                                            {d.status?.replace(
                                                                                "_",
                                                                                " ",
                                                                            )}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        {d.inserted ??
                                                                            "-"}
                                                                    </td>
                                                                    <td className="text-xs opacity-70">
                                                                        {d.reason ||
                                                                            (d.errors?.join(
                                                                                "; ",
                                                                            ) ??
                                                                                "")}
                                                                    </td>
                                                                </tr>
                                                            ),
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="divider my-3 text-xs">
                                    Upload another file
                                </div>
                            </div>
                        )}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4
                                ${isDragging ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary hover:bg-base-200"}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleImportDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileExcelOutlined className="text-4xl text-success mb-2" />
                            <p className="font-semibold text-base-content mb-1">
                                {importFile
                                    ? importFile.name
                                    : "Drag & drop your Excel file here"}
                            </p>
                            <p className="text-sm opacity-60">
                                {importFile
                                    ? `${(importFile.size / 1024).toFixed(1)} KB — click to change`
                                    : "or click to browse  •  .xlsx / .xls accepted"}
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleImportFileChange}
                            />
                        </div>
                        <div className="text-xs text-base-content/60 bg-base-200 rounded-lg px-4 py-3 mb-4 space-y-1">
                            <p className="font-semibold text-base-content mb-1">
                                Expected format
                            </p>
                            <p>
                                • Row 3 = date headers (e.g. <code>07-Feb</code>
                                ) in every other column starting at col C
                            </p>
                            <p>
                                • Row 5+ = employee rows: <strong>col A</strong>{" "}
                                = ID No., <strong>col B</strong> = Name, then
                                IN/OUT pairs per date
                            </p>
                            <p>
                                • Only employees in the VIP masterlist
                                (EMPPOSITION 3 or 4, ACCSTATUS 1) will be
                                imported
                            </p>
                            <p>
                                • <code>XXX</code>, blank cells, and special
                                codes (<code>SL VL OB LEAVE BL</code>) are
                                handled automatically
                            </p>
                        </div>
                        <div className="modal-action mt-0 pt-0">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={closeImportModal}
                            >
                                Close
                            </button>
                            <button
                                className="btn btn-primary btn-sm gap-2"
                                onClick={handleImportSubmit}
                                disabled={!importFile || isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Importing…
                                    </>
                                ) : (
                                    <>
                                        <UploadOutlined />
                                        Import
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <div
                        className="modal-backdrop"
                        onClick={closeImportModal}
                    />
                </dialog>
            )}

            {/* ── Add Single Log Modal ──────────────────────────────────────────── */}
            {isAddLogOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-base-content flex items-center gap-2">
                                <PlusOutlined className="text-warning" />
                                Add Single Log
                            </h3>
                            <button
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={() => setIsAddLogOpen(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Employee
                                    </span>
                                </label>
                                <select
                                    className="select select-bordered w-full text-base-content bg-base-100"
                                    value={addLogEmpId}
                                    onChange={(e) =>
                                        setAddLogEmpId(e.target.value)
                                    }
                                >
                                    <option value="">
                                        — Select employee —
                                    </option>
                                    {[...vips]
                                        .sort((a, b) =>
                                            a.name.localeCompare(b.name),
                                        )
                                        .map((v) => (
                                            <option
                                                key={v.employee_id}
                                                value={v.employee_id}
                                            >
                                                {v.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Date
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={addLogDate}
                                    onChange={(e) =>
                                        setAddLogDate(e.target.value)
                                    }
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Log Type
                                    </span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAddLogType("check_in")
                                        }
                                        className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-all ${addLogType === "check_in" ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content hover:border-base-400"}`}
                                    >
                                        Check In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAddLogType("check_out")
                                        }
                                        className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-all ${addLogType === "check_out" ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content hover:border-base-400"}`}
                                    >
                                        Check Out
                                    </button>
                                </div>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Time
                                    </span>
                                </label>
                                <input
                                    type="time"
                                    step="1"
                                    className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={addLogTime}
                                    onChange={(e) =>
                                        setAddLogTime(e.target.value)
                                    }
                                />
                            </div>
                            <div className="alert alert-warning text-sm">
                                <WarningOutlined />
                                <span>
                                    This inserts a single punch record directly.
                                    Use carefully.
                                </span>
                            </div>
                        </div>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setIsAddLogOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-warning btn-sm gap-2"
                                onClick={handleAddSingleLog}
                                disabled={
                                    isAddLogSaving ||
                                    !addLogEmpId ||
                                    !addLogDate ||
                                    !addLogTime
                                }
                            >
                                {isAddLogSaving ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <PlusOutlined />
                                        Add Log
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <div
                        className="modal-backdrop"
                        onClick={() => setIsAddLogOpen(false)}
                    />
                </dialog>
            )}

            {/* ── Export Date-Range Modal ─────────────────────────────────────── */}
            {isExportOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box max-w-md">
                        <h3 className="font-bold text-lg mb-4 text-base-content">
                            Export VIP DTR
                        </h3>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Date From
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={exportDateFrom}
                                    onChange={(e) =>
                                        setExportDateFrom(e.target.value)
                                    }
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Date To
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={exportDateTo}
                                    onChange={(e) =>
                                        setExportDateTo(e.target.value)
                                    }
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold text-base-content">
                                        Export Format
                                    </span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat(1)}
                                        className={`rounded-lg border-2 p-3 text-left transition-all ${exportFormat === 1 ? "border-primary bg-primary/10" : "border-base-300 hover:border-base-400"}`}
                                    >
                                        <div className="font-semibold text-sm text-base-content mb-1">
                                            Format 1 — DTR
                                        </div>
                                        <div className="text-xs text-base-content opacity-60 space-y-0.5">
                                            <div>Employee ID, Name</div>
                                            <div>Date, Day</div>
                                            <div>Time In, Time Out</div>
                                            <div>Remarks</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat(2)}
                                        className={`rounded-lg border-2 p-3 text-left transition-all ${exportFormat === 2 ? "border-primary bg-primary/10" : "border-base-300 hover:border-base-400"}`}
                                    >
                                        <div className="font-semibold text-sm text-base-content mb-1">
                                            Format 2 — Biometrics
                                        </div>
                                        <div className="text-xs text-base-content opacity-60 space-y-0.5">
                                            <div>Employee ID, Name</div>
                                            <div>Date, Time</div>
                                            <div>Flag (IN / OUT)</div>
                                            <div className="italic">
                                                One row per punch
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div className="alert alert-info">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    className="stroke-current shrink-0 w-6 h-6"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div className="text-base-content text-sm">
                                    This will export DTR for all{" "}
                                    <strong>
                                        {totalEmployees} VIP employees
                                    </strong>{" "}
                                    within the selected date range.
                                </div>
                            </div>
                            <div className="bg-base-200 rounded-lg p-4 text-sm space-y-1">
                                <div className="font-semibold mb-2 text-base-content">
                                    Export Format Details:
                                </div>
                                {exportFormat === 1 ? (
                                    <>
                                        {[
                                            [
                                                "Headers",
                                                "Employee ID, Employee Name, Date, Day, Time In, Time Out, Remarks",
                                            ],
                                            ["Date", "M/D/YYYY"],
                                            [
                                                "Time In / Time Out",
                                                "h:mm:ss AM/PM  (or  -  if absent)",
                                            ],
                                            [
                                                "Remarks",
                                                "Present, Absent, On Leave, Rest Day",
                                            ],
                                        ].map(([label, value]) => (
                                            <div
                                                key={label}
                                                className="flex items-start text-base-content"
                                            >
                                                <span className="text-primary mr-2">
                                                    •
                                                </span>
                                                <span>
                                                    <strong>{label}:</strong>{" "}
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        {[
                                            [
                                                "Headers",
                                                "Employee ID, Employee Name, Date, Time, Flag",
                                            ],
                                            ["Date", "M/D/YYYY"],
                                            ["Time", "h:mm:ss AM/PM"],
                                            ["Flag", "IN  or  OUT"],
                                            [
                                                "Rows",
                                                "One row per punch (IN and OUT are separate rows)",
                                            ],
                                        ].map(([label, value]) => (
                                            <div
                                                key={label}
                                                className="flex items-start text-base-content"
                                            >
                                                <span className="text-primary mr-2">
                                                    •
                                                </span>
                                                <span>
                                                    <strong>{label}:</strong>{" "}
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="modal-action">
                            <button
                                className="btn btn-outline btn-sm text-base-content"
                                onClick={() => setIsExportOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleExport}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Export
                            </button>
                        </div>
                    </div>
                </dialog>
            )}
        </AuthenticatedLayout>
    );
}
