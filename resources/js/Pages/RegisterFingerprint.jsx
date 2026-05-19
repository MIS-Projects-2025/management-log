import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import axios from "axios";
import { Head, usePage, router } from "@inertiajs/react";
import {
    SearchOutlined,
    DeleteOutlined,
    ReloadOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    LoadingOutlined,
    CloseOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useState, useMemo, useCallback } from "react";
import { captureFingerprint } from "@/utils/secugenClient";

// ─── Finger map ───────────────────────────────────────────────────────────────
const FINGERS = [
    { index: 0, label: "Right Thumb", hand: "right", pos: 0 },
    { index: 1, label: "Right Index", hand: "right", pos: 1 },
    { index: 2, label: "Right Middle", hand: "right", pos: 2 },
    { index: 3, label: "Right Ring", hand: "right", pos: 3 },
    { index: 4, label: "Right Little", hand: "right", pos: 4 },
    { index: 5, label: "Left Thumb", hand: "left", pos: 0 },
    { index: 6, label: "Left Index", hand: "left", pos: 1 },
    { index: 7, label: "Left Middle", hand: "left", pos: 2 },
    { index: 8, label: "Left Ring", hand: "left", pos: 3 },
    { index: 9, label: "Left Little", hand: "left", pos: 4 },
];

const QUALITY_COLOR = (q) => {
    if (q >= 70) return "#10b981";
    if (q >= 40) return "#f59e0b";
    return "#ef4444";
};

const QUALITY_LABEL = (q) => {
    if (q >= 70) return "Good";
    if (q >= 40) return "Fair";
    return "Poor";
};

// ─── Hand SVG ─────────────────────────────────────────────────────────────────
function HandDiagram({
    hand,
    registeredIndexes,
    selectedIndex,
    onSelect,
    isDark,
}) {
    const coords =
        hand === "right"
            ? [
                  { fi: 0, cx: 72, cy: 120 },
                  { fi: 1, cx: 108, cy: 68 },
                  { fi: 2, cx: 132, cy: 55 },
                  { fi: 3, cx: 155, cy: 62 },
                  { fi: 4, cx: 175, cy: 80 },
              ]
            : [
                  { fi: 5, cx: 128, cy: 120 },
                  { fi: 6, cx: 92, cy: 68 },
                  { fi: 7, cx: 68, cy: 55 },
                  { fi: 8, cx: 45, cy: 62 },
                  { fi: 9, cx: 25, cy: 80 },
              ];

    const palmColor = isDark ? "#1f2937" : "#f9fafb";
    const palmStroke = isDark ? "#374151" : "#d1d5db";

    return (
        <svg
            viewBox="0 0 200 180"
            className="w-full max-w-[200px]"
            style={{ userSelect: "none" }}
        >
            <ellipse
                cx="100"
                cy="148"
                rx="55"
                ry="30"
                fill={palmColor}
                stroke={palmStroke}
                strokeWidth="1.5"
            />
            {coords.map(({ fi, cx, cy }) => {
                const isRegistered = registeredIndexes.has(fi);
                const isSelected = selectedIndex === fi;
                const fill = isSelected
                    ? "#3b82f6"
                    : isRegistered
                      ? "#10b981"
                      : isDark
                        ? "#374151"
                        : "#e5e7eb";
                const stroke = isSelected
                    ? "#1d4ed8"
                    : isRegistered
                      ? "#059669"
                      : isDark
                        ? "#4b5563"
                        : "#d1d5db";
                return (
                    <g
                        key={fi}
                        onClick={() => onSelect(fi)}
                        style={{ cursor: "pointer" }}
                    >
                        <ellipse
                            cx={cx}
                            cy={cy}
                            rx={13}
                            ry={16}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            opacity={0.95}
                        />
                        {isRegistered && !isSelected && (
                            <circle
                                cx={cx + 7}
                                cy={cy - 9}
                                r={5}
                                fill="#10b981"
                                stroke="white"
                                strokeWidth={1}
                            />
                        )}
                        {isSelected && (
                            <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="white"
                                opacity={0.5}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// ─── Quality Arc ──────────────────────────────────────────────────────────────
function QualityArc({ quality }) {
    const r = 36,
        cx = 50,
        cy = 50;
    const strokeW = 8;
    const circumference = Math.PI * r;
    const dash = (quality / 100) * circumference;
    const color = QUALITY_COLOR(quality);

    return (
        <svg viewBox="0 0 100 60" className="w-24">
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeW}
                strokeLinecap="round"
            />
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
            <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill={color}
            >
                {quality}
            </text>
            <text
                x={cx}
                y={cy + 8}
                textAnchor="middle"
                fontSize="8"
                fill="#6b7280"
            >
                {QUALITY_LABEL(quality)}
            </text>
        </svg>
    );
}

// ─── Fingerprint Icon SVG ─────────────────────────────────────────────────────
function FingerprintIcon({ className = "", style = {} }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M8.5 12c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 2.9-1.4 5.47-3.5 6.5" />
            <path d="M5.5 12c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5c0 4.36-2.1 8.22-5.5 10" />
            <path d="M11 12c0-.55.45-1 1-1s1 .45 1 1c0 1.45-.7 2.74-1.5 3.5" />
        </svg>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RegisterFingerprint({ tableData }) {
    const { auth } = usePage().props;

    const isDark =
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme") === "dark";

    const [search, setSearch] = useState("");
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFinger, setSelectedFinger] = useState(1);

    const [empFingerprints, setEmpFingerprints] = useState(() => {
        const map = {};
        (tableData?.employees ?? []).forEach((e) => {
            map[String(e.employee_id)] = e.fingerprints ?? [];
        });
        return map;
    });

    const [captureState, setCaptureState] = useState("idle");
    const [capturedData, setCapturedData] = useState(null);
    const [captureError, setCaptureError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);

    const employees = tableData?.employees ?? [];

    const filteredEmployees = useMemo(
        () =>
            employees
                .filter((e) =>
                    e.name.toLowerCase().includes(search.toLowerCase()),
                )
                .sort((a, b) => a.name.localeCompare(b.name)),
        [search, employees],
    );

    const openModal = (emp) => {
        setSelectedEmp(emp);
        setIsModalOpen(true);
        setCapturedData(null);
        setCaptureState("idle");
        setCaptureError(null);
        setSaveMsg(null);
        setSelectedFinger(1);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCapturedData(null);
        setCaptureState("idle");
        setCaptureError(null);
        setSaveMsg(null);
    };

    const currentFingerprints = useMemo(() => {
        if (!selectedEmp) return [];
        return empFingerprints[String(selectedEmp.employee_id)] ?? [];
    }, [selectedEmp, empFingerprints]);

    const registeredIndexes = useMemo(
        () => new Set(currentFingerprints.map((f) => f.finger_index)),
        [currentFingerprints],
    );

    const selectedFingerData = useMemo(
        () =>
            currentFingerprints.find(
                (f) => f.finger_index === selectedFinger,
            ) ?? null,
        [currentFingerprints, selectedFinger],
    );

    // ── Capture ───────────────────────────────────────────────────────────────
    // const handleCapture = useCallback(async () => {
    //     setCaptureState("capturing");
    //     setCapturedData(null);
    //     setCaptureError(null);
    //     setSaveMsg(null);
    //     try {
    //         const res = await axios.post(route("register-fingerprint.capture"));
    //         if (!res.data.success)
    //             throw new Error(res.data.message ?? "Capture failed");
    //         setCapturedData(res.data.data);
    //         setCaptureState("success");
    //     } catch (e) {
    //         setCaptureError(
    //             e.response?.data?.message ?? e.message ?? "Capture failed",
    //         );
    //         setCaptureState("error");
    //     }
    // }, []);

    const handleCapture = useCallback(async () => {
        setCaptureState("capturing");
        setCapturedData(null);
        setCaptureError(null);
        setSaveMsg(null);
        try {
            // captureFingerprint() talks to the SecuGen service on *this* PC,
            // not on the server — so it works in Docker / Ubuntu production.
            const data = await captureFingerprint();
            setCapturedData(data);
            setCaptureState("success");
        } catch (e) {
            setCaptureError(e.message ?? "Capture failed");
            setCaptureState("error");
        }
    }, []);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!capturedData || !selectedEmp) return;
        setSaving(true);
        setSaveMsg(null);
        try {
            const res = await axios.post(route("register-fingerprint.store"), {
                employid: String(selectedEmp.employee_id),
                template: capturedData.template,
                quality: capturedData.quality,
                finger_index: selectedFinger,
            });
            if (!res.data.success)
                throw new Error(res.data.message ?? "Save failed");

            setEmpFingerprints((prev) => {
                const empId = String(selectedEmp.employee_id);
                const existing = (prev[empId] ?? []).filter(
                    (f) => f.finger_index !== selectedFinger,
                );
                return {
                    ...prev,
                    [empId]: [
                        ...existing,
                        {
                            finger_index: selectedFinger,
                            quality: capturedData.quality,
                            is_active: true,
                            registered_at: new Date()
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " "),
                        },
                    ],
                };
            });

            setSaveMsg({
                type: "success",
                text: "Fingerprint saved successfully.",
            });
            setCapturedData(null);
            setCaptureState("idle");
        } catch (e) {
            setSaveMsg({
                type: "error",
                text: e.response?.data?.message ?? e.message,
            });
        } finally {
            setSaving(false);
        }
    }, [capturedData, selectedEmp, selectedFinger]);

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = useCallback(
        async (fingerIndex) => {
            if (!selectedEmp) return;
            try {
                const res = await axios.delete(
                    route("register-fingerprint.destroy"),
                    {
                        data: {
                            employid: String(selectedEmp.employee_id),
                            finger_index: fingerIndex,
                        },
                    },
                );
                if (!res.data.success) throw new Error(res.data.message);

                setEmpFingerprints((prev) => {
                    const empId = String(selectedEmp.employee_id);
                    return {
                        ...prev,
                        [empId]: (prev[empId] ?? []).filter(
                            (f) => f.finger_index !== fingerIndex,
                        ),
                    };
                });
                if (selectedFinger === fingerIndex) setCapturedData(null);
                setSaveMsg({ type: "success", text: "Fingerprint removed." });
            } catch (e) {
                setSaveMsg({
                    type: "error",
                    text: e.response?.data?.message ?? e.message,
                });
            }
        },
        [selectedEmp, selectedFinger],
    );

    const fingerLabel =
        FINGERS.find((f) => f.index === selectedFinger)?.label ?? "";

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Register Fingerprint" />

            <div className="p-4 min-h-screen">
                <div className="border border-base-300 rounded-lg bg-base-100 shadow-sm">
                    {/* ── Header ─────────────────────────────────────────────── */}
                    <div className="px-6 py-5 border-b border-base-300">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
                                <FingerprintIcon className="h-7 w-7 text-yellow-500" />
                                Register Fingerprint
                            </h1>
                            <span className="badge badge-outline text-base-content opacity-50 badge-sm">
                                SecuGen HU20-A
                            </span>
                        </div>
                    </div>

                    {/* ── Search bar ─────────────────────────────────────────── */}
                    <div className="px-6 py-4 border-b border-base-300 bg-base-200">
                        <div className="flex items-center gap-2 max-w-sm">
                            <div className="flex items-center gap-2 flex-1 border border-base-300 rounded-lg bg-base-100 px-3 py-2">
                                <SearchOutlined className="text-base-content opacity-50 text-sm" />
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent text-base-content text-sm focus:outline-none"
                                    placeholder="Search employees..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="btn btn-ghost btn-xs px-1"
                                        type="button"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-base-content opacity-40 whitespace-nowrap">
                                {filteredEmployees.length} of {employees.length}
                            </span>
                        </div>
                    </div>

                    {/* ── Employee Cards Grid ─────────────────────────────────── */}
                    <div className="p-6">
                        {filteredEmployees.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-base-content opacity-30 gap-3">
                                <FingerprintIcon
                                    style={{ width: 56, height: 56 }}
                                />
                                <p className="text-sm font-medium">
                                    No employees found
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {filteredEmployees.map((emp) => {
                                    const empFps =
                                        empFingerprints[
                                            String(emp.employee_id)
                                        ] ?? [];
                                    const fpCount = empFps.length;
                                    const initials = emp.name
                                        .split(" ")
                                        .slice(0, 2)
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase();

                                    return (
                                        <div
                                            key={emp.id}
                                            onClick={() => openModal(emp)}
                                            className="card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md hover:border-primary transition-all duration-200 hover:-translate-y-0.5"
                                        >
                                            <div className="card-body p-4 items-center text-center gap-2">
                                                {/* Avatar */}
                                                <div
                                                    style={{
                                                        position: "relative",
                                                        width: 52,
                                                        height: 52,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                                        <span className="text-sm font-bold text-primary">
                                                            {initials}
                                                        </span>
                                                    </div>
                                                    {fpCount > 0 && (
                                                        <span
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                top: -3,
                                                                right: -3,
                                                                minWidth: 20,
                                                                height: 20,
                                                                borderRadius: 999,
                                                                background:
                                                                    "#10b981",
                                                                color: "#fff",
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                padding:
                                                                    "0 6px",
                                                                border: "2px solid var(--fallback-b1, oklch(var(--b1)))",
                                                                zIndex: 10,
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            {fpCount}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Name */}
                                                <div className="w-full">
                                                    <p className="text-xs font-semibold text-base-content truncate leading-tight">
                                                        {emp.name}
                                                    </p>
                                                    {emp.job && (
                                                        <p className="text-[10px] text-base-content opacity-40 truncate mt-0.5">
                                                            {emp.job}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] font-mono text-base-content opacity-30 mt-0.5">
                                                        {emp.employee_id}
                                                    </p>
                                                </div>

                                                {/* Fingerprint status */}
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        padding: "2px 8px",
                                                        borderRadius: 999,
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        background:
                                                            fpCount > 0
                                                                ? "#d1fae5"
                                                                : "#f3f4f6",
                                                        color:
                                                            fpCount > 0
                                                                ? "#065f46"
                                                                : "#6b7280",
                                                        border: `1px solid ${fpCount > 0 ? "#6ee7b7" : "#e5e7eb"}`,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {fpCount > 0
                                                        ? `${fpCount}/10 fingers`
                                                        : "No fingerprints"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fingerprint Modal ─────────────────────────────────────────── */}
            {isModalOpen && selectedEmp && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-3xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                                <FingerprintIcon className="h-6 w-6 text-primary" />
                                Register Fingerprint
                            </h3>
                            <button
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={closeModal}
                            >
                                <CloseOutlined />
                            </button>
                        </div>

                        {/* Save message */}
                        {saveMsg && (
                            <div
                                className={`alert alert-sm py-2 mb-4 ${saveMsg.type === "success" ? "alert-success" : "alert-error"}`}
                            >
                                {saveMsg.type === "success" ? (
                                    <CheckCircleFilled />
                                ) : (
                                    <CloseCircleFilled />
                                )}
                                <span className="text-sm">{saveMsg.text}</span>
                                <button
                                    className="btn btn-ghost btn-xs ml-auto"
                                    onClick={() => setSaveMsg(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Two containers in a row */}
                        <div className="flex gap-4 items-stretch">
                            {/* Container 1 — Employee Info + Finger Select */}
                            <div className="flex-1 min-h-0">
                                <div className="card bg-base-100 shadow-lg border border-base-300 h-full">
                                    <div className="card-body p-5 gap-4">
                                        {/* Employee header */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                                <UserOutlined className="text-xl text-primary" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-bold text-base-content">
                                                    {selectedEmp.name}
                                                </h2>
                                                <p className="text-xs opacity-50 font-mono">
                                                    {selectedEmp.employee_id}
                                                </p>
                                            </div>
                                        </div>

                                        {selectedEmp.job && (
                                            <div className="bg-base-200 rounded-lg px-3 py-2">
                                                <p className="text-sm font-medium text-center text-base-content">
                                                    {selectedEmp.job}
                                                </p>
                                            </div>
                                        )}

                                        {/* Stats */}
                                        <div className="flex items-center justify-between py-2 border-b border-base-300">
                                            <span className="text-xs opacity-70 font-medium">
                                                Registered
                                            </span>
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    background:
                                                        currentFingerprints.length >
                                                        0
                                                            ? "#d1fae5"
                                                            : "#f3f4f6",
                                                    color:
                                                        currentFingerprints.length >
                                                        0
                                                            ? "#065f46"
                                                            : "#6b7280",
                                                    border: `1px solid ${currentFingerprints.length > 0 ? "#6ee7b7" : "#e5e7eb"}`,
                                                }}
                                            >
                                                {currentFingerprints.length} /
                                                10
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between py-1 border-b border-base-300">
                                            <span className="text-xs opacity-70 font-medium">
                                                Selected Finger
                                            </span>
                                            <span className="text-sm font-semibold text-base-content">
                                                {fingerLabel}
                                            </span>
                                        </div>

                                        {selectedFingerData && (
                                            <div className="flex items-center justify-between py-1 border-b border-base-300">
                                                <span className="text-xs opacity-70 font-medium">
                                                    Status
                                                </span>
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        padding: "2px 8px",
                                                        borderRadius: 999,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        background:
                                                            selectedFingerData.is_active
                                                                ? "#d1fae5"
                                                                : "#f3f4f6",
                                                        color: selectedFingerData.is_active
                                                            ? "#065f46"
                                                            : "#6b7280",
                                                        border: `1px solid ${selectedFingerData.is_active ? "#6ee7b7" : "#e5e7eb"}`,
                                                    }}
                                                >
                                                    {selectedFingerData.is_active
                                                        ? "Active"
                                                        : "Inactive"}
                                                </span>
                                            </div>
                                        )}

                                        {/* Hand diagrams */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-[10px] text-base-content opacity-40 text-center mb-1">
                                                    Right Hand
                                                </p>
                                                <HandDiagram
                                                    hand="right"
                                                    registeredIndexes={
                                                        registeredIndexes
                                                    }
                                                    selectedIndex={
                                                        selectedFinger
                                                    }
                                                    onSelect={setSelectedFinger}
                                                    isDark={isDark}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-base-content opacity-40 text-center mb-1">
                                                    Left Hand
                                                </p>
                                                <HandDiagram
                                                    hand="left"
                                                    registeredIndexes={
                                                        registeredIndexes
                                                    }
                                                    selectedIndex={
                                                        selectedFinger
                                                    }
                                                    onSelect={setSelectedFinger}
                                                    isDark={isDark}
                                                />
                                            </div>
                                        </div>

                                        {/* Registered fingers list */}
                                        {currentFingerprints.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-base-content opacity-40 font-medium mb-1">
                                                    Registered fingers:
                                                </p>
                                                <ul className="space-y-1">
                                                    {currentFingerprints
                                                        .sort(
                                                            (a, b) =>
                                                                a.finger_index -
                                                                b.finger_index,
                                                        )
                                                        .map((fp) => (
                                                            <li
                                                                key={
                                                                    fp.finger_index
                                                                }
                                                                className="flex items-center justify-between gap-1"
                                                            >
                                                                <button
                                                                    onClick={() =>
                                                                        setSelectedFinger(
                                                                            fp.finger_index,
                                                                        )
                                                                    }
                                                                    className={`flex-1 text-left rounded px-1 py-0.5 text-xs transition-colors
                                                                        ${selectedFinger === fp.finger_index ? "bg-primary/10 text-primary" : "hover:bg-base-200 text-base-content"}`}
                                                                >
                                                                    {
                                                                        FINGERS[
                                                                            fp
                                                                                .finger_index
                                                                        ]?.label
                                                                    }
                                                                </button>
                                                                <span
                                                                    className="font-mono text-[10px] shrink-0"
                                                                    style={{
                                                                        color: QUALITY_COLOR(
                                                                            fp.quality,
                                                                        ),
                                                                    }}
                                                                >
                                                                    Q:
                                                                    {fp.quality}
                                                                </span>
                                                                <button
                                                                    onClick={() =>
                                                                        handleDelete(
                                                                            fp.finger_index,
                                                                        )
                                                                    }
                                                                    className="btn btn-ghost btn-xs text-error px-1 shrink-0"
                                                                    title="Remove"
                                                                >
                                                                    <DeleteOutlined className="text-xs" />
                                                                </button>
                                                            </li>
                                                        ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Container 2 — Fingerprint Scanner */}
                            <div className="flex-1 min-h-0 card bg-base-100 shadow-lg border border-base-300">
                                <div className="card-body p-5 flex flex-col items-center justify-between gap-4">
                                    {/* Scanner area */}
                                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                                        <div className="relative">
                                            {/* Scanner frame */}
                                            <div className="w-44 h-44 bg-base-200 rounded-xl flex flex-col items-center justify-center border-4 border-base-300 relative overflow-hidden gap-3">
                                                {captureState ===
                                                    "capturing" && (
                                                    <>
                                                        <FingerprintIcon
                                                            className="text-primary opacity-30"
                                                            style={{
                                                                width: 64,
                                                                height: 64,
                                                            }}
                                                        />
                                                        {/* Scanning line */}
                                                        <div
                                                            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                                                            style={{
                                                                animation:
                                                                    "scan 2s ease-in-out infinite",
                                                                boxShadow:
                                                                    "0 0 8px rgba(59, 130, 246, 0.8)",
                                                            }}
                                                        />
                                                    </>
                                                )}

                                                {captureState === "success" &&
                                                    capturedData?.image && (
                                                        <img
                                                            src={`data:image/bmp;base64,${capturedData.image}`}
                                                            alt="Fingerprint scan"
                                                            className="rounded w-28 h-28 object-contain"
                                                            style={{
                                                                imageRendering:
                                                                    "pixelated",
                                                            }}
                                                        />
                                                    )}

                                                {captureState === "success" &&
                                                    !capturedData?.image && (
                                                        <CheckCircleFilled
                                                            className="text-success"
                                                            style={{
                                                                fontSize: 48,
                                                            }}
                                                        />
                                                    )}

                                                {captureState === "error" && (
                                                    <CloseCircleFilled
                                                        className="text-error"
                                                        style={{ fontSize: 48 }}
                                                    />
                                                )}

                                                {captureState === "idle" && (
                                                    <FingerprintIcon
                                                        className="text-base-content opacity-20"
                                                        style={{
                                                            width: 64,
                                                            height: 64,
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {/* Corner brackets */}
                                            <div className="absolute top-0 left-0 w-7 h-7 border-l-4 border-t-4 border-primary rounded-tl-lg"></div>
                                            <div className="absolute top-0 right-0 w-7 h-7 border-r-4 border-t-4 border-primary rounded-tr-lg"></div>
                                            <div className="absolute bottom-0 left-0 w-7 h-7 border-l-4 border-b-4 border-primary rounded-bl-lg"></div>
                                            <div className="absolute bottom-0 right-0 w-7 h-7 border-r-4 border-b-4 border-primary rounded-br-lg"></div>
                                        </div>

                                        {/* Quality arc — shown after success */}
                                        {captureState === "success" &&
                                            capturedData && (
                                                <QualityArc
                                                    quality={
                                                        capturedData.quality
                                                    }
                                                />
                                            )}

                                        {/* Status text */}
                                        <div className="mt-3 text-center">
                                            {saving ? (
                                                <>
                                                    <p className="text-info font-medium text-base">
                                                        💾 Saving...
                                                    </p>
                                                    <p className="text-xs opacity-60 mt-1">
                                                        Recording fingerprint
                                                        data
                                                    </p>
                                                </>
                                            ) : captureState === "success" ? (
                                                <>
                                                    <p className="text-success font-medium text-base">
                                                        ✓ Scan Successful!
                                                    </p>
                                                    <p className="text-xs opacity-60 mt-1">
                                                        Quality:{" "}
                                                        {capturedData?.quality}
                                                    </p>
                                                </>
                                            ) : captureState === "error" ? (
                                                <>
                                                    <p className="text-error font-medium text-base">
                                                        Capture Failed
                                                    </p>
                                                    <p className="text-xs opacity-60 mt-1 text-center px-2">
                                                        {captureError}
                                                    </p>
                                                </>
                                            ) : captureState === "capturing" ? (
                                                <>
                                                    <p className="font-medium text-base">
                                                        Scanning...
                                                    </p>
                                                    <p className="text-xs opacity-60 mt-1">
                                                        Place finger on scanner
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-medium text-base opacity-50">
                                                        Ready
                                                    </p>
                                                    <p className="text-xs opacity-40 mt-1">
                                                        Press "Capture" to scan
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Finger selector grid */}
                                    <div className="w-full">
                                        <p className="text-[10px] text-base-content opacity-40 mb-1">
                                            Select finger:
                                        </p>
                                        <div className="grid grid-cols-5 gap-1">
                                            {FINGERS.map((f) => {
                                                const isReg =
                                                    registeredIndexes.has(
                                                        f.index,
                                                    );
                                                const isSel =
                                                    selectedFinger === f.index;
                                                return (
                                                    <button
                                                        key={f.index}
                                                        onClick={() => {
                                                            setSelectedFinger(
                                                                f.index,
                                                            );
                                                            setCapturedData(
                                                                null,
                                                            );
                                                            setCaptureState(
                                                                "idle",
                                                            );
                                                        }}
                                                        title={f.label}
                                                        className={`rounded border transition-all text-center py-1 px-0.5
                                                            ${
                                                                isSel
                                                                    ? "bg-primary text-primary-content border-primary"
                                                                    : isReg
                                                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
                                                                      : "bg-base-200 text-base-content border-base-300 hover:bg-base-300"
                                                            }`}
                                                        style={{ fontSize: 10 }}
                                                    >
                                                        <div className="font-bold">
                                                            {f.index}
                                                        </div>
                                                        <div className="opacity-70 leading-tight text-[9px]">
                                                            {f.label
                                                                .replace(
                                                                    "Right ",
                                                                    "R.",
                                                                )
                                                                .replace(
                                                                    "Left ",
                                                                    "L.",
                                                                )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={handleCapture}
                                            disabled={
                                                captureState === "capturing"
                                            }
                                            className="btn btn-primary flex-1 gap-1 btn-sm"
                                        >
                                            {captureState === "capturing" ? (
                                                <>
                                                    <LoadingOutlined spin />{" "}
                                                    Scanning…
                                                </>
                                            ) : (
                                                <>
                                                    <ReloadOutlined />{" "}
                                                    {captureState === "success"
                                                        ? "Re-capture"
                                                        : "Capture"}
                                                </>
                                            )}
                                        </button>

                                        {captureState === "success" && (
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="btn btn-success flex-1 gap-1 btn-sm"
                                            >
                                                {saving ? (
                                                    <>
                                                        <LoadingOutlined spin />{" "}
                                                        Saving…
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircleFilled />{" "}
                                                        Save
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {selectedFingerData && (
                                            <button
                                                onClick={() =>
                                                    handleDelete(selectedFinger)
                                                }
                                                className="btn btn-error btn-outline gap-1 btn-sm"
                                            >
                                                <DeleteOutlined /> Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <style>{`
                            @keyframes scan {
                                0%   { top: 0;    opacity: 0; }
                                50%  { opacity: 1; }
                                100% { top: 100%; opacity: 0; }
                            }
                        `}</style>
                    </div>
                    <div className="modal-backdrop" onClick={closeModal}></div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
