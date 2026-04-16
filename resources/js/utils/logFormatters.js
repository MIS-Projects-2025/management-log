/**
 * Format date to DD/MM/YYYY
 * @param {string} dateString - Date string
 * @returns {string} - Formatted date
 */
export const formatDateDTR = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Convert 12-hour time format to 24-hour with seconds
 * Input: "4:33 AM" or "6:52 PM"
 * Output: "4:33:00 AM" or "6:52:00 PM"
 * @param {string} timeString - Time string
 * @returns {string} - Formatted time
 */
export const formatTimeDTR = (timeString) => {
    if (!timeString || timeString === '—') return '';
    
    // If already has seconds (e.g., "4:33:25 AM"), return as is
    if (timeString.match(/\d{1,2}:\d{2}:\d{2}\s[AP]M/)) {
        return timeString;
    }
    
    // Add :00 seconds if not present
    const parts = timeString.split(' ');
    if (parts.length === 2) {
        return `${parts[0]}:00 ${parts[1]}`;
    }
    
    return timeString;
};

/**
 * Generate date range from start date to end date
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string|null} endDate - End date (YYYY-MM-DD) or null for today
 * @returns {Array} - Array of date objects
 */
export const generateDateRange = (startDate, endDate = null) => {
    const dates = [];
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push({
            date: d.toISOString().split("T")[0],
            day: d.toLocaleDateString("en-US", { weekday: "long" }),
        });
    }

    return dates;
};

/**
 * Group logs by employee_id and date
 * @param {Array} logs - Array of log objects
 * @returns {Array} - Grouped logs
 */
export const groupLogsByEmployeeAndDate = (logs) => {
    const grouped = {};
    
    logs.forEach(log => {
        const empId = String(log.employee_id);
        const date = log.log_date;
        const time = log.formatted_time || log.log_time;
        const logType = log.log_type;
        
        if (!grouped[empId]) grouped[empId] = {};
        if (!grouped[empId][date]) {
            grouped[empId][date] = {
                check_in: null,
                check_out: null,
                break_out_1: null,
                break_in_1: null,
                break_out_2: null,
                break_in_2: null,
            };
        }
        
        // Assign to the appropriate slot based on log_type
        // You may need to adjust this logic based on your actual log_type values
        switch(logType) {
            case 'check_in':
                grouped[empId][date].check_in = time;
                break;
            case 'check_out':
                grouped[empId][date].check_out = time;
                break;
            case 'break_out_1':
                grouped[empId][date].break_out_1 = time;
                break;
            case 'break_in_1':
                grouped[empId][date].break_in_1 = time;
                break;
            case 'break_out_2':
                grouped[empId][date].break_out_2 = time;
                break;
            case 'break_in_2':
                grouped[empId][date].break_in_2 = time;
                break;
            default:
                // If no specific type, try to infer or ignore
                break;
        }
    });
    
    return grouped;
};