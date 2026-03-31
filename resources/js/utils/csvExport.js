/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename without extension
 */
export const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
        alert("No data to export!");
        return;
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Convert data to CSV format
    const csvContent = [
        headers.join(","), // Header row
        ...data.map(row => 
            headers.map(header => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const cell = row[header] !== null ? String(row[header]) : "";
                return cell.includes(",") || cell.includes('"') || cell.includes("\n") 
                    ? `"${cell.replace(/"/g, '""')}"` 
                    : cell;
            }).join(",")
        )
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};