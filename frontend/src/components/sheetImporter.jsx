import React, { useState, useRef, useEffect } from 'react';
import '../screenSizing.css';

const allowedSheetTypes = [
  'PregCheck',
  'PregCheck_Extended', 
  'CalvingTracker',
  'Weanlings', 
  'WeightCheck'
];

const dynamicImportAction = async (file, sheetName, sheetStructures) => {
  // Security check
  if (!allowedSheetTypes.includes(sheetName)) {
    throw new Error(`Sheet type '${sheetName}' is not allowed for import`);
  }

  // Get preloaded sheet definition
  const sheetDef = sheetStructures[sheetName];
  if (!sheetDef) {
    throw new Error(`Sheet definition not found for: ${sheetName}`);
  }

  const columnsData = JSON.parse(sheetDef.Columns);
  const columns = columnsData.columns || columnsData; 
  const editableColumns = columns.filter(col => col.editable);
  
  // Read Excel file
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const records = [];
  const headers = {};
  
  // Read headers
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Validate CowTag exists
  const headerValues = Object.values(headers);
  if (!headerValues.includes('CowTag')) {
    throw new Error('Missing required column: CowTag');
  }

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.value;
      }
    });

    if (!record.CowTag) continue;

    // Build update object using column definitions
    const updateData = { cowTag: record.CowTag };
    
    editableColumns.forEach(col => {
      const displayName = col.name;
      const key = col.key;
      
      if (record[displayName] !== undefined && record[displayName] !== '') {
        updateData[key] = record[displayName];
      }
    });

    // Only include records that have editable changes
    const hasChanges = Object.keys(updateData).length > 1; // more than just cowTag
    if (hasChanges) {
      records.push(updateData);
    }
  }

  if (records.length === 0) {
    return 'No records with changes found in file';
  }

  // SEND DATA TO API
  const updates = [];

  records.forEach(record => {
    const { cowTag, ...fieldUpdates } = record;
    
    Object.entries(fieldUpdates).forEach(([columnKey, value]) => {
      // Get handler from column definition
      const column = editableColumns.find(col => col.key === columnKey);
      const handler = column?.updateHandler || 'genericUpdate'; // fallback
      
      updates.push({
        cowTag,
        columnKey,
        value,
        handler
      });
    });
  });

  const apiResponse = await fetch('/api/sheets/batch-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ updates }) 
  });

  if (!apiResponse.ok) {
    const error = await apiResponse.json();
    throw new Error(`Failed to import: ${error.error || 'Unknown error'}`);
  }

  const result = await apiResponse.json();
  return `Successfully imported ${result.recordsProcessed || records.length} records`;
};

function SheetImporter({ onClose, onImportComplete, importAction = null, sheetType = null }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [sheetStructures, setSheetStructures] = useState({});
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [detectedSheetType, setDetectedSheetType] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const fileInputRef = useRef(null);

  // Preload sheet structures on component mount
  useEffect(() => {
    const loadSheetStructures = async () => {
      try {
        const response = await fetch('/api/sheets/all-sheets', { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Failed to fetch sheet definitions');
        }
        
        const data = await response.json();
        const structures = {};
        
        // Filter and index by sheet name
        data.sheets.forEach(sheet => {
          if (allowedSheetTypes.includes(sheet.SheetName)) {
            structures[sheet.SheetName] = sheet;
          }
        });
        
        setSheetStructures(structures);
      } catch (error) {
        console.error('Error loading sheet structures:', error);
        setImportResult('Warning: Could not load sheet definitions. Import functionality may be limited.');
      } finally {
        setLoadingStructures(false);
      }
    };

    loadSheetStructures();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const detectSheetTypeFromFile = async (file, sheetStructures) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      
      // Check for 'Sheet Structure' metadata sheet
      const structureSheet = workbook.worksheets.find(sheet => 
        sheet.name === 'Sheet Structure' || sheet.name === 'SheetStructure'
      );
      
      if (structureSheet) {
        const metadata = {};
        
        // Read metadata from key-value pairs
        for (let rowNumber = 2; rowNumber <= structureSheet.rowCount; rowNumber++) {
          const row = structureSheet.getRow(rowNumber);
          const property = row.getCell(1).value;
          const value = row.getCell(2).value;
          
          if (property && value) {
            metadata[property] = value;
          }
        }
        
        // Check for SheetName or SheetType
        const embeddedType = metadata.SheetName || metadata.SheetType;
        if (embeddedType && allowedSheetTypes.includes(embeddedType)) {
          return {
            sheetType: embeddedType,
            metadata: metadata,
            detectionMethod: 'metadata_sheet'
          };
        }
      }
      
      // Structure-based detection as fallback
      const worksheet = workbook.getWorksheet(1);
      if (worksheet) {
        const headers = [];
        worksheet.getRow(1).eachCell((cell) => {
          if (cell.value) headers.push(cell.value);
        });
        
        const detectedType = detectSheetTypeByStructure(headers, sheetStructures);
        if (detectedType) {
          return {
            sheetType: detectedType,
            metadata: { detectedFromStructure: true },
            detectionMethod: 'structure_analysis'
          };
        }
      }
      
      // Method 3: Filename fallback (least reliable)
      const filenameType = detectSheetTypeFromFilename(file.name);
      if (filenameType) {
        return {
          sheetType: filenameType,
          metadata: { detectedFromFilename: true },
          detectionMethod: 'filename'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting sheet type:', error);
      return null;
    }
  };

  const detectSheetTypeByStructure = (headers, sheetStructures) => {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [sheetName, sheetDef] of Object.entries(sheetStructures)) {
      const columnsData = JSON.parse(sheetDef.Columns);
const columns = columnsData.columns || columnsData; 
      const expectedHeaders = ['CowTag', ...columns.filter(col => col.editable).map(col => col.name)];
      
      // Count exact matches
      const matchCount = expectedHeaders.filter(expected => headers.includes(expected)).length;
      const matchPercentage = matchCount / expectedHeaders.length;
      
      if (matchPercentage > bestScore && matchPercentage > 0.7) { // 70% threshold
        bestScore = matchPercentage;
        bestMatch = sheetName;
      }
    }
    
    return bestMatch;
  };

  const detectSheetTypeFromFilename = (filename) => {
    const name = filename.toLowerCase();
    
    if (name.includes('preg')) {
      if (name.includes('extended')) return 'PregCheck_Extended';
      return 'PregCheck';
    }
    if (name.includes('calv')) return 'CalvingTracker';
    if (name.includes('wean')) return 'Weanlings';
    if (name.includes('weigh') || name.includes('weight')) return 'WeightCheck';
    
    return null;
  };

  const validateFileStructure = async (file, sheetTypeToCheck) => {
    try {
      // Get sheet definition
      const sheetDef = sheetStructures[sheetTypeToCheck];
      if (!sheetDef) {
        return { valid: false, message: `Sheet definition not found for: ${sheetTypeToCheck}` };
      }
        
      const columnsData = JSON.parse(sheetDef.Columns);
const columns = columnsData.columns || columnsData; 
      const editableColumns = columns.filter(col => col.editable);
      const expectedColumns = ['CowTag', ...editableColumns.map(col => col.name)];

      // Read Excel headers
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        return { valid: false, message: 'No worksheet found in file' };
      }

      const headers = [];
      worksheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value);
      });

      // Check for required columns
      const missingColumns = expectedColumns.filter(col => !headers.includes(col));
      const extraColumns = headers.filter(col => !expectedColumns.includes(col));

      if (missingColumns.length > 0) {
        return { 
          valid: false, 
          message: `Missing required columns: ${missingColumns.join(', ')}`,
          details: {
            missing: missingColumns,
            extra: extraColumns,
            expected: expectedColumns,
            found: headers
          }
        };
      }

      return { 
        valid: true, 
        message: `File structure matches ${sheetTypeToCheck} format`,
        details: {
          foundColumns: headers.length,
          editableColumns: editableColumns.length
        }
      };

    } catch (error) {
      return { valid: false, message: `Validation error: ${error.message}` };
    }
  };

  const handleFile = async (file) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      alert('Please select an Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    setSelectedFile(file);
    setImportResult(''); // Clear previous results
    setValidationResult(null); // Clear previous validation

    // Detect sheet type
    let typeToCheck = sheetType;
    let detectionInfo = null;
    
    if (!typeToCheck) {
      detectionInfo = await detectSheetTypeFromFile(file, sheetStructures);
      typeToCheck = detectionInfo?.sheetType;
    }
    
    setDetectedSheetType(typeToCheck);

    // Show detection method in UI if available
    if (detectionInfo && detectionInfo.detectionMethod) {
      console.log(`Sheet type detected via: ${detectionInfo.detectionMethod}`);
    }

    // Validate structure if we have sheet structures loaded and detected a type
    if (typeToCheck && Object.keys(sheetStructures).length > 0) {
      try {
        const validation = await validateFileStructure(file, typeToCheck);
        setValidationResult(validation);
      } catch (error) {
        setValidationResult({ 
          valid: false, 
          message: `Unable to validate file structure: ${error.message}` 
        });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportResult('');
    
    try {
      let targetSheetType = null;
      
      if (sheetType && allowedSheetTypes.includes(sheetType)) {
        // Use specified sheet type
        targetSheetType = sheetType;
      } else {
        // Use detected sheet type
        targetSheetType = detectedSheetType;
      }

      if (!targetSheetType) {
        throw new Error(
          'Could not determine sheet type. Please ensure the filename contains one of: ' +
          allowedSheetTypes.join(', ') + 
          ' or the file matches a supported sheet format.'
        );
      }

      const result = await dynamicImportAction(selectedFile, targetSheetType, sheetStructures);
      setImportResult(result);
      
      // Auto-close after successful import
      setTimeout(() => {
        onImportComplete();
      }, 2000);
      
    } catch (error) {
      console.error('Import error:', error);
      setImportResult(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setImportResult('');
    setValidationResult(null);
    setDetectedSheetType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loadingStructures) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading sheet definitions...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Warning Banner */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '5px',
        padding: '15px',
        marginBottom: '20px',
        color: '#856404'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
          ⚠️ Limited Import Functionality
        </div>
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>
          Import system only accepts locked sheet types and their derivative children. Only editable fields will be imported.
          When importing derivative sheets, only the original parent fields will be processed.
        </div>
        <div style={{ fontSize: '14px' }}>
          <strong>Supported sheet types:</strong> {allowedSheetTypes.join(', ')}
        </div>
      </div>

      {/* File Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? '#007bff' : '#ddd'}`,
          borderRadius: '10px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: dragActive ? '#f0f8ff' : '#f9f9f9',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: '20px'
        }}
        onClick={handleBrowse}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        
        <div style={{ fontSize: '48px', marginBottom: '20px', color: '#666' }}>
          📁
        </div>
        
        {selectedFile ? (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745', marginBottom: '10px' }}>
              File Selected: {selectedFile.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Size: {(selectedFile.size / 1024).toFixed(1)} KB
              {detectedSheetType && (
                <div style={{ marginTop: '5px', color: '#007bff' }}>
                  Detected Type: {detectedSheetType}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="button"
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                fontSize: '14px'
              }}
            >
              Clear File
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              Drop Excel file here
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              or click to browse for files
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Supported formats: .xlsx, .xls, .csv
            </div>
          </div>
        )}
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div style={{
          backgroundColor: validationResult.valid ? '#d4edda' : '#f8d7da',
          border: `1px solid ${validationResult.valid ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px',
          padding: '15px',
          marginBottom: '20px',
          color: validationResult.valid ? '#155724' : '#721c24'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {validationResult.valid ? '✓ Structure Validation' : '✗ Structure Validation'}
          </div>
          <div>{validationResult.message}</div>
          {validationResult.details && !validationResult.valid && (
            <div style={{ fontSize: '12px', marginTop: '10px', fontFamily: 'monospace' }}>
              <div>Expected: {validationResult.details.expected?.join(', ')}</div>
              <div>Found: {validationResult.details.found?.join(', ')}</div>
              {validationResult.details.missing?.length > 0 && (
                <div style={{ color: '#dc3545' }}>Missing: {validationResult.details.missing.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div style={{
          backgroundColor: importResult.includes('failed') ? '#f8d7da' : '#d4edda',
          border: `1px solid ${importResult.includes('failed') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '5px',
          padding: '15px',
          marginBottom: '20px',
          color: importResult.includes('failed') ? '#721c24' : '#155724'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            Import Result:
          </div>
          <div>{importResult}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          disabled={importing}
          className="button"
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            opacity: importing ? 0.6 : 1,
            cursor: importing ? 'not-allowed' : 'pointer'
          }}
        >
          {importResult && !importResult.includes('failed') ? 'Close' : 'Cancel'}
        </button>
        
        <button
          onClick={handleImport}
          disabled={!selectedFile || importing || (validationResult && !validationResult.valid)}
          className="button"
          style={{
            padding: '10px 20px',
            backgroundColor: (selectedFile && !importing && (!validationResult || validationResult.valid)) ? '#28a745' : '#6c757d',
            color: 'white',
            opacity: (selectedFile && !importing && (!validationResult || validationResult.valid)) ? 1 : 0.6,
            cursor: (selectedFile && !importing && (!validationResult || validationResult.valid)) ? 'pointer' : 'not-allowed'
          }}
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>

      {/* Import Instructions */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '5px',
        fontSize: '14px',
        color: '#1565c0'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Import Instructions:</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Column names must exactly match the exported sheet</li>
          <li>Empty rows will be skipped</li>
          <li>Only editable fields will be processed</li>
          <li>Sheet type is auto-detected from filename</li>
        </ul>
      </div>
    </div>
  );
}

export default SheetImporter;