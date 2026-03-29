import React, { useState, useEffect } from 'react';
import SheetImporter from './sheetImporter';
import Popup from './popup';
import ExcelJS from 'exceljs';
import '../screenSizing.css';

//  Date helpers 

/** Display only MM/DD/YYYY — never show time to the user. */
const formatDateDisplay = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
    });
};

/** Convert a date-input value (YYYY-MM-DD) back to a full ISO string. */
const dateInputToIso = (dateInputVal) => {
    if (!dateInputVal) return null;
    return new Date(dateInputVal).toISOString();
};

/** Convert an ISO string to a date-input value (YYYY-MM-DD). */
const isoToDateInput = (isoString) => {
    if (!isoString) return '';
    return isoString.split('T')[0];
};

//  Cell renderers 

const cellBase = {
    width: '100%', border: 'none', backgroundColor: 'transparent',
    padding: '4px 6px', fontSize: '13px', boxSizing: 'border-box',
};

function ReadOnlyCell({ value, type, isDefault }) {
    const style = {
        padding: '4px 6px',
        fontSize: '13px',
        color: isDefault ? '#aaa' : 'inherit',
        fontStyle: isDefault ? 'italic' : 'normal',
    };
    if (type === 'date') return <span style={style}>{formatDateDisplay(value)}</span>;
    if (type === 'boolean') return (
        <span style={{ ...style, display: 'block', textAlign: 'center' }}>
            {value == null ? '' : value ? 'Yes' : 'No'}
        </span>
    );
    return <span style={style}>{value ?? ''}</span>;
}

function EditableCell({ value, type, options = [], onChange }) {
    const [localValue, setLocalValue] = useState(value);

    // Keep in sync if parent value changes (e.g. on reload)
    useEffect(() => setLocalValue(value), [value]);

    if (type === 'boolean') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4px 0' }}>
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={e => onChange(e.target.checked)}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                />
            </div>
        );
    }
    if (type === 'select') {
        return (
            <select
                value={value ?? ''}
                onChange={e => onChange(e.target.value || null)}
                style={{ ...cellBase, cursor: 'pointer' }}
            >
                <option value="">-- None --</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        );
    }
    if (type === 'date') {
        return (
            <input
                type="date"
                value={isoToDateInput(value)}
                onChange={e => onChange(dateInputToIso(e.target.value))}
                style={cellBase}
            />
        );
    }
    if (type === 'number') {
        return (
            <input
                type="number"
                step="0.01"
                value={localValue ?? ''}
                onChange={e => setLocalValue(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => onChange(localValue)}
                style={cellBase}
            />
        );
    }
    // text / inline — local state, flush on blur only
    return (
        <input
            type="text"
            value={localValue ?? ''}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue)}
            style={cellBase}
        />
    );
}


//  Main component 
function Sheet({ instanceId, showImportButton = false }) {

    const [sheetData,    setSheetData]    = useState(null);
    const [loading,      setLoading]      = useState(false);
    const [saving,       setSaving]       = useState(false);
    const [showImporter, setShowImporter] = useState(false);

    useEffect(() => {
        if (instanceId) loadInstance();
    }, [instanceId]);

    //  Load 

    const loadInstance = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sheets/instances/${instanceId}/load`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to load instance');
            setSheetData(await res.json());
        } catch (e) {
            console.error('Error loading instance:', e);
        } finally {
            setLoading(false);
        }
    };

    //  Update handlers (stubs) 

    /**
     * Called when a snapshot or inline cell is edited.
     * Snapshot: lives on CowTable — needs cowTag + new value.
     * Inline:   lives only in RowData JSON — same shape, different persistence.
     */
    const handleSnapshotChange = async (cowTag, col, newValue) => {
        applyLocalCell(cowTag, col.key, newValue);
        try {
            if (col.storage === 'inline') {
                // Inline fields live only in RowData — persist via cell endpoint
                await fetch(`/api/sheets/instances/${instanceId}/cell`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        cowTag,
                        recordSlot: col.key,
                        source:     null,
                        fieldKey:   col.key,
                        fieldValue: newValue,
                    }),
                });
            } else {
                // Snapshot fields live on CowTable
                await fetch(`/api/cow/update`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        cowTag,
                        updates: { [col.key]: newValue },
                    }),
                });
            }
        } catch (e) {
            console.error('Error saving snapshot cell:', e);
        }
    };

    /**
     * Called when a record slot field is edited.
     *
     * If the record already exists (recordId is known), we only need
     * the recordId + the changed field — no cowTag required.
     *
     * If the record is null (needs creating), we need the cowTag,
     * the slot metadata, and ALL field values so the backend can
     * INSERT the full record in one shot.
     */
    const handleRecordFieldChange = async (cowTag, col, field, newValue) => {
        const row      = sheetData.data.find(r => r.CowTag === cowTag);
        const existing = row?.[col.recordSlot];

        applyLocalRecordField(cowTag, col.recordSlot, field.key, newValue, existing);

        try {
            await fetch(`/api/sheets/instances/${instanceId}/cell`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cowTag,
                    recordSlot: col.recordSlot,
                    source:     col.source,
                    fieldKey:   field.key,
                    fieldValue: newValue,
                    medicine:   col.medicine || null,
                }),
            });
        } catch (e) {
            console.error('Error saving record cell:', e);
        }
    };

    //  Optimistic local state updates 

    const applyLocalCell = (cowTag, key, newValue) => {
        setSheetData(prev => ({
            ...prev,
            data: prev.data.map(r => r.CowTag === cowTag ? { ...r, [key]: newValue } : r),
        }));
    };

    const applyLocalRecordField = (cowTag, recordSlot, fieldKey, newValue, existing) => {
        setSheetData(prev => ({
            ...prev,
            data: prev.data.map(r => {
                if (r.CowTag !== cowTag) return r;
                const current = r[recordSlot] || { recordId: null, ...(prev.columns.find(c => c.recordSlot === recordSlot)?.defaults || {}) };
                return { ...r, [recordSlot]: { ...current, [fieldKey]: newValue } };
            }),
        }));
    };

    //  Export / Print 
    const handleExport = async () => {
        if (!sheetData?.data) return;
        try {
            const workbook = new ExcelJS.Workbook();
            const ws       = workbook.addWorksheet(sheetData.instanceName || 'Sheet');
            const columns  = sheetData.columns;
 
            //  Palette (mirrors React page) 
            const COLORS = {
                snapshotHeader: 'FFF8F9FA',   // #f8f9fa
                recordHeader:   'FFFCE4EC',   // #fce4ec  (pink tint)
                subHeader:      'FFFFF8E1',   // #fff8e1  (pale yellow)
                rowEven:        'FFFFFFFF',
                rowOdd:         'FFF9F9F9',
                defaultCell:    'FFFFFDE7',   // yellow tint for unlinked records
                cowTagBlue:     'FF0070CC',
                border:         'FFDDDDDD',
                recordBorder:   'FFF48FB1',   // pink border
            };
 
            const thin = (argb) => ({ style: 'thin', color: { argb } });
 
            const applyHeaderStyle = (cell, bgArgb, bold = true, fontSize = 11) => {
                cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.font   = { bold, size: fontSize, name: 'Calibri' };
                cell.border = {
                    top: thin('FFBBBBBB'), left: thin('FFBBBBBB'),
                    bottom: thin('FFBBBBBB'), right: thin('FFBBBBBB'),
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            };
 
            //  Build column map 
            // Each entry: { colIndex (1-based), col, field? }
            const cellMap = [];    // flat list of all leaf columns
            let excelCol = 1;
 
            for (const col of columns) {
                if (col.storage === 'record') {
                    for (const field of col.fields.filter(f => !f.hidden)) {
                        cellMap.push({ excelCol, col, field, isRecord: true });
                        excelCol++;
                    }
                } else {
                    cellMap.push({ excelCol, col, field: null, isRecord: false });
                    excelCol++;
                }
            }
 
            const totalCols = excelCol - 1;
 
            //  Row 1: top-level group headers  
            let writeCol = 1;
            for (const col of columns) {
                if (col.storage === 'record') {
                    const span = col.fields.filter(f => !f.hidden).length;
                    const cell = ws.getRow(1).getCell(writeCol);
                    cell.value = col.name;
                    applyHeaderStyle(cell, COLORS.recordHeader, true, 11);
                    cell.border = {
                        top: thin(COLORS.recordBorder), left: thin(COLORS.recordBorder),
                        bottom: thin(COLORS.recordBorder), right: thin(COLORS.recordBorder),
                    };
                    if (span > 1) {
                        ws.mergeCells(1, writeCol, 1, writeCol + span - 1);
                    }
                    writeCol += span;
                } else {
                    // Snapshot/inline: spans both header rows
                    const cell = ws.getRow(1).getCell(writeCol);
                    cell.value = col.name;
                    applyHeaderStyle(cell, COLORS.snapshotHeader, true, 11);
                    ws.mergeCells(1, writeCol, 2, writeCol);
                    writeCol++;
                }
            }
 
            //  Row 2: sub-field headers (record columns only) 
            for (const { excelCol: ec, col, field, isRecord } of cellMap) {
                if (!isRecord) continue; // already merged into row 1
                const cell = ws.getRow(2).getCell(ec);
                cell.value = field.name;
                applyHeaderStyle(cell, COLORS.subHeader, false, 10);
                cell.border = {
                    top: thin(COLORS.recordBorder), left: thin(COLORS.border),
                    bottom: thin('FFBBBBBB'), right: thin(COLORS.border),
                };
            }
 
            ws.getRow(1).height = 22;
            ws.getRow(2).height = 18;

            // Freeze the CowTag row so its always visible and easy to see
            const cowTagEntry = cellMap.find(c => !c.isRecord && c.col.key === 'CowTag');
            const cowTagColIndex = cowTagEntry ? cowTagEntry.excelCol : 0;
            ws.views = [{ state: 'frozen', xSplit: cowTagColIndex, ySplit: 2 }];
 
            //  Data rows 
            sheetData.data.forEach((row, ri) => {
                const excelRow = ws.getRow(ri + 3);
                excelRow.height = 18;
                const bgArgb = ri % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
 
                for (const { excelCol: ec, col, field, isRecord } of cellMap) {
                    const cell = excelRow.getCell(ec);
 
                    let rawValue;
                    let isDefaultVal = false;
 
                    if (isRecord) {
                        const record = row[col.recordSlot];
                        isDefaultVal = record == null;
                        rawValue     = isDefaultVal
                            ? (col.defaults?.[field.key] ?? null)
                            : (record[field.key] ?? null);
                    } else {
                        rawValue = row[col.key] ?? null;
                    }
 
                    // Cell background
                    cell.fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: isDefaultVal ? COLORS.defaultCell : bgArgb },
                    };
                    cell.border = {
                        top: thin(COLORS.border), left: thin(COLORS.border),
                        bottom: thin(COLORS.border), right: thin(COLORS.border),
                    };
                    cell.font      = { name: 'Calibri', size: 10 };
                    cell.alignment = { vertical: 'middle' };
 
                    const type = isRecord ? field.type : col.type;
 
                    if (type === 'boolean') {
                        cell.value = rawValue === null ? null : !!rawValue;
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.font = { name: 'Calibri', size: 10, bold: true };
                    } else if (type === 'date' && rawValue) {
                        cell.value     = new Date(rawValue);
                        cell.numFmt    = 'mm/dd/yyyy';
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
 
                    } else if (type === 'number' && rawValue != null) {
                        cell.value = Number(rawValue);
 
                    } else if (col.key === 'CowTag') {
                        cell.value = { text: rawValue ?? '', hyperlink: `${window.location.origin}/animal?tab=general&search=${encodeURIComponent(rawValue ?? '')}` };
                        cell.font  = { name: 'Calibri', size: 10, color: { argb: COLORS.cowTagBlue }, underline: true };
 
                    } else {
                        cell.value = rawValue ?? '';
                    }
                }
            });
 
            //  Column widths 
            for (const { excelCol: ec, col, field, isRecord } of cellMap) {
                const wsCol    = ws.getColumn(ec);
                const type     = isRecord ? field.type : col.type;
                wsCol.width    = type === 'date' ? 14 : type === 'boolean' ? 10 : type === 'number' ? 12 : 18;
            }
 
            //  Data validation (select options) 
            const dataRowStart = 3;
            const dataRowEnd   = dataRowStart + sheetData.data.length - 1;
 
            for (const { excelCol: ec, col, field, isRecord } of cellMap) {
                const type    = isRecord ? field.type : col.type;
                const options = isRecord ? (field.options || []) : (col.options || []);
                const colLetter = ws.getColumn(ec).letter;
                const range     = `${colLetter}${dataRowStart}:${colLetter}${dataRowEnd}`;

                if (type === 'boolean') {
                    ws.dataValidations.add(range, {
                        type: 'list', allowBlank: true,
                        formulae: ['"TRUE,FALSE"'],
                        showErrorMessage: true,
                        errorTitle: 'Invalid Value',
                        error: 'Please select TRUE or FALSE',
                    });
                    continue;
                }

                if (type !== 'select' || options.length === 0) continue;

                ws.dataValidations.add(range, {
                    type: 'list', allowBlank: true,
                    formulae: [`"${options.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Selection',
                    error: `Please select from: ${options.join(', ')}`,
                });
            }



            // Hidden metadata in 2nd sheet
            const meta = workbook.addWorksheet('_meta', { state: 'hidden' });

            meta.getColumn(1).width = 30;
            meta.getColumn(2).width = 80;

            const metaRows = [
                ['instanceId',    sheetData.instanceId],
                ['templateId',    sheetData.templateId],
                ['instanceName',  sheetData.instanceName],
                ['templateName',  sheetData.templateName],
                ['breedingYear',  sheetData.breedingYear],
                ['dateCreated',   sheetData.dateCreated],
                ['exportedAt',    new Date().toISOString()],
                ['animalTags',    JSON.stringify(sheetData.animalTags)],
                ['columnData',    JSON.stringify(
                                    sheetData.columns.map(({ get, update, add, ...rest }) => rest)
                                )],
                ['defaults',      JSON.stringify(
                                    sheetData.columns
                                        .filter(c => c.storage === 'record' && c.defaults)
                                        .reduce((acc, c) => {
                                            acc[c.recordSlot] = {
                                                ...(c.medicine && { medicine: c.medicine }),
                                                defaults: c.defaults,
                                            };
                                            return acc;
                                        }, {})
                                )],
            ];

            metaRows.forEach(([key, value], i) => {
                const row = meta.getRow(i + 1);
                row.getCell(1).value = key;
                row.getCell(2).value = String(value ?? '');
                row.getCell(1).font  = { bold: true, name: 'Calibri', size: 10 };
                row.getCell(2).font  = { name: 'Calibri', size: 10 };
            });
            

            //  Write file 
            const buffer = await workbook.xlsx.writeBuffer();
            const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url    = window.URL.createObjectURL(blob);
            const a      = document.createElement('a');
            a.href       = url;
            a.download   = `${sheetData.instanceName || 'sheet'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
 
        } catch (e) {
            console.error('Export error:', e);
            alert('Failed to export');
        }
    };
 
    const handlePrint = () => {
        if (!sheetData?.data) { alert('No data to print'); return; }
        const columns = sheetData.columns;
 
        // Build same two-row header structure as the React table
        // Row 1: group headers (record slot names spanning their fields, snapshot spanning 2 rows)
        // Row 2: sub-field names for record columns only
 
        const row1Cells = [];
        const row2Cells = [];
 
        for (const col of columns) {
            if (col.storage === 'record') {
                row1Cells.push(
                    `<th colspan="${col.fields.filter(f => !f.hidden).length}" style="background:#fce4ec;border:1px solid #f48fb1;text-align:center;padding:6px 8px;font-size:11px;">
                        ${col.name}${col.medicine ? ' <span style="font-weight:normal;font-size:9px;color:#888">(pinned)</span>' : ''}
                    </th>`
                );
                col.fields.filter(f => !f.hidden).forEach(field => {
                    row2Cells.push(
                        `<th style="background:#fff8e1;border:1px solid #ddd;padding:5px 7px;font-size:10px;font-weight:normal;text-align:left;">${field.name}</th>`
                    );
                });
            } else {
                row1Cells.push(
                    `<th rowspan="2" style="background:#f8f9fa;border:1px solid #ddd;padding:6px 8px;font-size:11px;text-align:left;">${col.name}</th>`
                );
            }
        }
 
        // Build data rows
        const dataRows = sheetData.data.map((row, ri) => {
            const cells = [];
            for (const col of columns) {
                if (col.storage === 'record') {
                    const record     = row[col.recordSlot];
                    const isDefault  = record == null;
                    const bg         = isDefault ? 'background:#fffde7;' : (ri % 2 === 1 ? 'background:#f9f9f9;' : '');
                    col.fields.filter(f => !f.hidden).forEach(field => {
                        const value = isDefault
                            ? (col.defaults?.[field.key] ?? '')
                            : (record[field.key] ?? '');
                        let display = '';
                        if (field.type === 'date' && value) {
                            display = new Date(value).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                        } else if (field.type === 'boolean') {
                            display = '';  // empty for print — checkbox not renderable in print
                        } else {
                            display = value ?? '';
                        }
                        cells.push(`<td style="border:1px solid #eee;padding:5px 7px;font-size:10px;${bg}">${display}</td>`);
                    });
                } else {
                    const value = row[col.key] ?? '';
                    const bg    = ri % 2 === 1 ? 'background:#f9f9f9;' : '';
                    if (col.key === 'CowTag') {
                        cells.push(`<td style="border:1px solid #eee;padding:5px 7px;font-size:10px;${bg}color:#0070cc;text-decoration:underline;">${value}</td>`);
                    } else {
                        cells.push(`<td style="border:1px solid #eee;padding:5px 7px;font-size:10px;${bg}">${value}</td>`);
                    }
                }
            }
            return `<tr>${cells.join('')}</tr>`;
        }).join('');
 
        const html = `<!DOCTYPE html><html><head>
            <title>${sheetData.instanceName || 'Sheet'}</title>
            <style>
                body { font-family: Calibri, Arial, sans-serif; margin: 20px; color: #333; }
                h2   { font-size: 16px; margin-bottom: 4px; }
                p    { font-size: 11px; color: #888; margin: 0 0 12px; }
                table { width: 100%; border-collapse: collapse; }
                @media print { body { margin: 0; } }
            </style>
        </head><body>
            <h2>${sheetData.instanceName || 'Sheet'}</h2>
            <p>${sheetData.breedingYear ? `Breeding Year: ${sheetData.breedingYear} · ` : ''}${sheetData.animalTags?.length ?? 0} animals · Printed ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>${row1Cells.join('')}</tr>
                    <tr>${row2Cells.join('')}</tr>
                </thead>
                <tbody>${dataRows}</tbody>
            </table>
        </body></html>`;
 
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.onload = () => { w.print(); w.close(); };
    };

    //  Table rendering 

    const renderTable = () => {
        const { columns, data } = sheetData;

        const thBase = {
            border: '1px solid #ddd', padding: '7px 8px', backgroundColor: '#f8f9fa',
            fontWeight: 'bold', fontSize: '12px', color: '#333', textAlign: 'left',
            whiteSpace: 'nowrap',
        };
        const tdBase = { border: '1px solid #eee', verticalAlign: 'middle', padding: '0' };

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    {/* Row 1 — top-level column names */}
                    <tr>
                        {columns.map((col, i) => {
                            if (col.storage === 'record') {
                                return (
                                    <th
                                        key={col.recordSlot}
                                        colSpan={col.fields.filter(f => !f.hidden).length}
                                        style={{ ...thBase, backgroundColor: '#fce4ec', borderBottom: '1px solid #f48fb1', textAlign: 'center' }}
                                    >
                                        {col.name}
                                        {col.medicine && (
                                            <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal', marginLeft: '4px' }}>
                                                (pinned)
                                            </span>
                                        )}
                                    </th>
                                );
                            }
                            return (
                                <th key={col.key || i} rowSpan={2} style={thBase}>
                                    {col.name}
                                </th>
                            );
                        })}
                    </tr>

                    {/* Row 2 — sub-field names for record slots only */}
                    <tr>
                        {columns.flatMap(col => {
                            if (col.storage !== 'record') return [];
                            return col.fields.filter(f => !f.hidden).map(field => (
                                <th key={`${col.recordSlot}.${field.key}`} style={{ ...thBase, fontSize: '11px', color: '#666', fontWeight: 'normal' }}>
                                    {field.name}
                                </th>
                            ));
                        })}
                    </tr>
                </thead>

                <tbody>
                    {data.map((row, ri) => (
                        <tr
                            key={row.CowTag || ri}
                            style={{ backgroundColor: ri % 2 === 0 ? '#fff' : '#f9f9f9' }}
                        >
                            {columns.map((col, ci) => {

                                //  Snapshot / Inline 
                                if (col.storage !== 'record') {
                                    const value = row[col.key];
                                    const isCowTag = col.key === 'CowTag';

                                    if (isCowTag) {
                                        return (
                                            <td key={col.key} style={{ ...tdBase, padding: '4px 6px' }}>
                                                <a href={`/animal?tab=general&search=${encodeURIComponent(value)}`}
                                                   style={{ color: '#007bff', textDecoration: 'underline', fontSize: '13px' }}>
                                                    {value}
                                                </a>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td key={col.key} style={tdBase}>
                                            {col.editable
                                                ? <EditableCell
                                                    value={value}
                                                    type={col.type}
                                                    options={col.options || []}
                                                    onChange={v => handleSnapshotChange(row.CowTag, col, v)}
                                                  />
                                                : <ReadOnlyCell value={value} type={col.type} isDefault={false} />
                                            }
                                        </td>
                                    );
                                }

                                //  Record slot 
                                const record    = row[col.recordSlot];   // null OR { recordId, ...fields }
                                const isDefault = record == null;        // showing col.defaults, not real data

                                return col.fields.filter(f => !f.hidden).map(field => {
                                    const value = isDefault
                                        ? (col.defaults?.[field.key] ?? null)
                                        : (record[field.key] ?? null);

                                    return (
                                        <td key={`${col.recordSlot}.${field.key}`} style={{
                                            ...tdBase,
                                            backgroundColor: isDefault ? '#fffde7' : 'inherit',
                                        }}>
                                            {field.editable
                                                ? <EditableCell
                                                    value={value}
                                                    type={field.type}
                                                    options={field.options || []}
                                                    onChange={v => handleRecordFieldChange(row.CowTag, col, field, v)}
                                                  />
                                                : <ReadOnlyCell value={value} type={field.type} isDefault={isDefault} />
                                            }
                                        </td>
                                    );
                                });
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    //  Render 

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa', flexShrink: 0 }}>

                <button onClick={handlePrint} className="button"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', backgroundColor: '#6c757d', color: 'white' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>print</span>
                    Print
                </button>

                <button onClick={handleExport} className="button"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
                    Export Excel
                </button>

                {showImportButton && (
                    <button onClick={() => setShowImporter(true)} className="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', backgroundColor: '#17a2b8', color: 'white' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cloud_upload</span>
                        Import
                    </button>
                )}

                {saving && (
                    <span style={{ fontSize: '13px', color: '#888', marginLeft: '4px' }}>Saving...</span>
                )}

                {/* Instance info pill */}
                {sheetData && (
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888', backgroundColor: '#eee', padding: '3px 10px', borderRadius: '12px' }}>
                        {sheetData.instanceName}
                        {sheetData.breedingYear ? ` · ${sheetData.breedingYear}` : ''}
                        {' · '}
                        {sheetData.animalTags?.length ?? 0} animals
                    </span>
                )}
            </div>

            {/* Sheet content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontSize: '16px', color: '#888' }}>
                        Loading sheet...
                    </div>
                ) : sheetData?.data?.length ? (
                    renderTable()
                ) : sheetData ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '14px' }}>
                        No animal data in this instance.
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '14px' }}>
                        {instanceId ? 'Failed to load sheet.' : 'No instance provided.'}
                    </div>
                )}
            </div>

            {/* Legend for default value shading */}
            {sheetData?.columns?.some(c => c.storage === 'record') && (
                <div style={{ padding: '6px 15px', borderTop: '1px solid #eee', fontSize: '11px', color: '#aaa', backgroundColor: '#fafafa', flexShrink: 0 }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#fffde7', border: '1px solid #eee', borderRadius: '2px', marginRight: '5px', verticalAlign: 'middle' }} />
                    Yellow cells show default values — no record has been created yet for this animal.
                </div>
            )}

            <Popup isOpen={showImporter} onClose={() => setShowImporter(false)} title="Import Sheet Data" maxWidth="600px">
                <SheetImporter
                    onClose={() => setShowImporter(false)}
                    onImportComplete={() => { setShowImporter(false); loadInstance(); }}
                />
            </Popup>
        </div>
    );
}

export default Sheet;