import React, { useState, useEffect, useRef } from 'react';
import '../screenSizing.css';
import { addDays } from '../utils/dateUtils';
import { useUser } from '../UserContext';
import Popup from './Popup';
import PopupConfirm from './popupConfirm';
export { addDays };

export const TH_STYLE = {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#495057',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    letterSpacing: '0.2px',
};

// Applied to columns marked required: true
const REQUIRED_TH_STYLE = {
    ...TH_STYLE,
    backgroundColor: '#FCE4EC',
    borderBottom: '2px solid #F48FB1',
};

export const TD_STYLE = {
    padding: '5px 8px',
    borderBottom: '1px solid #e9ecef',
    fontSize: '13px',
    verticalAlign: 'middle',
};

export const INPUT_STYLE = {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'white',
};

export function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

const INPUT_TYPES = new Set(['date', 'select', 'number', 'checkbox', 'text']);

function isInput(type) {
    return INPUT_TYPES.has(type);
}

function defaultRowKey(r) {
    return r.ID != null ? String(r.ID) : String(r.CowTag);
}

// PrefillPanel — driven entirely by the fields config passed in.
// fields: [{ key, label, type: 'date'|'select'|'text', options?: string[], placeholder?: string }]
function PrefillPanel({ fields, onApply }) {
    const [values,    setValues]    = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])));
    const [overwrite, setOverwrite] = useState(false);

    const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

    return (
        <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '14px',
        }}>
            <div style={{
                fontSize: '11px', fontWeight: '700', color: '#6c757d',
                textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px',
            }}>
                Prefill Values
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                alignItems: 'end',
            }}>
                {fields.map(field => (
                    <div key={field.key}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: '#495057' }}>
                            {field.label}
                        </label>

                        {field.type === 'date' && (
                            <input
                                type="date"
                                value={values[field.key]}
                                onChange={e => set(field.key, e.target.value)}
                                style={INPUT_STYLE}
                            />
                        )}

                        {field.type === 'select' && (
                            <select
                                value={values[field.key]}
                                onChange={e => set(field.key, e.target.value)}
                                style={INPUT_STYLE}
                            >
                                <option value=""></option>
                                {(field.options || []).map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        )}

                        {field.type === 'text' && (
                            <input
                                type="text"
                                value={values[field.key]}
                                onChange={e => set(field.key, e.target.value)}
                                placeholder={field.placeholder || ''}
                                style={INPUT_STYLE}
                            />
                        )}
                    </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={overwrite}
                            onChange={e => setOverwrite(e.target.checked)}
                        />
                        Overwrite existing values
                    </label>
                    <button
                        onClick={() => onApply(values, overwrite)}
                        style={{
                            padding: '6px 14px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                        }}
                    >
                        Pre-fill Values
                    </button>
                </div>
            </div>
        </div>
    );
}

// InputCell — renders the correct input element for a column type.
function InputCell({ column, value, onChange }) {
    if (column.type === 'date') {
        return (
            <input
                type="date"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                style={{ ...INPUT_STYLE, minWidth: column.minWidth || '118px' }}
            />
        );
    }

    if (column.type === 'select') {
        return (
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                style={{ ...INPUT_STYLE, minWidth: column.minWidth || '100px' }}
            >
                <option value=""></option>
                {(column.options || []).map(o => (
                    <option key={o} value={o}>{o}</option>
                ))}
            </select>
        );
    }

    if (column.type === 'number') {
        return (
            <input
                type="number"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                min={column.min}
                step={column.step}
                placeholder={column.placeholder || ''}
                style={{ ...INPUT_STYLE, width: column.width || '70px' }}
            />
        );
    }

    if (column.type === 'checkbox') {
        return (
            <input
                type="checkbox"
                checked={!!value}
                onChange={e => onChange(e.target.checked)}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
            />
        );
    }

    if (column.type === 'text') {
        return (
            <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                maxLength={column.maxLength}
                placeholder={column.placeholder || ''}
                style={{ ...INPUT_STYLE, minWidth: column.minWidth }}
            />
        );
    }

    return null;
}

// Form — generic table with optional prefill values, input columns, and submit.
//
// columns: Array of column descriptors:
//   { key, label }                                      — display, renders row[key]
//   { key, label, render: (row) => JSX }                — display, custom render
//   { key, label, type: 'date'|'select'|..., options? } — input, Form manages state
//   { key, label, ..., required: true }                 — marks header with required styling
//   { key, label, ..., hidable: true }                  — column can be toggled via column settings
//
// prefillFields: if provided, renders PrefillPanel above the table.
//   [{ key, label, type, options? }]
//
// onSubmit(rows, rowData): called when submit button clicked.
//   rows:    original row objects
//   rowData: { [rowKey]: { [columnKey]: value } }
//
// formName: string identifier used to persist column visibility in user preferences
//   under preferences.formSettings[formName]
//
// rows, loading, error, onRetry: data lifecycle owned by parent.

function Form({
    title,
    headerContent    = null,
    rows             = [],
    columns          = [],
    rowKey           = defaultRowKey,
    prefillFields    = null,
    onSubmit         = null,
    submitLabel      = 'Save',
    submitting       = false,
    savedCount       = null,
    submitError      = null,
    loading          = false,
    error            = null,
    onRetry          = null,
    showImportButton       = false,
    formName               = null,
    // Called whenever column visibility changes (initial load or toggle).
    // Use this to mirror visibility into sibling components.
    onColVisibilityChange  = null,
    // If provided, adds a delete (×) button on each row. Called with the row object.
    onDelete               = null,
    children,
}) {
    const { user } = useUser();
    const [rowData,       setRowData]       = useState({});
    const [colVisibility, setColVisibility] = useState({});
    const [filterOpen,    setFilterOpen]    = useState(false);
    const [deleteTarget,  setDeleteTarget]  = useState(null);
    const [deleteMode,    setDeleteMode]    = useState(false);
    // Caches the full preferences object so saves never need a redundant GET.
    const cachedPrefs = useRef({});

    // Resolve the username regardless of capitalisation on the user object.
    const username = user?.Username ?? user?.username ?? null;

    // Load column visibility from user preferences on mount (or when auth resolves).
    useEffect(() => {
        if (!formName || !username) return;
        fetch(`/api/users/${encodeURIComponent(username)}/preferences`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const prefs = data?.preferences || {};
                cachedPrefs.current = prefs;
                const saved = prefs?.formSettings?.[formName];
                if (saved) {
                    setColVisibility(saved);
                    onColVisibilityChange?.(saved);
                }
            })
            .catch(() => {});
    }, [formName, username]);

    // Persist an updated visibility map. Uses the cached prefs to avoid a
    // redundant GET — just merges and PUTs in a single request.
    const saveVisibility = async (newVis) => {
        if (!formName || !username) return;
        const updated = {
            ...cachedPrefs.current,
            formSettings: {
                ...(cachedPrefs.current.formSettings || {}),
                [formName]: newVis,
            },
        };
        cachedPrefs.current = updated;
        try {
            await fetch(`/api/users/${encodeURIComponent(username)}/preferences`, {
                method:      'PUT',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify({ preferences: updated }),
            });
        } catch {}
    };

    const toggleColumn = (colKey) => {
        const currently = colVisibility[colKey] !== false; // default: visible
        const newVis = { ...colVisibility, [colKey]: !currently };
        setColVisibility(newVis);
        saveVisibility(newVis);
        onColVisibilityChange?.(newVis);
    };

    const hidableColumns = columns.filter(c => c.hidable);

    // Columns that are actually rendered — non-hidable always show, hidable only if not explicitly false.
    const visibleColumns = columns.filter(c => {
        if (!c.hidable) return true;
        return colVisibility[c.key] !== false;
    });

    // Re-seed rowData when rows change. Preserves any in-progress values.
    useEffect(() => {
        setRowData(prev => {
            const next = {};
            for (const r of rows) {
                const k = rowKey(r);
                next[k] = prev[k] || {};
            }
            return next;
        });
    }, [rows]);

    const handlePrefillValues = (fillValues, overwrite) => {
        setRowData(prev => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
                const cur   = next[k];
                const patch = {};
                for (const [key, val] of Object.entries(fillValues)) {
                    if (!val && val !== false) continue;
                    if (overwrite || !cur[key]) patch[key] = val;
                }
                if (Object.keys(patch).length) next[k] = { ...cur, ...patch };
            }
            return next;
        });
    };

    const setCellValue = (k, colKey, val) => {
        setRowData(prev => ({
            ...prev,
            [k]: { ...(prev[k] || {}), [colKey]: val },
        }));
    };

    const header = (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{title}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {formName && hidableColumns.length > 0 && (
                        <button
                            onClick={() => setFilterOpen(true)}
                            title="Column settings"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px',
                                cursor: 'pointer', fontSize: '13px', background: 'white', color: '#333',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>tune</span>
                            Columns
                        </button>
                    )}
                    {showImportButton && (
                        <button style={{
                            padding: '5px 12px', border: '1px solid #ccc', borderRadius: '4px',
                            cursor: 'pointer', fontSize: '13px',
                        }}>
                            Import
                        </button>
                    )}
                </div>
            </div>
            {headerContent && <div style={{ marginTop: '6px' }}>{headerContent}</div>}
        </div>
    );

    if (loading) {
        return (
            <div className="bubble-container">
                {header}
                <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (error && rows.length === 0) {
        return (
            <div className="bubble-container">
                {header}
                <div style={{ padding: '12px', color: '#dc3545', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span>{error}</span>
                    {onRetry && (
                        <button onClick={onRetry} style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px' }}>
                            Retry
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bubble-container">
            {header}

            {prefillFields && (
                <PrefillPanel fields={prefillFields} onApply={handlePrefillValues} />
            )}

            {savedCount != null && (
                <div style={{
                    padding: '8px 12px', backgroundColor: '#d4edda', color: '#155724',
                    borderRadius: '4px', fontSize: '13px', marginBottom: '10px', border: '1px solid #c3e6cb',
                }}>
                    {savedCount} record{savedCount !== 1 ? 's' : ''} saved.
                </div>
            )}

            {submitError && (
                <div style={{
                    padding: '8px 12px', backgroundColor: '#f8d7da', color: '#721c24',
                    borderRadius: '4px', fontSize: '13px', marginBottom: '10px', border: '1px solid #f5c6cb',
                }}>
                    {submitError}
                </div>
            )}

            {/* Table always renders so column headers are visible even with no rows */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                    <thead>
                        <tr>
                            {visibleColumns.map(col => (
                                <th
                                    key={col.key}
                                    style={{
                                        ...(col.required ? REQUIRED_TH_STYLE : TH_STYLE),
                                        ...(col.thStyle || {}),
                                    }}
                                >
                                    {col.label}
                                </th>
                            ))}
                            {onDelete && (
                                <th style={{ ...TH_STYLE, width: '32px', padding: '4px', textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteMode(m => !m)}
                                        title={deleteMode ? 'Done' : 'Delete rows'}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center',
                                            background: deleteMode ? '#e3f2fd' : 'none',
                                            border: deleteMode ? '1px solid #90caf9' : '1px solid transparent',
                                            borderRadius: '4px', padding: '2px 4px',
                                            cursor: 'pointer', color: deleteMode ? '#1976d2' : '#888',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { if (!deleteMode) { e.currentTarget.style.backgroundColor = '#f5f5f5'; e.currentTarget.style.color = '#333'; }}}
                                        onMouseLeave={e => { if (!deleteMode) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888'; }}}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                                            {deleteMode ? 'check' : 'edit'}
                                        </span>
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={visibleColumns.length}
                                    style={{ padding: '16px', color: '#888', fontStyle: 'italic', fontSize: '13px' }}
                                >
                                    No records to display.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, i) => {
                                const k  = rowKey(row);
                                const bg = i % 2 === 0 ? 'white' : '#fafbfc';
                                return (
                                    <tr key={k} style={{ backgroundColor: bg }}>
                                        {visibleColumns.map(col => {
                                            const tdStyle = { ...TD_STYLE, ...(col.tdStyle || {}) };

                                            if (col.render) {
                                                return (
                                                    <td key={col.key} style={tdStyle}>
                                                        {col.render(row)}
                                                    </td>
                                                );
                                            }

                                            if (isInput(col.type)) {
                                                return (
                                                    <td key={col.key} style={tdStyle}>
                                                        <InputCell
                                                            column={col}
                                                            value={(rowData[k] || {})[col.key]}
                                                            onChange={val => setCellValue(k, col.key, val)}
                                                        />
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={col.key} style={{ ...tdStyle, ...(col.display === 'bold' ? { fontWeight: '600' } : {}) }}>
                                                    {row[col.key] ?? '—'}
                                                </td>
                                            );
                                        })}
                                        {onDelete && (
                                            <td style={{ ...TD_STYLE, width: '32px', padding: '4px', textAlign: 'center' }}>
                                                {deleteMode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget(row)}
                                                        title="Delete record"
                                                        style={{
                                                            background: 'none', border: 'none', padding: '2px 4px',
                                                            cursor: 'pointer', color: '#dc3545',
                                                            display: 'inline-flex', alignItems: 'center', borderRadius: '3px',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {rows.length > 0 && onSubmit && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                            <button
                                onClick={() => onSubmit(rows, rowData)}
                                disabled={submitting}
                                style={{
                                    padding: '9px 24px',
                                    backgroundColor: submitting ? '#aaa' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                }}
                            >
                                {submitting ? 'Saving...' : submitLabel}
                            </button>
                        </div>
                    )}

            {children}

            <PopupConfirm
                isOpen={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => { await onDelete?.(deleteTarget); setDeleteTarget(null); }}
                title="Delete Record"
                message="Delete this record? This cannot be undone."
                confirmText="Delete"
            />

            {/* Column visibility settings popup */}
            <Popup
                isOpen={filterOpen}
                onClose={() => setFilterOpen(false)}
                title="Column Settings"
                width={340}
            >
                <div>
                    <p>
                        Choose which optional columns are visible to you in this form.
                    </p>
                    <p><b>Note:</b> This does not change the actual record, this only changes what you are able to see</p>
                    {hidableColumns.map((col, i) => {
                        const visible = colVisibility[col.key] !== false;
                        return (
                            <label
                                key={col.key}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '9px 4px', cursor: 'pointer',
                                    borderBottom: i < hidableColumns.length - 1 ? '1px solid #f0f0f0' : 'none',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={visible}
                                    onChange={() => toggleColumn(col.key)}
                                    style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <span style={{ fontSize: '14px', color: '#333' }}>
                                    {col.label.replace(' *', '')}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </Popup>
        </div>
    );
}

export default Form;