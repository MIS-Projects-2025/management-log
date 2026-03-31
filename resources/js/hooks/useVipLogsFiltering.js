import { useMemo } from 'react';
import { generateDateRange, groupLogsByEmployeeAndDate } from '@/utils/logFormatters';

/**
 * Custom hook to filter VIP logs based on selection
 *
 * @param {Object|null} selectedVip    - Selected VIP employee or null for all
 * @param {string}      selectedDate   - Selected date for "all employees" view (YYYY-MM-DD)
 * @param {string}      selectedMonth  - Selected month for individual VIP view (YYYY-MM)
 * @param {Array}       vips           - All VIP employees
 * @param {Array}       allLogs        - All log records from backend
 * @returns {Array}                    - Filtered and formatted log rows
 */
export const useVipLogsFiltering = (selectedVip, selectedDate, selectedMonth, vips, allLogs) => {
    return useMemo(() => {

        // ── SINGLE EMPLOYEE VIEW ─────────────────────────────────────────────
        // Show one row per day in the selected month, filled with log data if present.
        if (selectedVip) {
            // Derive start/end from selectedMonth (YYYY-MM)
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = `${selectedMonth}-01`;
            const lastDay   = new Date(year, month, 0).getDate(); // last day of month
            const endDate   = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

            const dateRange = generateDateRange(startDate, endDate);

            // Use loose string comparison to avoid int vs string mismatch
            const employeeLogs = allLogs.filter(
                log => String(log.employee_id) === String(selectedVip.employee_id)
            );

            const groupedLogs = groupLogsByEmployeeAndDate(employeeLogs);

            return dateRange
                .map((d, index) => {
                    const logData = groupedLogs.find(log => log.date === d.date);
                    return {
                        id:          index,
                        date:        d.date,
                        day:         d.day,
                        check_in:    logData?.check_in    || '—',
                        break_out_1: logData?.break_out_1 || '—',
                        break_in_1:  logData?.break_in_1  || '—',
                        break_out_2: logData?.break_out_2 || '—',
                        break_in_2:  logData?.break_in_2  || '—',
                        check_out:   logData?.check_out   || '—',
                    };
                })
                .reverse(); // Newest dates first
        }

        // ── ALL EMPLOYEES VIEW ───────────────────────────────────────────────
        // Show one row per VIP for the selected date.
        const logsForDate = allLogs.filter(log => log.log_date === selectedDate);
        const groupedLogs = groupLogsByEmployeeAndDate(logsForDate);

        return vips
            .filter(v => v.name)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((vip, index) => {
                const logData = groupedLogs.find(
                    // Use loose string comparison for safety
                    log => String(log.employee_id) === String(vip.employee_id)
                );

                return {
                    id:            index,
                    employee_name: vip.name,
                    date:          selectedDate,
                    day:           new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                    }),
                    check_in:    logData?.check_in    || '—',
                    break_out_1: logData?.break_out_1 || '—',
                    break_in_1:  logData?.break_in_1  || '—',
                    break_out_2: logData?.break_out_2 || '—',
                    break_in_2:  logData?.break_in_2  || '—',
                    check_out:   logData?.check_out   || '—',
                };
            });

    }, [selectedVip, selectedDate, selectedMonth, vips, allLogs]);
};