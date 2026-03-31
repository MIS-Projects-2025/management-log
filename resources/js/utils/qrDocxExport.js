import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';

/**
 * Generate QR code as base64 data URL
 * @param {string} value - Value to encode in QR
 * @returns {Promise<string>} - Base64 data URL
 */
const generateQRCodeDataURL = async (value) => {
    try {
        return await QRCode.toDataURL(value, {
            width: 200,
            margin: 2,
            errorCorrectionLevel: 'H',
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
};

/**
 * Convert base64 data URL to buffer
 * @param {string} dataURL - Base64 data URL
 * @returns {Uint8Array} - Buffer
 */
const dataURLtoBuffer = (dataURL) => {
    const base64 = dataURL.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

/**
 * Create a cell with QR code and employee info
 * @param {Object} employee - Employee object
 * @param {string} qrDataURL - QR code data URL
 * @returns {TableCell} - Table cell with QR and info
 */
const createQRCell = async (employee, qrDataURL) => {
    const qrBuffer = dataURLtoBuffer(qrDataURL);
    
    return new TableCell({
        children: [
            // QR Code Image
            new Paragraph({
                children: [
                    new ImageRun({
                        data: qrBuffer,
                        transformation: {
                            width: 150,
                            height: 150,
                        },
                    }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
            }),
            // Employee Name
            new Paragraph({
                text: employee.EMPNAME || 'N/A',
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
                style: 'Strong',
            }),
            // Employee ID
            new Paragraph({
                text: `ID: ${employee.EMPLOYID || 'N/A'}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
            }),
            // Department
            new Paragraph({
                text: employee.DEPARTMENT || 'N/A',
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
            }),
            // Job Title
            new Paragraph({
                text: employee.JOB_TITLE || 'N/A',
                alignment: AlignmentType.CENTER,
            }),
        ],
        width: {
            size: 33,
            type: WidthType.PERCENTAGE,
        },
        margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
        },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
    });
};

/**
 * Create an empty cell (placeholder)
 * @returns {TableCell} - Empty table cell
 */
const createEmptyCell = () => {
    return new TableCell({
        children: [
            new Paragraph({
                text: '',
            }),
        ],
        width: {
            size: 33,
            type: WidthType.PERCENTAGE,
        },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
        },
    });
};

/**
 * Export employee QR codes to Word document
 * @param {Array} employees - Array of employee objects
 * @param {number} qrPerPage - Number of QR codes per page (default: 6)
 */
export const exportEmployeeQRCodesToDocx = async (employees, qrPerPage = 6) => {
    try {
        if (!employees || employees.length === 0) {
            alert('No employees to export!');
            return;
        }

        console.log(`Generating QR codes for ${employees.length} employees...`);

        // Generate QR codes for all employees
        const qrCodes = await Promise.all(
            employees.map(async (emp) => {
                const qrDataURL = await generateQRCodeDataURL(emp.EMPLOYID);
                return { employee: emp, qrDataURL };
            })
        );

        // Split into chunks based on qrPerPage (2 columns, so 3 rows per page for 6 QR codes)
        const rowsPerPage = Math.ceil(qrPerPage / 2);
        const pages = [];
        
        for (let i = 0; i < qrCodes.length; i += qrPerPage) {
            const pageQRCodes = qrCodes.slice(i, i + qrPerPage);
            pages.push(pageQRCodes);
        }

        // Create document sections
        const sections = [];

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const pageQRCodes = pages[pageIndex];
            const rows = [];

            // Create rows with 2 QR codes each
            for (let i = 0; i < pageQRCodes.length; i += 2) {
                const leftQR = pageQRCodes[i];
                const rightQR = pageQRCodes[i + 1];

                const leftCell = await createQRCell(leftQR.employee, leftQR.qrDataURL);
                const rightCell = rightQR 
                    ? await createQRCell(rightQR.employee, rightQR.qrDataURL)
                    : createEmptyCell();

                rows.push(
                    new TableRow({
                        children: [leftCell, rightCell],
                        height: {
                            value: 3000,
                            rule: 'atLeast',
                        },
                    })
                );
            }

            // Add title paragraph
            const titleParagraph = new Paragraph({
                text: `VIP Employee QR Codes - Page ${pageIndex + 1} of ${pages.length}`,
                heading: 'Heading1',
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            });

            // Create table
            const table = new Table({
                rows: rows,
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE,
                },
            });

            sections.push({
                children: [titleParagraph, table],
                properties: {
                    page: {
                        margin: {
                            top: 720,
                            right: 720,
                            bottom: 720,
                            left: 720,
                        },
                    },
                },
            });
        }

        // Create document
        const doc = new Document({
            sections: sections,
            styles: {
                paragraphStyles: [
                    {
                        id: 'Strong',
                        name: 'Strong',
                        basedOn: 'Normal',
                        run: {
                            bold: true,
                            size: 24,
                        },
                    },
                ],
            },
        });

        // Generate and save document
        console.log('Generating Word document...');
        const blob = await Packer.toBlob(doc);
        const filename = `VIP_QR_Codes_${new Date().toISOString().split('T')[0]}.docx`;
        saveAs(blob, filename);

        console.log('✓ Document generated successfully!');
        alert(`✓ QR codes exported successfully!\nFile: ${filename}`);

    } catch (error) {
        console.error('Error exporting QR codes:', error);
        alert('Failed to export QR codes. Please try again.');
    }
};