import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import { CrownOutlined, SearchOutlined, UploadOutlined, FileExcelOutlined, CloseCircleOutlined, CheckCircleOutlined, InfoCircleOutlined, WarningOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

import { exportToCSV } from "@/utils/csvExport";
import {
    formatDateDTR,
    formatTimeDTR,
    generateDateRange,
    groupLogsByEmployeeAndDate,
} from "@/utils/logFormatters";
import { useVipLogsFiltering } from "@/hooks/useVipLogsFiltering";

const NAVBAR_HEIGHT    = 64;
const PADDING_VERTICAL = 32;

const isEmployeeOnLeaveForDate = (employeeId, date, leaves) => {
    if (!leaves || leaves.length === 0) return false;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return leaves.some((leave) => {
        if (String(leave.EMPLOYID) !== String(employeeId)) return false;
        const leaveStart = new Date(leave.DATESTART);
        const leaveEnd   = new Date(leave.DATEEND);
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        return targetDate >= leaveStart && targetDate <= leaveEnd;
    });
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

    const [isExportOpen,   setIsExportOpen]   = useState(false);
    const [exportDateFrom, setExportDateFrom] = useState("2026-01-01");
    const [exportDateTo,   setExportDateTo]   = useState(today);

    const [isImportOpen,      setIsImportOpen]      = useState(false);
    const [importFile,        setImportFile]        = useState(null);
    const [isDragging,        setIsDragging]        = useState(false);
    const [isUploading,       setIsUploading]       = useState(false);
    const [importResult,      setImportResult]      = useState(null);
    const [importError,       setImportError]       = useState(null);
    const [showImportDetails, setShowImportDetails] = useState(false);
    const fileInputRef = useRef(null);

    const vips   = tableData?.vips   ?? [];
    const leaves = tableData?.leaves ?? [];
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

    const filteredLogs = useVipLogsFiltering(
        selectedVip, selectedDate, selectedMonth, vips, allLogs
        );

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
        if (isEmployeeOnLeaveForDate(empId, row.date, leaves)) return "leave";
        if (row.check_in && row.check_in !== "—") return "present";
        return "absent";
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
        const start = new Date(dateFrom), end = new Date(dateTo), dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
            dates.push(d.toISOString().split("T")[0]);
        const logMap = {};
        rawLogs.forEach(log => {
            if (!LOG_TYPE_FLAG[log.log_type]) return;
            const key = `${log.employee_id}_${log.log_date}`;
            if (!logMap[key]) logMap[key] = [];
            logMap[key].push(log);
        });
        vipsData.forEach(vip => {
            dates.forEach(date => {
                const key  = `${vip.employee_id}_${date}`;
                const logs = logMap[key];
                if (logs && logs.length > 0) {
                    logs.sort((a, b) => a.log_time.localeCompare(b.log_time));
                    logs.forEach(log => exportData.push({
                        EmpCode: vip.employee_id, EmployeeName: vip.name,
                        DateDTR: formatDateDTR(date),
                        TimeDTR: formatTimeDTR(log.formatted_time || log.log_time),
                        Flag: LOG_TYPE_FLAG[log.log_type],
                    }));
                } else {
                    exportData.push({
                        EmpCode: vip.employee_id, EmployeeName: vip.name,
                        DateDTR: formatDateDTR(date), TimeDTR: "-", Flag: "-",
                    });
                }
            });
        });
        return exportData;
    };

    const handleExport = async () => {
        if (!exportDateFrom || !exportDateTo) { alert("Please select both dates"); return; }
        if (new Date(exportDateFrom) > new Date(exportDateTo)) { alert("Date from cannot be after date to"); return; }
        try {
            const url = route("vip-logs.by-range") + `?date_from=${exportDateFrom}&date_to=${exportDateTo}`;
            const res = await fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" } });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || "Server error");
            exportToCSV(buildExportRowsFromRaw(json.data, vips, exportDateFrom, exportDateTo), `VIP_DTR_${exportDateFrom}_to_${exportDateTo}`);
        } catch (e) { alert("Export failed: " + e.message); }
        setIsExportOpen(false);
    };

    const handleQuickExport = () => {
        if (visibleLogs.length === 0) { alert("No data to export!"); return; }
            const exportData = [];
                visibleLogs.forEach((row) => {
            const empId   = selectedVip ? selectedVip.employee_id : vips.find((v) => v.name === row.employee_name)?.employee_id || "";
            const empName = selectedVip ? selectedVip.name : row.employee_name;
            [
                { time: row.check_in,    flag: "IN"  },
                { time: row.break_out_1, flag: "OUT" },
                { time: row.break_in_1,  flag: "IN"  },
                { time: row.break_out_2, flag: "OUT" },
                { time: row.break_in_2,  flag: "IN"  },
                { time: row.check_out,   flag: "OUT" },
            ].forEach((entry) => {
                if (entry.time && entry.time !== "—") exportData.push({
                    EmpCode: empId, EmployeeName: empName,
                    DateDTR: formatDateDTR(row.date), TimeDTR: formatTimeDTR(entry.time), Flag: entry.flag,
                });
            });
        });
        if (exportData.length === 0) { alert("No time entries found."); return; }
        exportToCSV(exportData, selectedVip ? `${selectedVip.name.replace(/\s+/g, "_")}_DTR_${selectedMonth}` : `VIP_Logs_${selectedDate}`);
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
                                                        {[row.date, row.day, row.check_in ?? "—", row.check_out ?? "—"].map((val, i) => (
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
                                {[["Headers","EmpCode, EmployeeName, DateDTR, TimeDTR, Flag"],["DateDTR","DD/MM/YYYY"],["TimeDTR","h:mm:ss AM/PM"],["Flag","IN or OUT"]].map(([label, value]) => (
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