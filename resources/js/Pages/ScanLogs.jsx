import React, { useState, useEffect, useCallback } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import {
    UserOutlined,
    TeamOutlined,
    SearchOutlined,
    ScanOutlined,
    LeftOutlined,
    RightOutlined,
    DoubleLeftOutlined,
    DoubleRightOutlined,
    IdcardOutlined,
    QrcodeOutlined,
    CloseOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    ClockCircleOutlined,
} from "@ant-design/icons";

import {
    logTypeOptions,
    getLogTypeBadge,
    findEmployeeByCode,
    setupScannerListener,
} from "@/utils/scannerHelpers";

import { exportEmployeeQRCodesToDocx } from "@/utils/qrDocxExport";

// ─── Fingerprint Icon ─────────────────────────────────────────────────────────
function FingerprintIcon({ className = "", style = {} }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 12c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 2.9-1.4 5.47-3.5 6.5" />
            <path d="M5.5 12c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5c0 4.36-2.1 8.22-5.5 10" />
            <path d="M11 12c0-.55.45-1 1-1s1 .45 1 1c0 1.45-.7 2.74-1.5 3.5" />
        </svg>
    );
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    check_in:    {
        bg: "rgba(16,185,129,0.07)", border: "#10b981",
        label: "Present", dotColor: "#10b981",
        badgeBg: "#d1fae5", badgeColor: "#065f46", badgeBorder: "#6ee7b7",
        headerBg: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)",
    },
    check_out:   {
        bg: "rgba(59,130,246,0.07)", border: "#3b82f6",
        label: "Checked Out", dotColor: "#3b82f6",
        badgeBg: "#dbeafe", badgeColor: "#1e3a8a", badgeBorder: "#93c5fd",
        headerBg: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)",
    },
    break_out:   {
        bg: "rgba(245,158,11,0.07)", border: "#f59e0b",
        label: "On Break", dotColor: "#f59e0b",
        badgeBg: "#fef3c7", badgeColor: "#78350f", badgeBorder: "#fcd34d",
        headerBg: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)",
    },
    break_in:    {
        bg: "rgba(20,184,166,0.07)", border: "#14b8a6",
        label: "Back fr. Break", dotColor: "#14b8a6",
        badgeBg: "#ccfbf1", badgeColor: "#134e4a", badgeBorder: "#5eead4",
        headerBg: "linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)",
    },
    absent:      {
        bg: "rgba(239,68,68,0.07)", border: "#ef4444",
        label: "Absent", dotColor: "#ef4444",
        badgeBg: "#fee2e2", badgeColor: "#991b1b", badgeBorder: "#fca5a5",
        headerBg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)",
    },
    rest_day:    {
        bg: "rgba(107,114,128,0.04)", border: "#9ca3af",
        label: "Rest Day", dotColor: "#9ca3af",
        badgeBg: "#f3f4f6", badgeColor: "#374151", badgeBorder: "#d1d5db",
        headerBg: "linear-gradient(135deg, rgba(107,114,128,0.08) 0%, rgba(107,114,128,0.02) 100%)",
    },
    no_schedule: {
        bg: "transparent", border: "var(--fallback-bc, oklch(var(--bc)/0.2))",
        label: null, dotColor: null,
        badgeBg: null, badgeColor: null, badgeBorder: null,
        headerBg: "transparent",
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

function isLogFromToday(logTime) {
    if (!logTime) return false;
    // logTime may be "2025-07-01 08:30:00" or ISO string
    const d = new Date(logTime.replace(" ", "T"));
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
}

function getEmployeeTodayShift(emp, shiftCodeMap) {
    const today = todayStr();
    const records = emp.scheduler_records ?? [];
    for (const record of records) {
        if (!record.payroll_date_start || !record.schedule) continue;
        const base = new Date(record.payroll_date_start + "T00:00:00");
        for (const [dayNo, shiftId] of Object.entries(record.schedule)) {
            const d = new Date(base);
            d.setDate(base.getDate() + parseInt(dayNo) - 1);
            const dateStr = d.toLocaleDateString("en-CA");
            if (dateStr === today) {
                const shiftInfo = shiftCodeMap?.[String(shiftId)] ?? null;
                return { shiftInfo, shiftId };
            }
        }
    }
    return null;
}

function getEmployeeStatus(emp, shiftCodeMap) {
    const todayShift = getEmployeeTodayShift(emp, shiftCodeMap);

    // Determine if today's shift is a rest day
    const shiftCode = todayShift?.shiftInfo?.shiftcode?.toUpperCase() ?? "";
    const isRestDay = shiftCode.includes("RD");

    if (isRestDay) return "rest_day";
    if (!todayShift) return "no_schedule";

    // Has a working shift today — check latest log
    if (emp.latest_log_type && isLogFromToday(emp.latest_log_time)) {
        return emp.latest_log_type; // check_in | check_out | break_out | break_in
    }

    // Expected today but no log → absent
    return "absent";
}

function fmt12(timeStr) {
    if (!timeStr || timeStr === "—") return null;
    try {
        const [h, m] = timeStr.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12  = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    } catch { return timeStr; }
}

// ─── Actual Log Times Badge ────────────────────────────────────────────────────
function ActualLogBadge({ emp }) {
    const checkInTime  = emp.today_checkin_time;
    const checkOutTime = emp.today_checkout_time;

    if (!checkInTime && !checkOutTime) return null;

    const fmt = (t) => {
        if (!t) return null;
        try {
            const time = t.includes(" ") ? t.split(" ")[1] : t;
            const [h, m] = time.split(":");
            const hour = parseInt(h, 10);
            const ampm = hour >= 12 ? "PM" : "AM";
            return `${hour % 12 || 12}:${m} ${ampm}`;
        } catch { return t; }
    };

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "3px 6px",
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 6,
            fontSize: 9, fontWeight: 600,
            color: "#4f46e5",
            width: "100%",
        }}>
            <ClockCircleOutlined style={{ fontSize: 9 }} />
            {checkInTime  && <span title="Check-in">{fmt(checkInTime)}</span>}
            {checkInTime  && checkOutTime && <span style={{ opacity: 0.4 }}>→</span>}
            {checkOutTime && <span title="Check-out">{fmt(checkOutTime)}</span>}
            {checkInTime  && !checkOutTime && <span style={{ opacity: 0.35 }}>→ ?</span>}
        </div>
    );
}

// ─── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ emp, shiftCodeMap, onOpenQR, onOpenFP }) {
    const status    = getEmployeeStatus(emp, shiftCodeMap);
    const cfg       = STATUS_CONFIG[status] ?? STATUS_CONFIG.no_schedule;
    const initials  = emp.EMPNAME?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() ?? "?";

    return (
        <div style={{
            border: `1.5px solid ${cfg.border}`,
            background: cfg.bg,
            borderRadius: 10,
            overflow: "hidden",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
        }}
            className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
            {/* Status header strip */}
            {cfg.label && (
                <div style={{
                    background: cfg.headerBg,
                    borderBottom: `1px solid ${cfg.border}20`,
                    padding: "3px 8px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                    <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                        textTransform: "uppercase", color: cfg.badgeColor,
                    }}>
                        {cfg.label}
                    </span>
                    <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: cfg.dotColor,
                        boxShadow: `0 0 4px ${cfg.dotColor}80`,
                    }} />
                </div>
            )}

            <div style={{ padding: "10px 10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: cfg.badgeBg ?? "rgba(99,102,241,0.1)",
                        border: `2px solid ${cfg.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.badgeColor ?? "#6366f1" }}>
                            {initials}
                        </span>
                    </div>
                </div>

                {/* Name & details */}
                <div style={{ width: "100%", textAlign: "center" }}>
                    <p className="text-base-content" style={{
                        fontSize: 11, fontWeight: 600,
                        lineHeight: 1.3, marginBottom: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={emp.EMPNAME}>
                        {emp.EMPNAME}
                    </p>
                    <p className="text-base-content" style={{
                        fontSize: 9, opacity: 0.45,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={emp.JOB_TITLE}>
                        {emp.JOB_TITLE}
                    </p>
                    <p className="text-base-content" style={{ fontSize: 9, opacity: 0.28, fontFamily: "monospace" }}>
                        {emp.EMPLOYID}
                    </p>
                </div>

                {/* Department pill */}
                <span style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px", borderRadius: 999,
                    fontSize: 9, fontWeight: 600,
                    background: cfg.badgeBg ?? "#dbeafe",
                    color: cfg.badgeColor ?? "#1e3a8a",
                    border: `1px solid ${cfg.badgeBorder ?? "#93c5fd"}`,
                    maxWidth: "100%",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={emp.DEPARTMENT}>
                    {emp.DEPARTMENT}
                </span>

                {/* Actual check-in / check-out times */}
                <ActualLogBadge emp={emp} />

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 4, width: "100%", marginTop: "auto" }}>
                    <button
                        onClick={onOpenQR}
                        className="btn btn-xs btn-outline flex-1 gap-1 min-h-0 h-7"
                        style={{
                            borderColor: cfg.border,
                            color: cfg.badgeColor,
                            fontSize: 10,
                        }}
                        title="Scan QR Code"
                    >
                        <QrcodeOutlined style={{ fontSize: 11 }} />
                        QR
                    </button>
                    <button
                        onClick={onOpenFP}
                        className="btn btn-xs btn-outline flex-1 gap-1 min-h-0 h-7"
                        style={{ fontSize: 10 }}
                        title="Scan Fingerprint"
                    >
                        <FingerprintIcon style={{ width: 11, height: 11 }} />
                        FP
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ScanLogs({ auth }) {
    const { employees: allEmployees, flash, shiftCodeMap = {} } = usePage().props;

    const NAVBAR_HEIGHT    = 64;
    const PADDING_VERTICAL = 32;

    const [search,             setSearch]             = useState("");
    const [filteredEmployees,  setFilteredEmployees]  = useState(allEmployees);

    // ── QR Scanner Modal ──────────────────────────────────────────────────────
    const [isQRModalOpen,   setIsQRModalOpen]   = useState(false);
    const [scannedCode,     setScannedCode]     = useState("");
    const [scannedEmployee, setScannedEmployee] = useState(null);
    const [isSaving,        setIsSaving]        = useState(false);
    const [logType,         setLogType]         = useState("check_in");

    // ── QR Display Modal ──────────────────────────────────────────────────────
    const [isQRDisplayModalOpen,  setIsQRDisplayModalOpen]  = useState(false);
    const [selectedEmployeeForQR, setSelectedEmployeeForQR] = useState(null);
    const [qrLogType,             setQRLogType]             = useState("check_in");

    // ── Fingerprint Modal ─────────────────────────────────────────────────────
    const [isFPModalOpen,  setIsFPModalOpen]  = useState(false);
    const [fpLogType,      setFpLogType]      = useState("check_in");
    // idle | scanning | found | saving | saved | notfound | mismatch | error
    const [fpState,        setFpState]        = useState("idle");
    const [fpEmployee,     setFpEmployee]     = useState(null);
    const [fpPreselected,  setFpPreselected]  = useState(null);
    const [fpError,        setFpError]        = useState(null);
    // ref so handleFPScan always sees the latest logType without stale closure
    const fpLogTypeRef = React.useRef(fpLogType);
    useEffect(() => { fpLogTypeRef.current = fpLogType; }, [fpLogType]);

    // ── Export ────────────────────────────────────────────────────────────────
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (flash?.success) console.log("✓", flash.success);
        if (flash?.error)   console.error("✗", flash.error);
    }, [flash]);

    // ── Scanner listener ──────────────────────────────────────────────────────
    const handleScan = (code) => {
        const trimmed = code.replace(/^0+/, "");
        if (!trimmed.startsWith("2")) return;
        setScannedCode(trimmed);
        const emp = findEmployeeByCode(allEmployees, trimmed);
        if (emp) {
            setScannedEmployee(emp);
            setIsSaving(true);
            router.post(route("scan-logs.store"), {
                employee_id:   emp.EMPLOYID,
                employee_name: emp.EMPNAME,
                department:    emp.DEPARTMENT,
                job_title:     emp.JOB_TITLE,
                prodline:      emp.PRODLINE,
                station:       emp.STATION,
                log_type:      logType,
            }, {
                preserveScroll: true, preserveState: true,
                onSuccess: () => setTimeout(() => { setScannedCode(""); setScannedEmployee(null); }, 2000),
                onError:   (e) => alert("Failed: " + JSON.stringify(e)),
                onFinish:  () => setIsSaving(false),
            });
        } else {
            setScannedEmployee(null);
        }
    };

    useEffect(() => {
        const cleanup = setupScannerListener(handleScan, isQRModalOpen);
        return cleanup;
    }, [isQRModalOpen, allEmployees, logType]);

    // ── QR Display scan ───────────────────────────────────────────────────────
    const handleQRDisplayScan = (code) => {
        const trimmed = code.replace(/^0+/, "");
        if (!trimmed.startsWith("2")) return;
        if (!selectedEmployeeForQR) return;
        if (trimmed.toLowerCase() !== selectedEmployeeForQR.EMPLOYID.toLowerCase()) {
            alert("Scanned QR code does not match the displayed employee!");
            return;
        }
        setIsSaving(true);
        router.post(route("scan-logs.store"), {
            employee_id:   selectedEmployeeForQR.EMPLOYID,
            employee_name: selectedEmployeeForQR.EMPNAME,
            department:    selectedEmployeeForQR.DEPARTMENT,
            job_title:     selectedEmployeeForQR.JOB_TITLE,
            prodline:      selectedEmployeeForQR.PRODLINE,
            station:       selectedEmployeeForQR.STATION,
            log_type:      qrLogType,
        }, {
            preserveScroll: true, preserveState: true,
            onSuccess: () => { alert(`✓ Logged for ${selectedEmployeeForQR.EMPNAME}`); setTimeout(closeQRDisplayModal, 1000); },
            onError:   (e) => alert("Failed: " + JSON.stringify(e)),
            onFinish:  () => setIsSaving(false),
        });
    };

    useEffect(() => {
        const cleanup = setupScannerListener(handleQRDisplayScan, isQRDisplayModalOpen);
        return cleanup;
    }, [isQRDisplayModalOpen, allEmployees, qrLogType, selectedEmployeeForQR]);

    // ── Fingerprint: scan → save → reset, fully automatic ────────────────────
    const fpPreselectedRef = React.useRef(fpPreselected);
    useEffect(() => { fpPreselectedRef.current = fpPreselected; }, [fpPreselected]);

    const handleFPScan = useCallback(async () => {
        setFpState("scanning");
        setFpEmployee(null);
        setFpError(null);
        try {
            const res = await axios.post(route("scan-logs.fingerprint-identify"));
            if (!res.data.success) throw new Error(res.data.message ?? "Scan failed");
            const emp = findEmployeeByCode(allEmployees, res.data.employee_id);
            if (!emp) {
                setFpState("notfound");
                setFpError("No employee matched this fingerprint.");
                return;
            }
            const pre = fpPreselectedRef.current;
            if (pre && emp.EMPLOYID.toLowerCase() !== pre.EMPLOYID.toLowerCase()) {
                setFpState("mismatch");
                setFpError(`Fingerprint belongs to ${emp.EMPNAME}, not ${pre.EMPNAME}.`);
                return;
            }
            // Found — set employee then transition to "saving" in the same tick
            setFpEmployee(emp);
            setFpState("found"); // triggers auto-save via useEffect below
        } catch (e) {
            setFpError(e.response?.data?.message ?? e.message ?? "Scan failed");
            setFpState("error");
        }
    }, [allEmployees]);

    // Auto-save as soon as a match is found
    useEffect(() => {
        if (fpState !== "found" || !fpEmployee) return;
        setFpState("saving");
        router.post(route("scan-logs.store"), {
            employee_id:   fpEmployee.EMPLOYID,
            employee_name: fpEmployee.EMPNAME,
            department:    fpEmployee.DEPARTMENT,
            job_title:     fpEmployee.JOB_TITLE,
            prodline:      fpEmployee.PRODLINE,
            station:       fpEmployee.STATION,
            log_type:      fpLogTypeRef.current,
        }, {
            preserveScroll: true, preserveState: true,
            onSuccess: () => setFpState("saved"),
            onError:   (e) => { setFpError(JSON.stringify(e)); setFpState("error"); },
        });
    }, [fpState, fpEmployee]);

    // Auto-reset to idle then auto-rescan 2 s after saved
    useEffect(() => {
        if (fpState !== "saved") return;
        const t = setTimeout(() => {
            setFpEmployee(null);
            setFpError(null);
            setFpState("idle");
        }, 2000);
        return () => clearTimeout(t);
    }, [fpState]);

    // Auto-start scan when modal opens or when state returns to idle
    useEffect(() => {
        if (!isFPModalOpen || fpState !== "idle") return;
        const t = setTimeout(() => handleFPScan(), 400); // small delay so UI settles
        return () => clearTimeout(t);
    }, [isFPModalOpen, fpState, handleFPScan]);

    const openFPModal = () => {
        setIsFPModalOpen(true); setFpPreselected(null);
        setFpState("idle"); setFpEmployee(null); setFpError(null); setFpLogType("check_in");
    };
    const openFPModalForEmployee = (emp) => {
        setIsFPModalOpen(true); setFpPreselected(emp);
        setFpState("idle"); setFpEmployee(null); setFpError(null); setFpLogType("check_in");
    };
    const closeFPModal = () => {
        setIsFPModalOpen(false); setFpPreselected(null);
        setFpState("idle"); setFpEmployee(null); setFpError(null);
    };

    // ── Search filter ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!search.trim()) { setFilteredEmployees(allEmployees); return; }
        const s = search.toLowerCase().trim();
        setFilteredEmployees(allEmployees.filter(e =>
            e.EMPNAME?.toLowerCase().includes(s) ||
            e.EMPLOYID?.toLowerCase().includes(s) ||
            e.DEPARTMENT?.toLowerCase().includes(s) ||
            e.JOB_TITLE?.toLowerCase().includes(s)
        ));
    }, [search, allEmployees]);

    const openQRModal          = () => { setIsQRModalOpen(true); setScannedCode(""); setScannedEmployee(null); setIsSaving(false); setLogType("check_in"); };
    const closeQRModal         = () => { setIsQRModalOpen(false); setScannedCode(""); setScannedEmployee(null); setIsSaving(false); };
    const openQRDisplayModal   = (emp) => { setSelectedEmployeeForQR(emp); setQRLogType("check_in"); setIsQRDisplayModalOpen(true); };
    const closeQRDisplayModal  = () => { setIsQRDisplayModalOpen(false); setSelectedEmployeeForQR(null); setQRLogType("check_in"); };

    const handlePrintQR = async () => {
        if (!allEmployees.length) { alert("No employees to export!"); return; }
        setIsExporting(true);
        try { await exportEmployeeQRCodesToDocx(allEmployees, 6); }
        catch (e) { console.error(e); alert("Failed to export QR codes."); }
        finally { setIsExporting(false); }
    };

    const handleQRCodeScan = () => {
        if (!selectedEmployeeForQR) return;
        setIsSaving(true);
        router.post(route("scan-logs.store"), {
            employee_id:   selectedEmployeeForQR.EMPLOYID,
            employee_name: selectedEmployeeForQR.EMPNAME,
            department:    selectedEmployeeForQR.DEPARTMENT,
            job_title:     selectedEmployeeForQR.JOB_TITLE,
            prodline:      selectedEmployeeForQR.PRODLINE,
            station:       selectedEmployeeForQR.STATION,
            log_type:      qrLogType,
        }, {
            preserveScroll: true, preserveState: true,
            onSuccess: () => alert(`✓ Logged for ${selectedEmployeeForQR.EMPNAME}`),
            onError:   (e) => alert("Failed: " + JSON.stringify(e)),
            onFinish:  () => setIsSaving(false),
        });
    };

    // ── Status summary counts ─────────────────────────────────────────────────
    const statusCounts = React.useMemo(() => {
        const counts = { check_in: 0, check_out: 0, break_out: 0, break_in: 0, absent: 0, rest_day: 0, no_schedule: 0 };
        allEmployees.forEach(emp => {
            const s = getEmployeeStatus(emp, shiftCodeMap);
            counts[s] = (counts[s] ?? 0) + 1;
        });
        return counts;
    }, [allEmployees, shiftCodeMap]);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Scan Logs" />

            <div
                className="overflow-hidden flex p-4"
                style={{ height: `calc(100vh - ${NAVBAR_HEIGHT}px - ${PADDING_VERTICAL}px)` }}
            >
                <div className="flex-1 flex flex-col min-h-0 border border-base-300 rounded-lg bg-base-100 shadow-sm">

                    {/* ── Header ─────────────────────────────────────────────── */}
                    <div className="flex-shrink-0 px-6 py-4 border-b border-base-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
                                <ScanOutlined className="text-primary" />
                                Scan Management Logs
                            </h1>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    className="btn btn-outline btn-success btn-sm gap-2"
                                    onClick={handlePrintQR}
                                    disabled={isExporting || !allEmployees.length}
                                >
                                    {isExporting ? <><span className="loading loading-spinner loading-xs" /> Generating...</> : <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print QR ({allEmployees.length})
                                    </>}
                                </button>
                                <button className="btn btn-outline btn-primary btn-sm gap-2" onClick={openFPModal}>
                                    <FingerprintIcon style={{ width: 16, height: 16 }} />
                                    Scan Fingerprint
                                </button>
                                <button className="btn btn-primary btn-sm gap-2" onClick={openQRModal}>
                                    <QrcodeOutlined />
                                    Scan QR
                                </button>
                            </div>
                        </div>

                        {/* Status summary pills */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {[
                                { key: "check_in",    label: "Present"      },
                                { key: "check_out",   label: "Checked Out"  },
                                { key: "break_out",   label: "On Break"     },
                                { key: "break_in",    label: "Back fr. Break" },
                                { key: "absent",      label: "Absent"       },
                                { key: "rest_day",    label: "Rest Day"     },
                                { key: "no_schedule", label: "No Schedule"  },
                            ].map(({ key, label }) => {
                                const cfg = STATUS_CONFIG[key];
                                const count = statusCounts[key] ?? 0;
                                if (count === 0) return null;
                                return (
                                    <span key={key} style={{
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        padding: "3px 8px", borderRadius: 999,
                                        fontSize: 10, fontWeight: 600,
                                        background: cfg.badgeBg ?? "#f3f4f6",
                                        color: cfg.badgeColor ?? "#374151",
                                        border: `1px solid ${cfg.badgeBorder ?? "#d1d5db"}`,
                                    }}>
                                        <span style={{
                                            width: 6, height: 6, borderRadius: "50%",
                                            background: cfg.dotColor ?? "#9ca3af",
                                            flexShrink: 0,
                                        }} />
                                        {label}: {count}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Search bar */}
                        <div className="relative flex-1 w-full max-w-md">
                            <div className="flex items-center gap-2 border border-base-300 rounded-lg px-3 py-2 bg-base-100">
                                <SearchOutlined className="text-base-content opacity-50 text-sm" />
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent text-base-content text-sm focus:outline-none"
                                    placeholder="Search by name, ID, department..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} className="btn btn-ghost btn-xs px-1" type="button">Clear</button>
                                )}
                            </div>
                            {search && (
                                <div className="absolute top-full mt-1 text-xs text-base-content opacity-50">
                                    {filteredEmployees.length} result{filteredEmployees.length !== 1 ? "s" : ""} for "{search}"
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Cards Grid (no pagination — all items) ──────────────── */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
                        {filteredEmployees.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                                {filteredEmployees.map(emp => (
                                    <EmployeeCard
                                        key={emp.EMPID ?? emp.EMPLOYID}
                                        emp={emp}
                                        shiftCodeMap={shiftCodeMap}
                                        onOpenQR={() => openQRDisplayModal(emp)}
                                        onOpenFP={() => openFPModalForEmployee(emp)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-base-content opacity-30 gap-3">
                                <TeamOutlined style={{ fontSize: 48 }} />
                                <p className="text-sm font-medium">{search ? `No results for "${search}"` : "No employees found"}</p>
                                {search && (
                                    <button onClick={() => setSearch("")} className="btn btn-xs btn-ghost opacity-60">Clear search</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Count footer */}
                    {filteredEmployees.length > 0 && (
                        <div className="flex-shrink-0 border-t border-base-300 px-4 py-2 bg-base-100">
                            <p className="text-xs opacity-40 text-center">
                                {search
                                    ? `Showing ${filteredEmployees.length} of ${allEmployees.length} employees`
                                    : `${allEmployees.length} employees`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                QR Scanner Modal
            ══════════════════════════════════════════════════════════════════ */}
            {isQRModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                                <QrcodeOutlined className="text-primary" />
                                Scan QR Code
                            </h3>
                            <button className="btn btn-sm btn-circle btn-ghost" onClick={closeQRModal}><CloseOutlined /></button>
                        </div>
                        <LogTypeSelector value={logType} onChange={setLogType} />
                        <div className="flex gap-4 items-stretch">
                            <EmployeeInfoCard employee={scannedEmployee} />
                            <div className="flex-1 card bg-base-100 shadow-lg border border-base-300">
                                <div className="card-body p-6 flex flex-col items-center justify-center">
                                    <div className="relative">
                                        <div className="w-48 h-48 bg-base-200 rounded-lg flex items-center justify-center border-4 border-base-300 relative overflow-hidden">
                                            <QrcodeOutlined className="text-7xl opacity-30" />
                                            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent"
                                                style={{ animation: "scan 2s ease-in-out infinite", boxShadow: "0 0 10px rgba(34,197,94,0.8)" }} />
                                        </div>
                                        <ScanCorners />
                                    </div>
                                    <ScanStatus isSaving={isSaving} employee={scannedEmployee} code={scannedCode}
                                        successText={scannedEmployee ? `Employee found: ${scannedEmployee.EMPNAME}` : ""}
                                        idleText="Please scan the QR of the employee" />
                                </div>
                            </div>
                        </div>
                        <ScanAnimation />
                    </div>
                    <div className="modal-backdrop" onClick={closeQRModal} />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                QR Display Modal
            ══════════════════════════════════════════════════════════════════ */}
            {isQRDisplayModalOpen && selectedEmployeeForQR && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                                <QrcodeOutlined className="text-primary" />
                                Employee QR Code
                            </h3>
                            <button className="btn btn-sm btn-circle btn-ghost" onClick={closeQRDisplayModal}><CloseOutlined /></button>
                        </div>
                        <div className="card bg-base-200 mb-6">
                            <div className="card-body p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                                        <UserOutlined className="text-2xl text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-base-content">{selectedEmployeeForQR.EMPNAME}</h2>
                                        <p className="text-xs opacity-50 font-mono">ID: {selectedEmployeeForQR.EMPLOYID}</p>
                                        <p className="text-xs opacity-50">{selectedEmployeeForQR.JOB_TITLE} · {selectedEmployeeForQR.DEPARTMENT}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <LogTypeSelector value={qrLogType} onChange={setQRLogType} />
                        <div className="flex flex-col items-center py-6 gap-6">
                            <div className="relative">
                                <div className="w-56 h-56 bg-base-100 rounded-2xl p-4 flex items-center justify-center border-4 border-base-300 shadow-xl">
                                    <QRCodeSVG value={selectedEmployeeForQR.EMPLOYID} size={200} level="H" includeMargin bgColor="transparent" fgColor="currentColor" className="text-base-content" />
                                </div>
                                <div className="absolute -top-2 -left-2 w-10 h-10 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                                <div className="absolute -top-2 -right-2 w-10 h-10 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                                <div className="absolute -bottom-2 -left-2 w-10 h-10 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 border-r-4 border-b-4 border-primary rounded-br-lg" />
                            </div>
                            <button className="btn btn-primary btn-wide" onClick={handleQRCodeScan} disabled={isSaving}>
                                {isSaving ? <><span className="loading loading-spinner loading-sm" /> Saving...</> : <><IdcardOutlined /> Log Manually</>}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={closeQRDisplayModal} />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                Fingerprint Modal  — auto-scan, auto-save, auto-reset
            ══════════════════════════════════════════════════════════════════ */}
            {isFPModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                                <FingerprintIcon className="text-primary" style={{ width: 24, height: 24 }} />
                                {fpPreselected ? "Verify & Log Fingerprint" : "Scan Fingerprint"}
                            </h3>
                            <button className="btn btn-sm btn-circle btn-ghost" onClick={closeFPModal}><CloseOutlined /></button>
                        </div>

                        <LogTypeSelector value={fpLogType} onChange={(v) => {
                            setFpLogType(v);
                            // If already scanning, don't interrupt; type is read from ref at save time
                        }} />

                        <div className="flex gap-4 items-stretch">
                            {/* Left — identified / preselected employee card */}
                            <div className="flex-1 min-h-0">
                                <div className="card bg-base-100 shadow-lg border border-base-300 h-full">
                                    <div className="card-body p-6">
                                        {(fpEmployee || fpPreselected) ? (() => {
                                            const displayEmp = fpEmployee ?? fpPreselected;
                                            const isPreview  = !fpEmployee && !!fpPreselected;
                                            return (
                                                <>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-12 h-12 rounded-full border flex items-center justify-center
                                                                ${isPreview ? "bg-base-200 border-base-300" : "bg-primary/20 border-primary"}`}>
                                                                <UserOutlined className={`text-xl ${isPreview ? "opacity-40" : "text-primary"}`} />
                                                            </div>
                                                            <div>
                                                                <h2 className={`text-base font-bold ${isPreview ? "text-base-content opacity-50" : "text-base-content"}`}>
                                                                    {displayEmp.EMPNAME}
                                                                </h2>
                                                                <p className="text-xs opacity-50 font-mono">{displayEmp.EMPLOYID}</p>
                                                            </div>
                                                        </div>
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPreview ? "bg-base-200" : "bg-primary/10"}`}>
                                                            <IdcardOutlined className={isPreview ? "opacity-30" : "text-primary"} />
                                                        </div>
                                                    </div>
                                                    <div className="bg-base-200 rounded-lg px-3 py-2 mb-4">
                                                        <p className={`text-sm font-medium text-center ${isPreview ? "opacity-40" : "text-base-content"}`}>
                                                            {displayEmp.JOB_TITLE}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between py-2 border-b border-base-300">
                                                            <span className="text-xs opacity-70 font-medium">DEPT</span>
                                                            <span className={`text-sm font-medium text-right ${isPreview ? "opacity-40" : "text-base-content"}`}>
                                                                {displayEmp.DEPARTMENT}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-2 border-b border-base-300">
                                                            <span className="text-xs opacity-70 font-medium">LINE</span>
                                                            <span className={`text-sm font-medium text-right ${isPreview ? "opacity-40" : "text-base-content"}`}>
                                                                {displayEmp.PRODLINE || <span className="opacity-50">N/A</span>}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isPreview && (
                                                        <p className="text-[10px] text-base-content opacity-30 text-center mt-3">
                                                            Place finger on device to confirm
                                                        </p>
                                                    )}
                                                </>
                                            );
                                        })() : (
                                            /* Skeleton */
                                            <>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-base-300 border border-base-300 flex items-center justify-center">
                                                            <UserOutlined className="text-xl opacity-30" />
                                                        </div>
                                                        <div>
                                                            <div className="h-4 w-32 bg-base-300 rounded mb-2" />
                                                            <div className="h-3 w-20 bg-base-300 rounded" />
                                                        </div>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center">
                                                        <IdcardOutlined className="opacity-30" />
                                                    </div>
                                                </div>
                                                <div className="bg-base-200 rounded-lg px-3 py-2 mb-4">
                                                    <div className="h-4 w-24 bg-base-300 rounded mx-auto" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between py-2 border-b border-base-300">
                                                        <span className="text-xs opacity-50 font-medium">DEPT</span>
                                                        <div className="h-3 w-28 bg-base-300 rounded" />
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-base-300">
                                                        <span className="text-xs opacity-50 font-medium">LINE</span>
                                                        <div className="h-3 w-24 bg-base-300 rounded" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right — fingerprint scanner (mirrors QR scanner layout) */}
                            <div className="flex-1 card bg-base-100 shadow-lg border border-base-300">
                                <div className="card-body p-6 flex flex-col items-center justify-center">
                                    <div className="relative">
                                        <div className="w-48 h-48 bg-base-200 rounded-lg flex items-center justify-center border-4 border-base-300 relative overflow-hidden">
                                            {/* Scanning state — animated sweep */}
                                            {fpState === "scanning" && (
                                                <>
                                                    <FingerprintIcon className="text-primary opacity-20" style={{ width: 72, height: 72 }} />
                                                    <div
                                                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                                                        style={{ animation: "scan 2s ease-in-out infinite", boxShadow: "0 0 10px rgba(59,130,246,0.8)" }}
                                                    />
                                                </>
                                            )}
                                            {/* Saving state */}
                                            {fpState === "saving" && (
                                                <>
                                                    <FingerprintIcon className="text-success opacity-30" style={{ width: 72, height: 72 }} />
                                                    <div
                                                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent"
                                                        style={{ animation: "scan 1s ease-in-out infinite", boxShadow: "0 0 10px rgba(16,185,129,0.8)" }}
                                                    />
                                                </>
                                            )}
                                            {/* Saved */}
                                            {fpState === "saved" && (
                                                <CheckCircleFilled style={{ fontSize: 56, color: "#10b981" }} />
                                            )}
                                            {/* Errors */}
                                            {(fpState === "error" || fpState === "notfound" || fpState === "mismatch") && (
                                                <CloseCircleFilled style={{ fontSize: 56, color: "#ef4444" }} />
                                            )}
                                            {/* Idle */}
                                            {fpState === "idle" && (
                                                <FingerprintIcon className="text-base-content opacity-20" style={{ width: 72, height: 72 }} />
                                            )}
                                        </div>
                                        <ScanCorners />
                                    </div>

                                    {/* Status text — mirrors QR ScanStatus pattern */}
                                    <div className="mt-6 text-center">
                                        {fpState === "idle" && (
                                            <><p className="font-medium opacity-50">Initialising…</p><p className="text-sm opacity-40 mt-1">Please wait</p></>
                                        )}
                                        {fpState === "scanning" && (
                                            <><p className="font-medium">Scanning…</p><p className="text-sm opacity-60">{fpPreselected ? `Verifying ${fpPreselected.EMPNAME}` : "Place finger on device"}</p></>
                                        )}
                                        {fpState === "saving" && (
                                            <><p className="text-info font-medium text-lg">💾 Saving…</p><p className="text-sm opacity-60">Recording scan log</p></>
                                        )}
                                        {fpState === "saved" && (
                                            <><p className="text-success font-medium text-lg">✓ Scan Successful!</p><p className="text-sm opacity-60">Logged for {fpEmployee?.EMPNAME}</p></>
                                        )}
                                        {fpState === "notfound" && (
                                            <><p className="text-error font-medium">Employee Not Found</p><p className="text-sm opacity-60">No fingerprint match</p></>
                                        )}
                                        {fpState === "mismatch" && (
                                            <><p className="text-error font-medium">Wrong Person</p><p className="text-sm text-error opacity-70 mt-1 leading-snug">{fpError}</p></>
                                        )}
                                        {fpState === "error" && (
                                            <><p className="text-error font-medium">Scan Failed</p><p className="text-sm text-error opacity-70 mt-1 leading-snug">{fpError}</p></>
                                        )}
                                    </div>

                                    {/* Manual retry only on failure states */}
                                    {(fpState === "error" || fpState === "notfound" || fpState === "mismatch") && (
                                        <button
                                            onClick={handleFPScan}
                                            className="btn btn-primary btn-sm gap-1 mt-4"
                                        >
                                            <FingerprintIcon style={{ width: 14, height: 14 }} />
                                            Retry Scan
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ScanAnimation />
                    </div>
                    <div className="modal-backdrop" onClick={closeFPModal} />
                </div>
            )}
        </AuthenticatedLayout>
    );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function LogTypeSelector({ value, onChange }) {
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-base-content mb-3">
                Select Log Type: <span className="font-bold text-primary">{value}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
                {logTypeOptions.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`btn btn-sm justify-start ${value === opt.value ? "btn-primary" : "btn-outline"}`}
                    >
                        <span className={value === opt.value ? "text-white" : opt.color}>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function EmployeeInfoCard({ employee }) {
    return (
        <div className="flex-1 min-h-0">
            <div className="card bg-base-100 shadow-lg border border-base-300 h-full">
                <div className="card-body p-6">
                    {employee ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                                        <UserOutlined className="text-xl text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-base-content">{employee.EMPNAME}</h2>
                                        <p className="text-xs opacity-50 font-mono">{employee.EMPLOYID}</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <IdcardOutlined className="text-primary" />
                                </div>
                            </div>
                            <div className="bg-base-200 rounded-lg px-3 py-2 mb-4">
                                <p className="text-sm font-medium text-center text-base-content">{employee.JOB_TITLE}</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between py-2 border-b border-base-300">
                                    <span className="text-xs opacity-70 font-medium">DEPT</span>
                                    <span className="text-sm font-medium text-base-content text-right">{employee.DEPARTMENT}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-base-300">
                                    <span className="text-xs opacity-70 font-medium">LINE</span>
                                    <span className="text-sm font-medium text-base-content text-right">{employee.PRODLINE || <span className="opacity-50">N/A</span>}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-base-300 border border-base-300 flex items-center justify-center">
                                        <UserOutlined className="text-xl opacity-30" />
                                    </div>
                                    <div>
                                        <div className="h-4 w-32 bg-base-300 rounded mb-2" />
                                        <div className="h-3 w-20 bg-base-300 rounded" />
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center">
                                    <IdcardOutlined className="opacity-30" />
                                </div>
                            </div>
                            <div className="bg-base-200 rounded-lg px-3 py-2 mb-4">
                                <div className="h-4 w-24 bg-base-300 rounded mx-auto" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between py-2 border-b border-base-300">
                                    <span className="text-xs opacity-50 font-medium">DEPT</span>
                                    <div className="h-3 w-28 bg-base-300 rounded" />
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-base-300">
                                    <span className="text-xs opacity-50 font-medium">LINE</span>
                                    <div className="h-3 w-24 bg-base-300 rounded" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ScanCorners() {
    return (
        <>
            <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
        </>
    );
}

function ScanStatus({ isSaving, employee, code, successText, idleText }) {
    return (
        <div className="mt-6 text-center">
            {isSaving ? (
                <><p className="text-info font-medium text-lg">💾 Saving…</p><p className="text-sm opacity-60">Recording scan log</p></>
            ) : employee ? (
                <><p className="text-success font-medium text-lg">✓ Scan Successful!</p><p className="text-sm opacity-60">{successText}</p></>
            ) : code ? (
                <><p className="text-error font-medium">Employee Not Found</p><p className="text-sm opacity-60">Code: {code}</p></>
            ) : (
                <><p className="font-medium">Scanning…</p><p className="text-sm opacity-60">{idleText}</p></>
            )}
        </div>
    );
}

function ScanAnimation() {
    return (
        <style>{`
            @keyframes scan {
                0%   { top: 0;    opacity: 0; }
                50%  { opacity: 1; }
                100% { top: 100%; opacity: 0; }
            }
        `}</style>
    );
}