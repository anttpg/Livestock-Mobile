import React, { useState, useEffect } from 'react';
import SheetEditor from './sheetEditor';
import SheetImporter from './sheetImporter';
import Fieldsheets from './fieldsheets';
import ExcelJS from 'exceljs';
import Table from './table';
import AnimalFolder from './animalFolder';
import Popup from './popup';
import '../screenSizing.css';

// Main Sheet Component
function Sheet({
    sheetId,
    sheetName,
    isEditor = false,
    locked = false,
    onEditorClose,
    bodyComponent = null,
    showImportButton = false,
    editLive = true,
    selectableRows = false,
    showActionColumn = false,
    breedingYear = null,
    breedingPlanId = null,
    onActionClick = null,
    actionButtonText = "VIEW",
    actionButtonColor = "#28a745"
}) {
    const [sheetData, setSheetData] = useState(null);
    const [herds, setHerds] = useState([]);
    const [selectedHerd, setSelectedHerd] = useState('All active');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updateHandlers, setUpdateHandlers] = useState({});
    const [showImporter, setShowImporter] = useState(false);
    const [showFieldsheets, setShowFieldsheets] = useState(false);
    const [resolvedSheetId, setResolvedSheetId] = useState(null);
    const [allSheets, setAllSheets] = useState([]);
    const [formDropdownData, setFormDropdownData] = useState({});
    const [currentBreedingYear, setCurrentBreedingYear] = useState(new Date().getFullYear());

    // Edit state management
    const [pendingChanges, setPendingChanges] = useState({});
    const [selectedRows, setSelectedRows] = useState(new Set());

    // Add state for animal popup
    const [showAnimalPopup, setShowAnimalPopup] = useState(false);

    // Resolve sheet name to ID when component mounts or sheetName changes
    useEffect(() => {
        if (sheetName && !sheetId) {
            fetchAllSheets();
        } else if (sheetId) {
            setResolvedSheetId(sheetId);
        }
    }, [sheetName, sheetId]);

    const getActionButtonTextForRow = (row, rowIndex) => {
        if (typeof actionButtonText === 'function') {
            return actionButtonText(row, rowIndex);
        }
        return actionButtonText;
    };

    // Helper function to get dynamic action button color
    const getActionButtonColorForRow = (row, rowIndex) => {
        if (typeof actionButtonColor === 'function') {
            return actionButtonColor(row, rowIndex);
        }
        return actionButtonColor;
    };

    // Load data when we have a resolved sheet ID and herd
    useEffect(() => {
        if (!isEditor && resolvedSheetId) {
            loadSheetData();
            fetchHerds();
            fetchFormDropdownData();
            fetchCurrentBreedingYear();
        }
    }, [resolvedSheetId, selectedHerd, isEditor]);


    useEffect(() => {
        if (selectableRows && sheetData?.data?.length) {
            const allTags = new Set(sheetData.data.map((row, index) => row['CowTag'] || index));
            setSelectedRows(allTags);
        }
    }, [sheetData, selectableRows]);




    const fetchAllSheets = async () => {
        try {
            const response = await fetch('/api/sheets/all-sheets', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const sheets = data.sheets || [];
                setAllSheets(sheets);

                const foundSheet = sheets.find(sheet => sheet.SheetName === sheetName);
                if (foundSheet) {
                    setResolvedSheetId(foundSheet.ID);
                } else {
                    console.error(`Sheet "${sheetName}" not found`);
                }
            }
        } catch (error) {
            console.error('Error in fetchAllSheets:', error);
        }
    };

    const fetchHerds = async () => {
        try {
            const response = await fetch('/api/herds/list', {
                credentials: 'include'
            });

            if (response.ok) {
                const herdsData = await response.json();
                const herdsList = Array.isArray(herdsData) ? herdsData : (herdsData.herds || []);
                setHerds(['All active', ...herdsList]);
            } else {
                setHerds(['All active']);
            }
        } catch (error) {
            console.error('Error fetching herds:', error);
            setHerds(['All active']);
        }
    };

    const fetchFormDropdownData = async () => {
        try {
            const response = await fetch('/api/form-dropdown-data', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setFormDropdownData(data);
            }
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
        }
    };

    const fetchCurrentBreedingYear = async () => {
        try {
            const response = await fetch('/api/breeding-plans', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const plans = data.plans || [];
                const activePlan = plans.find(p => p.IsActive) || plans[0];
                if (activePlan) {
                    setCurrentBreedingYear(activePlan.PlanYear);
                }
            }
        } catch (error) {
            console.error('Error fetching breeding year:', error);
        }
    };

    const loadSheetData = async () => {
        if (!resolvedSheetId) return;

        setLoading(true);
        try {
            const response = await fetch('/api/sheets/load', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    sheetId: resolvedSheetId,
                    herdName: selectedHerd,
                    breedingYear: breedingYear || currentBreedingYear,  // Use passed breeding year
                    breedingPlanId: breedingPlanId,                     // Include plan ID
                    sheetName: sheetName
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSheetData(enhanceSheetData(data));
                setUpdateHandlers(data.updateHandlers || {});
                setPendingChanges({});
                setSelectedRows(new Set());
            } else {
                console.error('Failed to load sheet data');
            }
        } catch (error) {
            console.error('Error loading sheet data:', error);
        } finally {
            setLoading(false);
        }
    };

    const enhanceSheetData = (data) => {
        if (!data.columns) return data;

        // Enhance columns with proper configuration
        const enhancedColumns = data.columns.map(col => {
            const enhanced = { ...col };

            // Set editable based on JSON config or defaults
            if (col.editable === undefined) {
                enhanced.editable = col.dataPath && col.dataPath.startsWith('Fillable/');
            }

            // Determine input type
            if (col.type === 'date' || col.key.toLowerCase().includes('date')) {
                enhanced.inputType = 'date';
            } else if (col.type === 'number' || col.key.toLowerCase().includes('weight')) {
                enhanced.inputType = 'number';
            } else if (col.type === 'select' || col.options) {
                enhanced.inputType = 'select';
                enhanced.options = col.options || getDropdownOptions(col.key);
            } else if (col.key.toLowerCase().includes('pregnant') ||
                col.key.toLowerCase().includes('open')) {
                enhanced.inputType = 'select';
                enhanced.options = ['', 'Yes', 'No'];
            } else {
                enhanced.inputType = 'text';
            }

            return enhanced;
        });

        return {
            ...data,
            columns: enhancedColumns
        };
    };

    const getDropdownOptions = (columnKey) => {
        const key = columnKey.toLowerCase();

        if (key.includes('result') || key.includes('breeding')) {
            return ['', 'Pregnant', 'Open'];
        } else if (key.includes('sex') || key.includes('fetus')) {
            return ['', 'Heifer', 'Bull'];
        } else if (key.includes('genotype')) {
            return ['', ...(formDropdownData.genotypes || [])];
        } else if (key.includes('temperament')) {
            return ['', ...(formDropdownData.temperaments || [])];
        } else if (key.includes('status')) {
            return ['', ...(formDropdownData.statuses || [])];
        }

        return [];
    };

    const handleCellEdit = async (rowIndex, columnKey, newValue) => {
        const rowId = sheetData.data[rowIndex]['CowTag'] || rowIndex;

        if (editLive) {
            // Save immediately
            setSaving(true);
            try {
                await saveCellChange(rowIndex, columnKey, newValue);

                // Update local data
                const newData = { ...sheetData };
                newData.data[rowIndex][columnKey] = newValue;
                setSheetData(newData);
            } catch (error) {
                console.error('Error saving cell:', error);
                alert('Failed to save changes');
            } finally {
                setSaving(false);
            }
        } else {
            // Store pending change
            setPendingChanges(prev => ({
                ...prev,
                [`${rowId}_${columnKey}`]: {
                    rowIndex,
                    columnKey,
                    newValue,
                    cowTag: sheetData.data[rowIndex]['CowTag']
                }
            }));

            // Update local display
            const newData = { ...sheetData };
            newData.data[rowIndex][columnKey] = newValue;
            setSheetData(newData);
        }
    };

    const saveCellChange = async (rowIndex, columnKey, newValue) => {
        if (!updateHandlers[columnKey]) return;

        const cowTag = sheetData.data[rowIndex]['CowTag'];
        
        if (!cowTag || cowTag.trim() === '') {
            console.error('Cannot save cell: Invalid cow tag at row', rowIndex);
            throw new Error('Invalid cow tag - cannot save changes');
        }


        // Add debugging
        console.log('Saving cell change:', {
            columnKey,
            handler: updateHandlers[columnKey],
            cowTag,
            newValue,
            currentBreedingYear
        });

        const response = await fetch('/api/sheets/update-cell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                handler: updateHandlers[columnKey],
                cowTag: cowTag.trim(),
                value: newValue,
                breedingYear: breedingYear || currentBreedingYear,  // Include breeding year
                breedingPlanId: breedingPlanId                      // Include plan ID
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update cell');
        }
    };

    const handleSaveAll = async () => {
        const changesToSave = selectableRows ?
            Object.values(pendingChanges).filter(change =>
                selectedRows.has(change.cowTag)) :
            Object.values(pendingChanges);

        if (changesToSave.length === 0) {
            alert('No changes to save');
            return;
        }

        setSaving(true);
        try {
            for (const change of changesToSave) {
                await saveCellChange(change.rowIndex, change.columnKey, change.newValue);
            }

            setPendingChanges({});
            alert(`Successfully saved ${changesToSave.length} changes`);
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save some changes');
        } finally {
            setSaving(false);
        }
    };

    const handleRowSelection = (rowIndex, selected) => {
        const cowTag = sheetData.data[rowIndex]['CowTag'] || rowIndex;
        const newSelected = new Set(selectedRows);

        if (selected) {
            newSelected.add(cowTag);
        } else {
            newSelected.delete(cowTag);
        }

        setSelectedRows(newSelected);
    };

    const handleSelectAll = (selected) => {
        if (selected) {
            const allTags = new Set(sheetData.data.map(row => row['CowTag'] || sheetData.data.indexOf(row)));
            setSelectedRows(allTags);
        } else {
            setSelectedRows(new Set());
        }
    };
    const renderEditableCell = (value, row, rowIndex, column) => {
        const { inputType, options, editable } = column;

        // For conditional text styling based on row selection
        const textStyle = {
            opacity: selectableRows && !selectedRows.has(row['CowTag'] || rowIndex) ? 0.5 : 1,
            transition: 'opacity 0.2s ease'
        };

        if (!editable) {
            // Handle CowTag/CalfTag hyperlinks for non-editable cells
            if (column.key === 'CowTag' || column.key === 'CalfTag' || column.key.toLowerCase().includes('tag')) {
                return (
                    <span
                        style={{
                            color: '#007bff',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            ...textStyle // Apply conditional styling
                        }}
                        onClick={() => window.location.href = `/animal?tab=general&search=${encodeURIComponent(value)}`}
                    >
                        {value || ''}
                    </span>
                );
            }

            // Regular non-editable text with conditional styling
            return (
                <span style={textStyle}>
                    {value || ''}
                </span>
            );
        }

        const handleChange = (newValue) => {
            handleCellEdit(rowIndex, column.key, newValue);
        };

        if (column.type === 'action' && column.key === 'add_calf_button') {
            return (
                <button
                    onClick={() => handleAddCalf(row.CowTag, row.bull)}
                    style={{
                        padding: '4px 8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        ...textStyle // Apply conditional styling to buttons too
                    }}
                >
                    Add Calf
                </button>
            );
        }

        if (column.type === 'checkbox' || column.key.includes('checked')) {
            const isChecked = value !== undefined ? value : true; // Default to true

            return (
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleChange(e.target.checked)}
                    style={{
                        transform: 'scale(1.2)',
                        cursor: 'pointer',
                        ...textStyle // Apply conditional styling
                    }}
                />
            );
        }

        // For editable inputs, wrap them in a container with conditional styling
        const inputStyle = {
            width: '100%',
            border: 'none',
            backgroundColor: 'transparent',
            padding: '2px',
            ...textStyle // Apply conditional styling to inputs
        };

        switch (inputType) {
            case 'select':
                return (
                    <select
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        style={inputStyle}
                    >
                        {options.map((option, index) => (
                            <option key={index} value={option}>{option}</option>
                        ))}
                    </select>
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        style={inputStyle}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        step="0.01"
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        style={inputStyle}
                    />
                );

            default:
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        style={inputStyle}
                    />
                );
        }
    };

    const handleCloseAnimalPopup = () => {
        setShowAnimalPopup(false);
    };

    const getFilteredDataForExport = () => {
        if (!selectableRows || selectedRows.size === 0) {
            return sheetData.data;
        }
        return sheetData.data.filter(row => selectedRows.has(row['CowTag'] || sheetData.data.indexOf(row)));
    };

    const handleExport = async (format) => {
        if (format === 'excel') {
            try {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet(sheetName);
                const dataToExport = getFilteredDataForExport();

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
                dataToExport.forEach((row) => {
                    const rowData = sheetData.columns.map(col => row[col.key] || '');
                    worksheet.addRow(rowData);
                });

                // Add alternating blue row colors to data rows
                for (let rowNum = 2; rowNum <= dataToExport.length + 1; rowNum++) {
                    worksheet.getRow(rowNum).eachCell((cell) => {
                        if (rowNum % 2 === 0) { // Even rows
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF0F8FF' } // Light Grey
                            }

                        };

                        // add borders back
                        const borderStyle = { style: 'thin', color: { argb: 'FFb7b7b7' } };
                        cell.border = {
                            top: borderStyle,
                            left: borderStyle,
                            bottom: borderStyle,
                            right: borderStyle,
                        };
                    });


                }

                // Sheet Structure metadata sheet
                const structureSheet = workbook.addWorksheet('Sheet Structure');

                // Add metadata
                structureSheet.addRow(['Property', 'Value']);
                structureSheet.addRow(['SheetName', sheetName]);
                structureSheet.addRow(['ExportDate', new Date().toISOString()]);
                structureSheet.addRow(['Version', '1.0']);
                structureSheet.addRow(['Source', 'Livestock Database']);

                // Future-proofing: Add column structure as JSON
                structureSheet.addRow(['ColumnStructure', JSON.stringify(sheetData.columns)]);

                // Format structure sheet
                structureSheet.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE0E0E0' }
                    };
                    cell.font = { bold: true };
                });
                structureSheet.getColumn(1).width = 20;
                structureSheet.getColumn(2).width = 50;

                // Apply column formatting and validation
                sheetData.columns.forEach((column, colIndex) => {
                    const excelCol = worksheet.getColumn(colIndex + 1);
                    excelCol.width = 15;
                    
                    // Apply data validation based on column type
                    if (column.editable) {
                        const range = `${excelCol.letter}2:${excelCol.letter}${dataToExport.length + 1}`;
                        
                        switch (column.inputType || column.type) {
                            case 'select':
                                if (column.options && column.options.length > 0) {
                                    worksheet.dataValidations.add(range, {
                                        type: 'list',
                                        allowBlank: true,
                                        formulae: [`"${column.options.join(',')}"`],
                                        showErrorMessage: true,
                                        errorTitle: 'Invalid Selection',
                                        error: `Please select from: ${column.options.join(', ')}`
                                    });
                                }
                                break;
                                
                            case 'date':
                                worksheet.dataValidations.add(range, {
                                    type: 'date',
                                    allowBlank: true,
                                    operator: 'greaterThan',
                                    formulae: [new Date(1900, 0, 1)],
                                    showErrorMessage: true,
                                    errorTitle: 'Invalid Date',
                                    error: 'Please enter a valid date'
                                });
                                // Format as date
                                excelCol.numFmt = 'mm/dd/yyyy';
                                break;
                                
                            case 'number':
                                worksheet.dataValidations.add(range, {
                                    type: 'decimal',
                                    allowBlank: true,
                                    operator: 'greaterThanOrEqual',
                                    formulae: [0],
                                    showErrorMessage: true,
                                    errorTitle: 'Invalid Number',
                                    error: 'Please enter a valid number (0 or greater)'
                                });
                                break;
                        }
                    }
                });

                // Generate and download file
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
        }

        else if (format === 'google-sheets') {
            if (isEditor) {
                setShowFieldsheets(true);
            } else {
                alert('Export to Google Sheets not yet implemented');
            }
        }
    };

    const handlePrint = () => {
        if (!sheetData || !sheetData.data) {
            alert('No data to print');
            return;
        }

        const dataToPrint = getFilteredDataForExport();
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
              ${dataToPrint.map(row => `
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

        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    };

    const handleImport = () => {
        setShowImporter(true);
    };

    if (isEditor) {
        return (
            <SheetEditor
                isOpen={true}
                onClose={onEditorClose}
                sheetId={sheetId}
                sheetName={sheetName}
                locked={locked}
            />
        );
    }

    const tableColumns = sheetData ? sheetData.columns.map(col => ({
        key: col.key,
        header: col.name,
        width: 'auto',
        type: col.type,
        customRender: (value, row, rowIndex) => renderEditableCell(value, row, rowIndex, col)
    })) : [];

    // Add selection column if enabled
    if (selectableRows && sheetData) {
        tableColumns.unshift({
            key: '_select',
            header: (
                <input
                    type="checkbox"
                    checked={selectedRows.size === sheetData.data.length && sheetData.data.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                />
            ),
            width: '40px',
            customRender: (value, row, rowIndex) => {
                const cowTag = row['CowTag'] || rowIndex;
                return (
                    <input
                        type="checkbox"
                        checked={selectedRows.has(cowTag)}
                        onChange={(e) => handleRowSelection(rowIndex, e.target.checked)}
                    />
                );
            }
        });
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
                {/* Left side - Action buttons and status */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={handlePrint}
                        className="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 12px',
                            backgroundColor: '#6c757d',
                            color: 'white'
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

                    

                    {/* Save button or saving status */}
                    {editLive ? (
                        saving && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#666' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                    hourglass
                                </span>
                                Saving...
                            </div>
                        )
                    ) : (
                        <button
                            onClick={handleSaveAll}
                            disabled={Object.keys(pendingChanges).length === 0 || saving}
                            className="button"
                            style={{
                                padding: '8px 16px',
                                backgroundColor: Object.keys(pendingChanges).length > 0 ? '#28a745' : '#6c757d',
                                color: 'white',
                                opacity: saving ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Saving...' : `Save${Object.keys(pendingChanges).length > 0 ? ` (${Object.keys(pendingChanges).length})` : ''}`}
                        </button>
                    )}

                    {selectableRows && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                            {selectedRows.size} selected
                        </div>
                    )}
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

            {/* Body Component (if provided) */}
            {bodyComponent && (
                <div style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                    <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',       // space between Export and Import
                padding: '10px',   // padding between this container and its parent
                flexWrap: 'nowrap' // keep buttons on the same line
            }}>
                <div style={{ position: 'relative' }}>
                    <button
                        className="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 12px'
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

                {showImportButton && (
                    <button
                        onClick={handleImport}
                        className="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 12px',
                            backgroundColor: '#17a2b8',
                            color: 'white'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            cloud_upload
                        </span>
                        Import
                    </button>
                )}
            </div>
                    {bodyComponent}
                </div>
            )}

            

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
                            showActionColumn={showActionColumn}
                            data={sheetData.data}
                            columns={tableColumns}
                            rawMode={true}
                            evenRowColor="#f0f8ff"
                            oddRowColor="#fff"
                            onActionClick={onActionClick}
                            actionButtonText={getActionButtonTextForRow}  // Pass the helper function
                            actionButtonColor={getActionButtonColorForRow} // Pass the helper function
                        />
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        fontSize: '18px',
                        color: '#666'
                    }}>
                        {resolvedSheetId ? 'No data available for this sheet' : (sheetName ? `Loading sheet "${sheetName}"...` : 'Sheet not loaded')}
                    </div>
                )}
            </div>

            {/* Animal Details Popup */}
            {showAnimalPopup && (
                <Popup
                    isOpen={showAnimalPopup}
                    onClose={handleCloseAnimalPopup}
                    title={`Animal Details - TODO FIX`}
                    fullscreen={true}
                >
                    <div style={{ width: '100%', height: '100%' }}>
                        <AnimalFolder
                            enableDefaultSearch={true}
                            hideSearchBar={false}
                        />
                    </div>
                </Popup>
            )}

            {/* Sheet Importer Popup */}
            <Popup
                isOpen={showImporter}
                onClose={() => setShowImporter(false)}
                title="Import Sheet Data"
                maxWidth="600px"
            >
                <SheetImporter
                    onClose={() => setShowImporter(false)}
                    onImportComplete={() => {
                        setShowImporter(false);
                        loadSheetData();
                    }}
                />
            </Popup>

            {/* Fieldsheets Export Popup */}
            <Popup
                isOpen={showFieldsheets}
                onClose={() => setShowFieldsheets(false)}
                title="Export Options"
                maxWidth="90vw"
                maxHeight="90vh"
            >
                <Fieldsheets sheets={[sheetName]} />
            </Popup>
        </div>
    );
}

export default Sheet;