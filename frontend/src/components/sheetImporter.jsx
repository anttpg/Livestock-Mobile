import React, { useState, useRef } from 'react';
import '../screenSizing.css';

function SheetImporter({ onClose, onImportComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const fileInputRef = useRef(null);

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

  const handleFile = (file) => {
    if (!file.name.endsWith('.xlsx')) {
      alert('Only .xlsx files are supported. CSV files cannot store the required sheet metadata.');
      return;
    }
    setSelectedFile(file);
    setImportResult('');
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult('');

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await selectedFile.arrayBuffer());

      // Read metadata from hidden _meta sheet
      const metaSheet = workbook.getWorksheet('_meta');
      if (!metaSheet) throw new Error('No metadata found. Only files exported from this system can be imported.');

      const meta = {};
      metaSheet.eachRow(row => {
        const key   = row.getCell(1).value;
        const value = row.getCell(2).value;
        if (key) meta[key] = value;
      });

      const instanceId = parseInt(meta.instanceId);
      const columnData = JSON.parse(meta.columnData);
      const animalTags = JSON.parse(meta.animalTags);

      if (!instanceId) throw new Error('Could not read instance ID from file metadata.');

      // Build colIndex -> field lookup, mirroring the exporter's cellMap exactly
      const fieldLookup = {};
      let ec = 1;
      for (const col of columnData) {
          if (col.storage === 'record') {
              for (const field of (col.fields || []).filter(f => !f.hidden)) {
                  if (field.editable) {
                      fieldLookup[ec] = { recordSlot: col.recordSlot, fieldKey: field.key, inline: false };
                  }
                  ec++;
              }
          } else {
              if (col.storage === 'inline' && col.editable) {
                  fieldLookup[ec] = { inlineKey: col.key, inline: true };
              }
              ec++;
          }
      }

      // Read data sheet headers (row 1 is group headers, row 2 is field names)
      const ws = workbook.getWorksheet(1);
      if (!ws) throw new Error('No data worksheet found.');

      // Derive CowTag column index from columnData metadata — same order as export cellMap
      let cowTagColIndex = null;
      let _ec = 1;
      for (const col of columnData) {
        if (col.storage === 'record') {
          _ec += (col.fields || []).filter(f => !f.hidden).length;
        } else {
          if (col.key === 'CowTag') cowTagColIndex = _ec;
          _ec++;
        }
      }
      if (!cowTagColIndex) throw new Error('CowTag not found in column metadata.');

      const fieldHeaders = {}; // colIndex -> field display name
      ws.getRow(2).eachCell((cell, colIndex) => {
        if (cell.value) fieldHeaders[colIndex] = String(cell.value);
      });



      // Names belonging to snapshot/inline columns — these bleed into row 2 via merged cells
      const nonRecordNames = new Set(
          columnData
              .filter(col => col.storage !== 'record')
              .map(col => col.name)
      );

      const expectedFieldNames = new Set(
        Object.values(fieldLookup)
            .filter(l => !l.inline)
            .map(({ recordSlot, fieldKey }) => {
                const col = columnData.find(c => c.recordSlot === recordSlot);
                return col?.fields.find(f => f.key === fieldKey)?.name;
            }).filter(Boolean)
      );

      const actualFieldNames   = new Set(
          Object.values(fieldHeaders).filter(n => !nonRecordNames.has(n))
      );

      const missing = [...expectedFieldNames].filter(n => !actualFieldNames.has(n));
      const extra   = [...actualFieldNames].filter(n => !expectedFieldNames.has(n));

      if (missing.length > 0 || extra.length > 0) {
          const lines = [];
          if (missing.length > 0) lines.push(`Missing from file: ${missing.join(', ')}`);
          if (extra.length > 0)   lines.push(`Unexpected in file: ${extra.join(', ')}`);
          throw new Error(
              `Column mismatch — this file does not match the sheet instance.\n\n${lines.join('\n')}\n\nMake sure you are importing a file exported from this exact sheet instance.`
          );
      }

      // Build rows payload: [{ cowTag, slots: { [recordSlot]: { [fieldKey]: value } } }]
      const rows = [];

      for (let r = 3; r <= ws.rowCount; r++) {
        const row       = ws.getRow(r);
        const rawCowTag = row.getCell(cowTagColIndex).value;
        // CowTag is exported as a hyperlink object -- extract the text value
        const cowTag    = rawCowTag?.text ?? String(rawCowTag ?? '');
        if (!cowTag || !animalTags.includes(cowTag)) continue;

        const slots = {};
        const inlineFields = {};

        row.eachCell((cell, colIndex) => {
          const lookup = fieldLookup[colIndex];
          if (!lookup) return;

          if (lookup.inline) {
              inlineFields[lookup.inlineKey] = cell.value ?? null;
          } else {
              const { recordSlot, fieldKey } = lookup;
              if (!slots[recordSlot]) slots[recordSlot] = {};
              slots[recordSlot][fieldKey] = cell.value ?? null;
          }
        });

        if (Object.keys(slots).length > 0 || Object.keys(inlineFields).length > 0) {
          rows.push({ cowTag: String(cowTag), slots, inlineFields });
        }
      }

      if (rows.length === 0) {
        setImportResult('No editable data found in file.');
        return;
      }

      const response = await fetch(`/api/sheets/instances/${instanceId}/cells`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      setImportResult(`Successfully imported data for ${result.created} new records and ${result.updated} updated records across ${rows.length} animals.`);

      setTimeout(() => onImportComplete(), 2000);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          Warning: This will overwrite existing sheet data
        </div>
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>
          Importing will overwrite all editable field values in this sheet instance with the values from the file.
          Only fields that were editable at export time will be processed. Non-editable and snapshot columns are ignored.
        </div>
        <div style={{ fontSize: '14px' }}>
          Only .xlsx files exported by this system are supported
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
          accept=".xlsx"
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
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="button"
              style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', fontSize: '14px' }}
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
              Supported format: .xlsx (exported from this system)
            </div>
          </div>
        )}
      </div>

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
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Import Result:</div>
          <div>{importResult}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          disabled={importing}
          className="button"
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', opacity: importing ? 0.6 : 1, cursor: importing ? 'not-allowed' : 'pointer' }}
        >
          {importResult && !importResult.includes('failed') ? 'Close' : 'Cancel'}
        </button>

        <button
          onClick={handleImport}
          disabled={!selectedFile || importing}
          className="button"
          style={{ padding: '10px 20px', backgroundColor: (selectedFile && !importing) ? '#28a745' : '#6c757d', color: 'white', opacity: (selectedFile && !importing) ? 1 : 0.6, cursor: (selectedFile && !importing) ? 'pointer' : 'not-allowed' }}
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>

      {/* Import Instructions */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', fontSize: '14px', color: '#1565c0' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Import Instructions:</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Only editable fields will be processed. Read-only and snapshot columns are ignored</li>
          <li><u>All</u> editable values in the current sheet instance will be overwritten. This may cause records to dissapear if they exist on the website, but not on the excel file!</li>
        </ul>
      </div>
    </div>
  );
}

export default SheetImporter;