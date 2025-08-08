import React, { useState, useEffect } from 'react';
import SheetEditor from './sheetEditor';
import ExcelJS from 'exceljs';
import Table from './table'; 

// Main Sheet Component
function Sheet({ sheetId, sheetName, isEditor = false, onEditorClose }) {
    const [sheetData, setSheetData] = useState(null);
    const [herds, setHerds] = useState([]);
    const [selectedHerd, setSelectedHerd] = useState('All active');
    const [loading, setLoading] = useState(false);
    const [updateHandlers, setUpdateHandlers] = useState({});

    useEffect(() => {
        if (!isEditor && sheetId) {
            loadSheetData();
            fetchHerds();
        }
    }, [sheetId, selectedHerd, isEditor]);

    const fetchHerds = async () => {
        try {
            const response = await fetch('/api/herds/list', {
                credentials: 'include'
            });

            if (response.ok) {
                const herdsData = await response.json();
                // Fix: herdsData is an array directly, not nested in herds property
                const herdsList = Array.isArray(herdsData) ? herdsData : (herdsData.herds || []);
                setHerds(['All active', ...herdsList]);
            } else {
                console.error('Failed to fetch herds');
                setHerds(['All active']);
            }
        } catch (error) {
            console.error('Error fetching herds:', error);
            setHerds(['All active']);
        }
    };

    const loadSheetData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sheets/load', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    sheetId: sheetId,
                    herdName: selectedHerd
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSheetData(data);
                setUpdateHandlers(data.updateHandlers || {});
            } else {
                console.error('Failed to load sheet data');
            }
        } catch (error) {
            console.error('Error loading sheet data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCellEdit = async (rowIndex, columnKey, newValue) => {
        if (updateHandlers[columnKey]) {
            const cowTag = sheetData.data[rowIndex]['CowTag']; // Assuming CowTag is always available
            try {
                const response = await fetch('/api/sheets/update-cell', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        handler: updateHandlers[columnKey],
                        cowTag: cowTag,
                        value: newValue
                    })
                });

                if (response.ok) {
                    // Update local data
                    const newData = { ...sheetData };
                    newData.data[rowIndex][columnKey] = newValue;
                    setSheetData(newData);
                } else {
                    alert('Failed to update cell');
                }
            } catch (error) {
                console.error('Error updating cell:', error);
                alert('Error updating cell');
            }
        }
    };

    // Replace the current handleExport function (around line 70)
    const handleExport = async (format) => {
        if (format === 'excel') {
            try {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet(sheetName);

                // Add headers
                const headers = sheetData.columns.map(col => col.name);
                worksheet.addRow(headers);

                // Style headers
                worksheet.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE0E0E0' }
                    };
                    cell.font = { bold: true };
                });

                // Add data rows
                sheetData.data.forEach((row) => {
                    const rowData = sheetData.columns.map(col => row[col.key] || '');
                    worksheet.addRow(rowData);
                });

                // Auto-fit columns
                worksheet.columns.forEach((column) => {
                    column.width = 15;
                });

                // Generate buffer and download
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${sheetName}_${selectedHerd}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);

            } catch (error) {
                console.error('Export error:', error);
                alert('Failed to export Excel file');
            }
        } else {
            alert(`Export to ${format} not yet implemented`);
        }
    };

    // Fixed printing functionality - opens new tab with just the table
    const handlePrint = () => {
        if (!sheetData || !sheetData.data) {
            alert('No data to print');
            return;
        }

        const printWindow = window.open('', '_blank');
        const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${sheetName} - ${selectedHerd}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
            }
            h1 { 
              text-align: center; 
              margin-bottom: 20px;
              font-size: 24px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 12px;
              margin: 0;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 6px 8px; 
              text-align: left;
            }
            th { 
              background-color: #f8f9fa; 
              font-weight: bold;
            }
            tr:nth-child(even) { 
              background-color: #f9f9f9; 
            }
            @media print {
              body { margin: 0; }
              h1 { font-size: 18px; margin-bottom: 15px; }
              table { font-size: 10px; }
              th, td { padding: 4px 6px; }
            }
          </style>
        </head>
        <body>
          <h1>${sheetName} - ${selectedHerd}</h1>
          <table>
            <thead>
              <tr>
                ${sheetData.columns.map(column => `<th>${column.name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sheetData.data.map(row => `
                <tr>
                  ${sheetData.columns.map(column => `<td>${row[column.key] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for content to load, then print
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    };

    if (isEditor) {
        return (
            <SheetEditor
                isOpen={true}
                onClose={onEditorClose}
                sheetId={sheetId}
                sheetName={sheetName}
            />
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top Row Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px',
                borderBottom: '1px solid #ddd',
                backgroundColor: '#f8f9fa'
            }}>
                {/* Left side - Print and Export buttons */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <button
                        onClick={handlePrint}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 12px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        <img
                            src="/images/print.png"
                            alt="Print"
                            style={{ width: '16px', height: '16px' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                        Print
                    </button>

                    <div style={{ position: 'relative' }}>
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 12px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                const dropdown = document.getElementById('export-dropdown');
                                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                            }}
                        >
                            <img
                                src="/images/export.png"
                                alt="Export"
                                style={{ width: '16px', height: '16px' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            Export ▼
                        </button>

                        <div
                            id="export-dropdown"
                            style={{
                                display: 'none',
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '3px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                zIndex: 1000,
                                minWidth: '150px'
                            }}
                        >
                            <div
                                onClick={() => handleExport('excel')}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                Export to Excel
                            </div>
                            <div
                                onClick={() => handleExport('google-sheets')}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                Export to Google Sheets
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side - Herd selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold' }}>Herd:</label>
                    <select
                        value={selectedHerd}
                        onChange={(e) => setSelectedHerd(e.target.value)}
                        style={{
                            padding: '10px 10px',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            fontSize: '16px',
                            minWidth: '120px'
                        }}
                    >
                        {herds.map((herd, index) => (
                            <option key={index} value={herd}>
                                {herd}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Sheet Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
                {loading ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        fontSize: '18px',
                        color: '#666'
                    }}>
                        Loading sheet data...
                    </div>
                ) : sheetData && sheetData.data ? (
                    <div style={{ overflowX: 'auto' }}>
                        <Table
                            showActionColumn={false}
                            data={sheetData.data}
                            columns={sheetData.columns.map(col => ({
                                key: col.key,
                                header: col.name,
                                width: 'auto',
                                customRender: (value, row, rowIndex) => {
                                if (updateHandlers[col.key]) {
                                    return (
                                    <input
                                        type="text"
                                        value={value || ''}
                                        onChange={(e) => handleCellEdit(rowIndex, col.key, e.target.value)}
                                        style={{
                                        width: '100%',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        padding: '2px'
                                        }}
                                    />
                                    );
                                }
                                return value || '';
                                }
                            }))}
                            rawMode={true}
                            evenRowColor="#f0f8ff"
                            oddRowColor="#fff"
                        />
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        fontSize: '18px',
                        color: '#666'
                    }}>
                        {sheetId ? 'No data available for this sheet' : 'Sheet not loaded'}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Sheet;