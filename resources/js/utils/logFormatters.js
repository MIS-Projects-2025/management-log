/**
 * Format date to DD/MM/YYYY
 * @param {string} dateString - Date string
 * @returns {string} - Formatted date
 */
export const formatDateDTR = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day   = date.getDate();
    const year  = date.getFullYear();
    return `${month}/${day}/${year}`;
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
const getPrevDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
};

/**
 * Group logs by employee_id and date with proper night shift handling
 * This matches the logic used in ExportManagementLogs job
 */
export const groupLogsByEmployeeAndDate = (logs, employeeExpectedDates = {}) => {
    const NIGHT_SHIFT_START_HOUR = 18; // 6 PM (matches export job's 18)
    const NIGHT_CUTOFF_HOUR      = 14; // 2 PM
    
    // ── Pass 1: Index all logs by employee and sort chronologically ──────────
    const allLogs = {};
    
    logs.forEach(log => {
        const empId = String(log.employee_id);
        const date = log.log_date;
        const time = log.log_time;
        const hour = parseInt((time || '00:00:00').split(':')[0], 10);
        const datetime = `${date} ${time}`;
        
        if (!allLogs[empId]) allLogs[empId] = [];
        
        allLogs[empId].push({
            datetime: datetime,
            date: date,
            time: time,
            hour: hour,
            type: log.log_type,
            formatted_time: log.formatted_time || time
        });
    });
    
    // Sort each employee's logs chronologically
    Object.keys(allLogs).forEach(empId => {
        allLogs[empId].sort((a, b) => a.datetime.localeCompare(b.datetime));
    });
    
    // ── Pass 2: Build logSlots by pairing check_in with check_out ────────────
    const logSlots = {};
    
    Object.keys(allLogs).forEach(empId => {
        const empLogs = allLogs[empId];
        let pendingNightAnchor = null; // date of open night shift waiting for check_out
        
        empLogs.forEach(log => {
            const date = log.date;
            const time = log.formatted_time || log.time;
            const hour = log.hour;
            const type = log.type;
            
            if (type === 'check_in') {
                if (hour >= NIGHT_SHIFT_START_HOUR) {
                    // Night shift check_in — open a new night anchor
                    if (!logSlots[empId]) logSlots[empId] = {};
                    if (!logSlots[empId][date]) logSlots[empId][date] = {};
                    if (!logSlots[empId][date].check_in) {
                        logSlots[empId][date].check_in = time;
                    }
                    pendingNightAnchor = date;
                } else {
                    // Day shift check_in — anchor to same date
                    if (!logSlots[empId]) logSlots[empId] = {};
                    if (!logSlots[empId][date]) logSlots[empId][date] = {};
                    if (!logSlots[empId][date].check_in) {
                        logSlots[empId][date].check_in = time;
                    }
                }
            } else if (type === 'check_out') {
                if (hour < NIGHT_CUTOFF_HOUR && pendingNightAnchor !== null) {
                    // Early morning check_out — belongs to pending night shift
                    const anchor = pendingNightAnchor;
                    if (!logSlots[empId]) logSlots[empId] = {};
                    if (!logSlots[empId][anchor]) logSlots[empId][anchor] = {};
                    
                    if (!logSlots[empId][anchor].check_out || 
                        time > logSlots[empId][anchor].check_out) {
                        logSlots[empId][anchor].check_out = time;
                    }
                    pendingNightAnchor = null;
                } else if (hour >= NIGHT_CUTOFF_HOUR) {
                    // Day shift check_out or late check_out
                    if (!logSlots[empId]) logSlots[empId] = {};
                    if (!logSlots[empId][date]) logSlots[empId][date] = {};
                    
                    if (!logSlots[empId][date].check_out || 
                        time > logSlots[empId][date].check_out) {
                        logSlots[empId][date].check_out = time;
                    }
                }
            }
        });
    });
    
    return logSlots;
};