import React, { useState, useEffect, useRef } from 'react';

import { useUser } from '../UserContext';
import Popup from './popup';
import '../styles/formTables.css';

function defaultRowKey(r) {
    return r.ID != null ? String(r.ID) : String(r.CowTag);
}

// TableViewer — read-only table for viewing existing records.
//
// columns: Array of column descriptors:
//   { key, label }                              — renders row[key]
//   { key, label, render: (row) => JSX }        — custom render
//   { key, label, display: 'bold' }             — renders row[key] in bold
//   { key, label, ..., hidable: true }          — column can be toggled via column settings
//
// onEdit(row): if provided, shows a per-row pen icon that calls onEdit(row).
//   The caller owns all downstream behaviour (popup, confirm dialog, etc.).
//
// onAddRecord(): if provided, shows a "+ Add Record" button in the header.
//
// formName: string used to persist column visibility in user preferences.

function TableViewer({
    title,
    headerContent         = null,
    rows                  = [],
    columns               = [],
    rowKey                = defaultRowKey,
    loading               = false,
    error                 = null,
    onRetry               = null,
    formName              = null,
    onColVisibilityChange = null,
    onEdit                = null,
    onAddRecord           = null,
    children,
}) {
    const { user } = useUser();
    const [colVisibility, setColVisibility] = useState({});
    const [filterOpen,    setFilterOpen]    = useState(false);
    const cachedPrefs = useRef({});

    const username = user?.Username ?? user?.username ?? null;

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
        const currently = colVisibility[colKey] !== false;
        const newVis = { ...colVisibility, [colKey]: !currently };
        setColVisibility(newVis);
        saveVisibility(newVis);
        onColVisibilityChange?.(newVis);
    };

    const hidableColumns = columns.filter(c => c.hidable);

    const visibleColumns = columns.filter(c => {
        if (!c.hidable) return true;
        return colVisibility[c.key] !== false;
    });

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
                                border: '1px solid #ccc', borderRadius: '4px',
                                cursor: 'pointer', fontSize: '13px', background: 'white', color: '#333',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>tune</span>
                            Columns
                        </button>
                    )}
                    {onAddRecord && (
                        <button
                            type="button"
                            onClick={onAddRecord}
                            style={{
                                border: '1px solid #ccc', borderRadius: '4px',
                                cursor: 'pointer', fontSize: '13px',
                            }}
                        >
                            + Add Record
                        </button>
                    )}
                </div>
            </div>
            {headerContent && <div style={{ marginTop: '6px' }}>{headerContent}</div>}
        </div>
    );

    if (loading) {
        return (
            <div>
                {header}
                <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (error && rows.length === 0) {
        return (
            <div>
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
        <div>
            {header}

            <div style={{ overflowX: 'auto' }}>
                <table className='form-table'>
                    <thead>
                        <tr>
                            {visibleColumns.map(col => (
                                <th key={col.key} className="form-table-th" style={col.thStyle || undefined}>
                                    {col.label}
                                </th>
                            ))}
                            {onEdit && (
                                <th className="form-table-th" style={{ width: '32px', padding: '4px' }} />
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr style={{backgroundColor: 'white'}}>
                                <td
                                    colSpan={visibleColumns.length + (onEdit ? 1 : 0)}
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
                                            if (col.render) {
                                                return (
                                                    <td key={col.key} className="form-table-td" style={col.tdStyle || undefined}>
                                                        {col.render(row)}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td
                                                    key={col.key}
                                                    className="form-table-td"
                                                    style={{ ...(col.tdStyle || {}), ...(col.display === 'bold' ? { fontWeight: '600' } : {}) }}
                                                >
                                                    {row[col.key] ?? ''}
                                                </td>
                                            );
                                        })}
                                        {onEdit && (
                                            <td className="form-table-td" style={{ width: '32px', padding: '4px', textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(row)}
                                                    title="Edit record"
                                                    style={{
                                                        background: 'none', border: 'none', padding: '2px 4px',
                                                        cursor: 'pointer', color: '#888',
                                                        display: 'inline-flex', alignItems: 'center', borderRadius: '3px',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5f5f5'; e.currentTarget.style.color = '#333'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888'; }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {children}

            <Popup
                isOpen={filterOpen}
                onClose={() => setFilterOpen(false)}
                title="Column Settings"
                width={340}
            >
                <div>
                    <p>Choose which optional columns are visible to you in this table.</p>
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

export default TableViewer;