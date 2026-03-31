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
export const findEmployeeByCode = (employees, code) => {
    return employees.find(
        (emp) =>
            emp.EMPLOYID?.toLowerCase() === code.toLowerCase() ||
            emp.EMPID?.toString() === code ||
            emp.EMPNAME?.toLowerCase().includes(code.toLowerCase())
    );
};

/**
 * Setup keyboard scanner listener
 * @param {Function} onScan - Callback when scan is complete
 * @param {boolean} isActive - Whether scanner is active
 * @returns {Function} - Cleanup function
 */
export const setupScannerListener = (onScan, isActive = true) => {
    if (!isActive) return () => {};

    let scanBuffer = "";
    let scanTimeout = null;

    const handleKeyPress = (e) => {
        // Prevent default behavior
        e.preventDefault();

        // Clear timeout on each keypress
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }

        // Add character to buffer
        if (e.key === "Enter") {
            // Scanner typically sends Enter at the end
            if (scanBuffer.trim()) {
                onScan(scanBuffer.trim());
                scanBuffer = "";
            }
        } else if (e.key.length === 1) {
            // Only add printable characters
            scanBuffer += e.key;
        }

        // Auto-process if no input for 100ms (scanner is typically very fast)
        scanTimeout = setTimeout(() => {
            if (scanBuffer.trim()) {
                onScan(scanBuffer.trim());
                scanBuffer = "";
            }
        }, 100);
    };

    // Add event listener
    window.addEventListener("keypress", handleKeyPress);

    // Return cleanup function
    return () => {
        window.removeEventListener("keypress", handleKeyPress);
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
    };
};