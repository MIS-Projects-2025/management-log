/**
 * Log type configurations
 */
export const logTypeOptions = [
    { value: "check_in", label: "Time In", color: "text-green-600", badgeClass: "badge-success" },
    { value: "check_out", label: "Time Out", color: "text-red-600", badgeClass: "badge-error" },
];

/**
 * Get badge configuration for a log type
 * @param {string} logType - Log type value
 * @returns {Object|null} - Badge configuration object
 */
export const getLogTypeBadge = (logType) => {
    if (!logType) return null;
    const config = logTypeOptions.find(opt => opt.value === logType);
    return config || { label: logType, badgeClass: "badge-ghost" };
};

/**
 * Find employee by scanned code
 * @param {Array} employees - Array of employee objects
 * @param {string} code - Scanned code
 * @returns {Object|null} - Found employee or null
 */
const QR_ALIAS_MAP = {
    "697": "8563",
};

export const findEmployeeByCode = (employees, code) => {
    const normalizedCode = String(code).replace(/^0+/, "").trim();
    const resolvedCode = QR_ALIAS_MAP[normalizedCode] ?? normalizedCode;
    return employees.find((emp) => {
        const normalizedId    = String(emp.EMPLOYID ?? "").replace(/^0+/, "").trim();
        const normalizedEmpId = String(emp.EMPID    ?? "").replace(/^0+/, "").trim();
        return normalizedId === resolvedCode || normalizedEmpId === resolvedCode;
    });
};

/**
 * Setup keyboard scanner listener
 * @param {Function} onScan - Callback when scan is complete
 * @param {boolean} isActive - Whether scanner is active
 * @returns {Function} - Cleanup function
 */
export const setupScannerListener = (onScan, isBlocked = false) => {
    if (isBlocked) return () => {};

    let scanBuffer = "";
    let scanTimeout = null;

    const flush = () => {
        const code = scanBuffer.trim();
        scanBuffer = "";
        if (code) onScan(code);
    };

    const handleKeyDown = (e) => {
    const tag = document.activeElement?.tagName ?? "";
    const isTypingField =
        ["INPUT", "TEXTAREA", "SELECT"].includes(tag) &&
        document.activeElement?.dataset?.scanner !== "ignore";
    if (isTypingField) return;

        if (e.key === "Enter") {
            if (scanTimeout) {
                clearTimeout(scanTimeout);
                scanTimeout = null;
            }
            flush();
            return;
        }

        if (e.key.length !== 1) return;

        scanBuffer += e.key;

        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            scanTimeout = null;
            flush();
        }, 150);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        if (scanTimeout) clearTimeout(scanTimeout);
    };
};