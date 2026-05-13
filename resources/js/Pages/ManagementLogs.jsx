import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import { CrownOutlined, SearchOutlined, UploadOutlined, FileExcelOutlined, CloseCircleOutlined, CheckCircleOutlined, InfoCircleOutlined, WarningOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
    formatDateDTR,
    formatTimeDTR,
    generateDateRange,
    groupLogsByEmployeeAndDate,
} from "@/utils/logFormatters";

const NAVBAR_HEIGHT    = 64;
const PADDING_VERTICAL = 32;

const isEmployeeOnLeaveForDate = (employeeId, date, leaves, scheduledDates = null) => {
    if (!leaves || leaves.length === 0) return false;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const isLeaveDay = leaves.some((leave) => {
        if (String(leave.EMPLOYID) !== String(employeeId)) return false;
        const leaveStart = new Date(leave.DATESTART);
        const leaveEnd   = new Date(leave.DATEEND);
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        return targetDate >= leaveStart && targetDate <= leaveEnd;
    });

    if (!isLeaveDay) return false;

    // If we have scheduler data, only count leave on Expected (non-rest) days
    if (scheduledDates) {
        return scheduledDates.has(date);
    }

    return true;
};

const LoadingModal = ({ show, message = 'Preparing your export...', progress = 0 }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative z-10 flex flex-col items-center gap-4 bg-base-100 rounded-2xl shadow-2xl border border-base-300 px-10 py-8 min-w-[320px]">
                <div className="relative w-14 h-14">
                    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                            className="text-base-300" strokeWidth="2.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                            className="text-primary transition-all duration-500"
                            strokeWidth="2.5"
                            strokeDasharray={`${progress}, 100`}
                            strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-base-content">{progress}%</span>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center w-full">
                    <p className="text-[13px] font-semibold text-base-content">{message}</p>
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

export default function ManagementLogs({ tableData, authUser }) {

    const today        = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [search,         setSearch]         = useState("");
    const [selectedVip,    setSelectedVip]    = useState(null);
    const [selectedDate,   setSelectedDate]   = useState(today);
    const [selectedMonth,  setSelectedMonth]  = useState(currentMonth);
    const [allLogs,        setAllLogs]        = useState(tableData?.logs ?? []);
    const [loadedMonths,   setLoadedMonths]   = useState(() => {
        const months = new Set();
        (tableData?.logs ?? []).forEach(l => {
            if (l.log_date) months.add(l.log_date.slice(0, 7));
        });
        return months;
    });
    const [isLoadingLogs,  setIsLoadingLogs]  = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(() =>
        ["Operations", "Human Resource", "Security"].includes(authUser?.emp_dept)
    );

    const [isExportOpen,    setIsExportOpen]    = useState(false);
    const [exportDateFrom,  setExportDateFrom]  = useState("2026-01-01");
    const [exportDateTo,    setExportDateTo]    = useState(today);
    const [exportLoading,   setExportLoading]   = useState(false);
    const [exportProgress,  setExportProgress]  = useState(0);
    const [exportMessage,   setExportMessage]   = useState('Preparing your export...');

    const [isImportOpen,      setIsImportOpen]      = useState(false);
    const [importFile,        setImportFile]        = useState(null);
    const [isDragging,        setIsDragging]        = useState(false);
    const [isUploading,       setIsUploading]       = useState(false);
    const [importResult,      setImportResult]      = useState(null);
    const [importError,       setImportError]       = useState(null);
    const [showImportDetails, setShowImportDetails] = useState(false);
    const fileInputRef = useRef(null);

    const vips                  = tableData?.vips                  ?? [];
    const leaves                = tableData?.leaves                ?? [];
    const employeeExpectedDates = tableData?.employeeExpectedDates ?? {};
    const totalEmployees = vips.length;

    const isOpsOrHR = ["Operations", "Human Resource", "Security"].includes(authUser?.emp_dept);
    const isSelfOnly = !isOpsOrHR;

    const selfVip = useMemo(() => {
        if (!isSelfOnly) return null;
        return vips.find(v => String(v.employee_id) === String(authUser?.emp_id)) ?? null;
    }, [isSelfOnly, vips, authUser]);

    const filteredVips = useMemo(() => {
        return vips
            .filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [search, vips]);

    const fetchMonthIfNeeded = useCallback(async (month) => {
        if (loadedMonths.has(month)) return;
        const [year, mon] = month.split("-").map(Number);
        const dateFrom    = `${month}-01`;
        const lastDay     = new Date(year, mon, 0).getDate();
        const dateTo      = `${month}-${String(lastDay).padStart(2, "0")}`;
        setIsLoadingLogs(true);
        try {
            const url = route("vip-logs.by-range") + `?date_from=${dateFrom}&date_to=${dateTo}`;
            const res = await fetch(url, {
                headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
            });
            const json = await res.json();
            if (json.success) {
                setAllLogs(prev => {
                    const existingIds = new Set(prev.map(l => l.id));
                    const newLogs = json.data.filter(l => !existingIds.has(l.id));
                    return [...prev, ...newLogs];
                });
                setLoadedMonths(prev => new Set([...prev, month]));
            }
        } catch (e) {
            console.error("Failed to fetch logs for month:", month, e);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [loadedMonths]);

    const handleMonthChange = (month) => { setSelectedMonth(month); fetchMonthIfNeeded(month); };

    useEffect(() => {
        if (isSelfOnly && selfVip) {
            setSelectedVip(selfVip);
            fetchMonthIfNeeded(selectedMonth);
        }
    }, [isSelfOnly, selfVip]);

    const handleDateChange  = (date)  => { setSelectedDate(date);   fetchMonthIfNeeded(date.slice(0, 7)); };
    const handleSelectVip   = (vip)   => { setSelectedVip(vip);     fetchMonthIfNeeded(selectedMonth); };
    const clearSearch = () => setSearch("");

// First, group the logs using the new night-shift aware function
const groupedLogs = useMemo(() => {
    return groupLogsByEmployeeAndDate(allLogs, employeeExpectedDates);
}, [allLogs, employeeExpectedDates]);

// Then filter based on selection
const filteredLogs = useMemo(() => {
    let logs = [];
    
    // Convert grouped logs object to array
    Object.entries(groupedLogs).forEach(([empId, empData]) => {
        Object.entries(empData).forEach(([date, slots]) => {
            const employee = vips.find(v => String(v.employee_id) === empId);
            if (!employee) return;
            
            // Filter by selected VIP
            if (selectedVip && String(selectedVip.employee_id) !== empId) return;
            
            // Filter by date or month
            if (selectedVip) {
                // Month view
                const logMonth = date.slice(0, 7);
                if (logMonth !== selectedMonth) return;
            } else {
                // Date view
                if (date !== selectedDate) return;
            }
            
            logs.push({
                id: `${empId}_${date}`,
                employee_id: empId,
                employee_name: employee.name,
                date: date,
                day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                check_in: slots.check_in || "—",
                check_out: slots.check_out || "—",
            });
        });
    });
    
    // Sort by date
    return logs.sort((a, b) => a.date.localeCompare(b.date));
}, [groupedLogs, selectedVip, selectedDate, selectedMonth, vips]);

        const visibleLogs = useMemo(() => {
            // Ops/HR: see everything as normal
            if (isOpsOrHR) return filteredLogs;

            // In VIP list: only see their own logs
            if (selfVip) return filteredLogs.filter(row =>
                String(row.employee_id ?? "") === String(selfVip.employee_id) ||
                row.employee_name === selfVip.name
            );

            // Not in VIP list and not Ops/HR: see nothing
            return [];
        }, [filteredLogs, isOpsOrHR, selfVip]);

    const LOG_TYPE_FLAG = {
    check_in: "IN", check_out: "OUT",
    };

    const getRowStatus = (row, empId, leaves) => {
        const empScheduled = employeeExpectedDates[String(empId)];
        const scheduledSet = empScheduled ? new Set(Object.keys(empScheduled)) : null;
        if (isEmployeeOnLeaveForDate(empId, row.date, leaves, scheduledSet)) return "leave";
        if (row.check_in && row.check_in !== "—") return "present";
        return "absent";
    };

    const getExportRemarks = (empId, date, timeIn, leaves, employeeExpectedDates) => {
        const empScheduled = employeeExpectedDates[String(empId)];
        const scheduledSet = empScheduled ? new Set(Object.keys(empScheduled)) : null;
        if (isEmployeeOnLeaveForDate(empId, date, leaves, scheduledSet)) return "On Leave";
        if (scheduledSet && !scheduledSet.has(date)) return "Rest Day";
        if (timeIn && timeIn !== "-") return "Present";
        return "Absent";
    };

    const STATUS_ROW_STYLE = {
        present: { backgroundColor: "oklch(var(--su) / 0.12)" },
        absent:  { backgroundColor: "oklch(var(--er) / 0.12)" },
        leave:   { backgroundColor: "oklch(var(--wa) / 0.12)" },
    };

    const STATUS_BADGE = {
        present: { label: "Present",  cls: "badge badge-sm bg-success/20 text-success border-0" },
        absent:  { label: "Absent",   cls: "badge badge-sm bg-error/20  text-error  border-0" },
        leave:   { label: "On Leave", cls: "badge badge-sm bg-warning/20 text-warning border-0" },
    };

const buildExportRowsFromRaw = (rawLogs, vipsData, dateFrom, dateTo) => {
    const exportData = [];

    // ── Use the same grouping logic as the table display ──────────────────
    const grouped = groupLogsByEmployeeAndDate(rawLogs, employeeExpectedDates);

    // Build a set of all dates in the requested range
    const start = new Date(dateFrom + 'T00:00:00');
    const end   = new Date(dateTo   + 'T00:00:00');
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }

    vipsData.forEach(vip => {
        const empId  = String(vip.employee_id);
        const empData = grouped[empId] ?? {};

        dates.forEach(date => {
            const day    = empData[date] ?? {};
            const dayStr = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

            const timeIn  = day.check_in  ? formatTimeDTR(day.check_in)  : '-';
            const timeOut = day.check_out ? formatTimeDTR(day.check_out) : '-';
            const remarks = getExportRemarks(empId, date, timeIn, leaves, employeeExpectedDates);

            exportData.push({
                'Employee ID':   vip.employee_id,
                'Employee Name': vip.name,
                'Date':          formatDateDTR(date),
                'Day':           dayStr,
                'Time In':       timeIn,
                'Time Out':      timeOut,
                'Remarks':       remarks,
            });
        });
    });

    return exportData;
};

    const handleExport = async () => {
    if (!exportDateFrom || !exportDateTo) { alert("Please select both dates"); return; }
    if (new Date(exportDateFrom) > new Date(exportDateTo)) { alert("Date from cannot be after date to"); return; }

    setIsExportOpen(false);
    setExportLoading(true);
    setExportProgress(0);
    setExportMessage('Queuing export job...');

    try {
        const { data } = await axios.post(route('mgmt-logs.export'), {
            date_from: exportDateFrom,
            date_to:   exportDateTo,
        });

        const jobId = data.job_id;
        if (!jobId) throw new Error('No job ID returned from server.');

        await new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const { data: state } = await axios.get(route('mgmt-logs.export-progress'), {
                        params: { job_id: jobId },
                    });

                    setExportProgress(state.progress ?? 0);
                    setExportMessage(state.message ?? 'Processing...');

                    if (state.status === 'done') {
                        clearInterval(interval);
                        resolve(jobId);
                    } else if (state.status === 'failed' || state.status === 'not_found') {
                        clearInterval(interval);
                        reject(new Error(state.message ?? 'Export failed.'));
                    }
                } catch (pollErr) {
                    clearInterval(interval);
                    reject(pollErr);
                }
            }, 1500);
        });

        setExportMessage('Downloading...');
        const link = document.createElement('a');
        link.href  = route('mgmt-logs.export-download') + `?job_id=${jobId}`;
        link.setAttribute('download', `VIP_DTR_${exportDateFrom}_to_${exportDateTo}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();

    } catch (e) {
        alert('Export failed: ' + (e.message ?? 'Unknown error'));
    } finally {
        setExportLoading(false);
        setExportProgress(0);
        setExportMessage('Preparing your export...');
    }
};

    const handleQuickExport = () => {
        if (visibleLogs.length === 0) { alert("No data to export!"); return; }

        const exportData = visibleLogs.map((row) => {
            const empId   = selectedVip
                ? selectedVip.employee_id
                : vips.find((v) => v.name === row.employee_name)?.employee_id ?? "";
            const empName = selectedVip ? selectedVip.name : row.employee_name;
            const dayStr  = new Date(row.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
            const timeIn  = row.check_in  && row.check_in  !== "—" ? formatTimeDTR(row.check_in)  : "-";
            const timeOut = row.check_out && row.check_out !== "—" ? formatTimeDTR(row.check_out) : "-";
            const remarks = getExportRemarks(empId, row.date, timeIn, leaves, employeeExpectedDates);

            return {
                "Employee ID":   empId,
                "Employee Name": empName,
                "Date":          formatDateDTR(row.date),
                "Day":           dayStr,
                "Time In":       timeIn,
                "Time Out":      timeOut,
                "Remarks":       remarks,
            };
        });

        if (exportData.length === 0) { alert("No time entries found."); return; }

        exportToCSV(
            exportData,
            selectedVip
                ? `${selectedVip.name.replace(/\s+/g, "_")}_DTR_${selectedMonth}`
                : `VIP_Logs_${selectedDate}`
        );
    };

    const handleImportFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) { setImportFile(selected); setImportResult(null); setImportError(null); }
    };
    const handleImportDrop = (e) => {
        e.preventDefault(); setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
            setImportFile(dropped); setImportResult(null); setImportError(null);
        }
    };
    const handleImportSubmit = () => {
        if (!importFile) return;
        setIsUploading(true); setImportError(null);
        router.post(route("import-scan-logs.store"), { file: importFile }, {
            forceFormData: true, preserveScroll: true, preserveState: true,
            onSuccess: (page) => {
                const result = page.props.flash?.import_result;
                if (result) setImportResult(result);
                setLoadedMonths(new Set()); setImportFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            },
            onError: (errors) => setImportError(Object.values(errors).join(", ") || "Import failed."),
            onFinish: () => setIsUploading(false),
        });
    };
    const closeImportModal = () => {
        setIsImportOpen(false); setImportFile(null); setImportResult(null);
        setImportError(null); setShowImportDetails(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    const statusIcon = (status) => {
        if (status === "imported") return <CheckCircleOutlined className="text-success" />;
        if (status === "skipped")  return <CloseCircleOutlined className="text-error" />;
        if (status === "no_data")  return <InfoCircleOutlined className="text-warning" />;
        return null;
    };

    return (
    <AuthenticatedLayout user={authUser}>
        <Head title="Management Logs" />

        <LoadingModal show={exportLoading} message={exportMessage} progress={exportProgress} />

        <div
                className="overflow-hidden flex p-4"
                style={{ height: `calc(100vh - ${NAVBAR_HEIGHT}px - ${PADDING_VERTICAL}px)` }}
            >
                <div className="flex-1 flex flex-col min-h-0 border border-base-300 rounded-lg bg-base-100 shadow-sm">

                    {/* ── Header ─────────────────────────────────────────────── */}
                    <div className="px-4 py-6 border-b border-base-300 shrink-0">
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
                                    <CrownOutlined className="mr-1 text-yellow-500" />
                                    Management Logs
                                </h1>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                                {isOpsOrHR && (
                                    <>
                                        <button className="btn btn-sm btn-outline btn-info gap-1" onClick={() => setIsImportOpen(true)}>
                                            <UploadOutlined />
                                            <span className="hidden sm:inline">Import DTR</span>
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline btn-success gap-1"
                                            onClick={handleQuickExport}
                                            disabled={visibleLogs.length === 0}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">Export Current View</span>
                                        </button>
                                        <button className="btn btn-sm btn-primary gap-1" onClick={() => setIsExportOpen(true)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">Export Date Range</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">

                        {/* ── Sidebar ─────────────────────────────────────────── */}
                        <aside className={`border-r border-base-300 flex flex-col bg-base-200 transition-all duration-300 overflow-hidden shrink-0
                            ${sidebarOpen ? "w-36 sm:w-44 md:w-52 xl:w-72 p-2 xl:p-4" : "w-0 p-0"}`}>
                            {sidebarOpen && (
                                <>
                                    {isSelfOnly ? (
                                        /* Self-only: just show their own name, no interaction */
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
                                        /* Ops / HR: full list with search */
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
                                                            onClick={() => handleSelectVip(vip)}
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

                        {/* ── Main Content ─────────────────────────────────────── */}
                        <div className="flex-1 p-2 xl:p-4 overflow-auto min-w-0 flex flex-col gap-2 xl:gap-4">

                            {/* Toolbar row */}
                            <div className="flex items-center justify-between shrink-0 gap-2 flex-wrap">
                                <h2 className="font-semibold text-base-content" style={{ fontSize: "clamp(9px, 0.9vw, 16px)" }}>
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
                                            style={{ fontSize: "clamp(8px, 0.75vw, 13px)", padding: "clamp(3px, 0.4vw, 8px) clamp(6px, 0.7vw, 14px)" }}
                                            value={selectedMonth}
                                            onChange={(e) => handleMonthChange(e.target.value)}
                                        />
                                    ) : (
                                        <input
                                            type="date"
                                            className="appearance-none bg-base-100 border border-base-300 rounded-lg text-base-content focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                            style={{ fontSize: "clamp(8px, 0.75vw, 13px)", padding: "clamp(3px, 0.4vw, 8px) clamp(6px, 0.7vw, 14px)" }}
                                            value={selectedDate}
                                            onChange={(e) => handleDateChange(e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto min-h-0 border border-base-300 rounded-lg">
                                <table className="w-full" style={{ fontSize: "clamp(8px, 0.75vw, 13px)" }}>
                                    <thead className="sticky top-0 bg-base-200 z-10">
                                        <tr>
                                            {!selectedVip && (
                                                <th className="text-left font-semibold text-base-content opacity-60 whitespace-nowrap"
                                                    style={{ padding: "clamp(4px, 0.5vw, 10px) clamp(6px, 0.7vw, 14px)" }}>
                                                    Employee
                                                </th>
                                            )}
                                            {["Date", "Day", "Check In", "Check Out", "Status"].map(col => (
                                                <th key={col}
                                                    className="text-left font-semibold text-base-content opacity-60 whitespace-nowrap"
                                                    style={{ padding: "clamp(4px, 0.5vw, 10px) clamp(6px, 0.7vw, 14px)" }}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleLogs.length > 0 ? (
                                            visibleLogs.map((row) => {
                                                const empId  = selectedVip
                                                    ? selectedVip.employee_id
                                                    : vips.find(v => v.name === row.employee_name)?.employee_id;
                                                const status = getRowStatus(row, empId, leaves);
                                                const badge  = STATUS_BADGE[status];
                                                return (
                                                    <tr key={row.id}
                                                        className="border-b border-base-200 transition-colors"
                                                        style={STATUS_ROW_STYLE[status]}>
                                                        {!selectedVip && (
                                                            <td className="font-medium truncate max-w-[120px]"
                                                                style={{ padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)" }}
                                                                title={row.employee_name}>
                                                                {row.employee_name}
                                                            </td>
                                                        )}
                                                        {[
    new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
    row.day,
    row.check_in ?? "—",
    row.check_out ?? "—"
].map((val, i) => (
                                                            <td key={i}
                                                                className={`whitespace-nowrap ${!val || val === "—" ? "opacity-40" : ""}`}
                                                                style={{ padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)" }}>
                                                                {val}
                                                            </td>
                                                        ))}
                                                        <td style={{ padding: "clamp(4px, 0.45vw, 9px) clamp(6px, 0.7vw, 14px)" }}>
                                                            <span className={badge.cls}>{badge.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={selectedVip ? 5 : 6}
                                                    className="text-center text-base-content opacity-50 py-12"
                                                    style={{ fontSize: "clamp(9px, 0.8vw, 14px)" }}>
                                                    {isLoadingLogs ? "Loading…" : "No logs found"}
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
                            <button className="btn btn-sm btn-circle btn-ghost" onClick={closeImportModal}>✕</button>
                        </div>
                        {importError && (
                            <div className="alert alert-error mb-4">
                                <CloseCircleOutlined /><span>{importError}</span>
                            </div>
                        )}
                        {importResult && (
                            <div className="mb-6">
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="stat bg-success/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">Inserted</div>
                                        <div className="stat-value text-success text-2xl">{importResult.inserted}</div>
                                        <div className="stat-desc text-xs">log entries saved</div>
                                    </div>
                                    <div className="stat bg-warning/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">Skipped</div>
                                        <div className="stat-value text-warning text-2xl">{importResult.skipped}</div>
                                        <div className="stat-desc text-xs">rows not imported</div>
                                    </div>
                                    <div className="stat bg-error/10 rounded-xl px-3 py-2">
                                        <div className="stat-title text-xs">Errors</div>
                                        <div className="stat-value text-error text-2xl">{importResult.errors?.length ?? 0}</div>
                                        <div className="stat-desc text-xs">parse / save errors</div>
                                    </div>
                                </div>
                                {importResult.errors?.length > 0 && (
                                    <div className="alert alert-warning mb-3 text-sm">
                                        <WarningOutlined />
                                        <ul className="list-disc list-inside space-y-1">
                                            {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {importResult.details?.length > 0 && (
                                    <>
                                        <button className="btn btn-ghost btn-xs mb-2" onClick={() => setShowImportDetails(v => !v)}>
                                            {showImportDetails ? "Hide" : "Show"} row details ({importResult.details.length})
                                        </button>
                                        {showImportDetails && (
                                            <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                                <table className="table table-xs table-zebra w-full">
                                                    <thead>
                                                        <tr><th>Row</th><th>ID</th><th>Name</th><th>Status</th><th>Inserted</th><th>Note</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {importResult.details.map((d, i) => (
                                                            <tr key={i}>
                                                                <td>{d.row}</td>
                                                                <td className="font-mono">{d.id}</td>
                                                                <td>{d.name}</td>
                                                                <td className="flex items-center gap-1 text-xs">
                                                                    {statusIcon(d.status)}
                                                                    <span className="capitalize">{d.status?.replace("_", " ")}</span>
                                                                </td>
                                                                <td>{d.inserted ?? "-"}</td>
                                                                <td className="text-xs opacity-70">{d.reason || (d.errors?.join("; ") ?? "")}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="divider my-3 text-xs">Upload another file</div>
                            </div>
                        )}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4
                                ${isDragging ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary hover:bg-base-200"}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleImportDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileExcelOutlined className="text-4xl text-success mb-2" />
                            <p className="font-semibold text-base-content mb-1">
                                {importFile ? importFile.name : "Drag & drop your Excel file here"}
                            </p>
                            <p className="text-sm opacity-60">
                                {importFile ? `${(importFile.size / 1024).toFixed(1)} KB — click to change` : "or click to browse  •  .xlsx / .xls accepted"}
                            </p>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
                        </div>
                        <div className="text-xs text-base-content/60 bg-base-200 rounded-lg px-4 py-3 mb-4 space-y-1">
                            <p className="font-semibold text-base-content mb-1">Expected format</p>
                            <p>• Row 3 = date headers (e.g. <code>07-Feb</code>) in every other column starting at col C</p>
                            <p>• Row 5+ = employee rows: <strong>col A</strong> = ID No., <strong>col B</strong> = Name, then IN/OUT pairs per date</p>
                            <p>• Only employees in the VIP masterlist (EMPPOSITION 3 or 4, ACCSTATUS 1) will be imported</p>
                            <p>• <code>XXX</code>, blank cells, and special codes (<code>SL VL OB LEAVE BL</code>) are handled automatically</p>
                        </div>
                        <div className="modal-action mt-0 pt-0">
                            <button className="btn btn-ghost btn-sm" onClick={closeImportModal}>Close</button>
                            <button className="btn btn-primary btn-sm gap-2" onClick={handleImportSubmit} disabled={!importFile || isUploading}>
                                {isUploading ? <><span className="loading loading-spinner loading-xs" />Importing…</> : <><UploadOutlined />Import</>}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={closeImportModal} />
                </dialog>
            )}

            {/* ── Export Date-Range Modal ─────────────────────────────────────── */}
            {isExportOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box max-w-md">
                        <h3 className="font-bold text-lg mb-4 text-base-content">Export VIP DTR (.csv)</h3>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text font-semibold text-base-content">Date From</span></label>
                                <input type="date" className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text font-semibold text-base-content">Date To</span></label>
                                <input type="date" className="appearance-none bg-base-100 border border-base-300 rounded-lg px-4 py-2 w-full text-base-content focus:outline-none focus:ring-2 focus:ring-primary" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
                            </div>
                            <div className="alert alert-info">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-base-content text-sm">
                                    This will export DTR for all <strong>{totalEmployees} VIP employees</strong> within the selected date range.
                                </div>
                            </div>
                            <div className="bg-base-200 rounded-lg p-4 text-sm space-y-1">
                                <div className="font-semibold mb-2 text-base-content">Export Format:</div>
                                {[
                                    ["Headers", "Employee ID, Employee Name, Date, Day, Time In, Time Out"],
                                    ["Date",    "M/D/YYYY"],
                                    ["Time In / Time Out", "h:mm:ss AM/PM  (or  -  if absent)"],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-start text-base-content">
                                        <span className="text-primary mr-2">•</span>
                                        <span><strong>{label}:</strong> {value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-action">
                            <button className="btn btn-outline btn-sm text-base-content" onClick={() => setIsExportOpen(false)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleExport}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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