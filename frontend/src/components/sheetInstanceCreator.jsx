import React, { useState, useEffect } from 'react';
import Popup from './popup';
import SelectMedicine from './selectMedicine';
import SubmitHerdAnimals from './submitHerdAnimals';

//  Visual constants (mirrors SheetTemplateEditor) 

const SOURCE_META = {
    CowTable:      { label: 'CowTable',       bg: '#e3f2fd', border: '#90caf9' },
    PregancyCheck: { label: 'Preg Check',     bg: '#e8f5e9', border: '#a5d6a7' },
    WeightRecords: { label: 'Weight Record',  bg: '#fff3e0', border: '#ffcc80' },
    MedicalTable:  { label: 'Medical / Vaxx', bg: '#fce4ec', border: '#f48fb1' },
};

const TYPE_COLORS = {
    text:      '#607d8b',
    select:    '#7b1fa2',
    date:      '#1565c0',
    number:    '#2e7d32',
    boolean:   '#e65100',
    reference: '#795548',
};

//  Atoms 

function TypeBadge({ type }) {
    return (
        <span style={{
            fontSize: '10px', fontWeight: 'bold', padding: '1px 5px',
            borderRadius: '3px', backgroundColor: TYPE_COLORS[type] || '#aaa',
            color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px',
            whiteSpace: 'nowrap', flexShrink: 0,
            minWidth: '58px', textAlign: 'center', boxSizing: 'border-box',
            display: 'inline-block',
        }}>
            {type}
        </span>
    );
}

//  Helpers 

/**
 * A MedicalTable slot is "select-on-creation" when:
 *   - no medicine is pinned at the template level
 *   - the slot does NOT have a TreatmentMedicine picker field
 * In this case we ask the user to choose the medicine at instance-creation time.
 */
const isSelectOnCreation = (col) =>
    col.source === 'MedicalTable' &&
    !col.medicine &&
    !col.medicineFilter &&
    !col.fields?.some(f => f.key === 'TreatmentMedicine');

/**
 * Builds the initial defaults map from resolved columns.
 * Shape: { [recordSlot]: { [fieldKey]: defaultValue, _medicine?: '' } }
 */
function buildDefaults(columns) {
    const d = {};
    for (const col of columns) {
        if (col.storage !== 'record') continue;
        d[col.recordSlot] = {};

        if (isSelectOnCreation(col)) {
            d[col.recordSlot]._medicine = '';
        }

        for (const field of (col.fields || []).filter(f => !f.hidden)) {
            switch (field.type) {
                case 'select':  d[col.recordSlot][field.key] = null;                    break;
                case 'boolean': d[col.recordSlot][field.key] = false;                   break;
                // Default to now — full ISO datetime including time & timezone offset
                case 'date':    d[col.recordSlot][field.key] = new Date().toISOString(); break;
                default:        d[col.recordSlot][field.key] = null;                    break;
            }
        }
    }
    return d;
}

//  Main component 

/**
 * @param {{ isOpen: boolean, onClose: () => void, onCreated: (data: object) => void }} props
 */
function SheetInstanceCreator({ isOpen, onClose, onCreated }) {

    const [instanceName,    setInstanceName]    = useState('');
    const [templateId,      setTemplateId]      = useState('');
    const [herd,            setHerd]            = useState('');
    const [templates,       setTemplates]       = useState([]);
    const [herds,           setHerds]           = useState([]);
    const [resolvedColumns, setResolvedColumns] = useState([]);
    const [defaults,        setDefaults]        = useState({});
    const [loading,         setLoading]         = useState(false);
    const [loadingCols,     setLoadingCols]     = useState(false);
    const [showAnimalSelector, setShowAnimalSelector] = useState(false);

    // Primary record date — user-editable, stored as UTC ISO string
    const [primaryRecordDate, setPrimaryRecordDate] = useState(new Date().toISOString());

    // Helpers for datetime-local <-> UTC conversion
    const toLocalInput = (utcStr) => {
        if (!utcStr) return '';
        const d = new Date(utcStr);
        return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    const toUTC = (localStr) => localStr ? new Date(localStr).toISOString() : null;

    //  Reset & seed on open 
    useEffect(() => {
        if (!isOpen) return;
        setPrimaryRecordDate(new Date().toISOString());
        setTemplateId('');
        setHerd('');
        setShowAnimalSelector(false);
        setResolvedColumns([]);
        setDefaults({});
        fetchTemplates();
        fetchHerds();
    }, [isOpen]);

    //  Load columns whenever template selection changes 
    useEffect(() => {
        if (!templateId) { setResolvedColumns([]); setDefaults({}); return; }
        loadTemplateColumns(templateId);
    }, [templateId]);

    //  Data fetchers 

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/sheets/all-sheets', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setTemplates((data.sheets || []).map(s => ({ id: s.ID, name: s.SheetName })));
            }
        } catch (e) { console.error('Error fetching templates:', e); }
    };

    const fetchHerds = async () => {
        try {
            const res = await fetch('/api/herds', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setHerds((data.herds || []).map(h => ({ id: h.herdID, name: h.herdName })));
            }
        } catch (e) { console.error('Error fetching herds:', e); }
    };


    const loadTemplateColumns = async (id) => {
        setLoadingCols(true);
        setResolvedColumns([]);
        setDefaults({});
        try {
            const res = await fetch(`/api/sheets/${id}/preview-columns`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const cols = Array.isArray(data) ? data : (data.columns || []);
                setResolvedColumns(cols);
                setDefaults(buildDefaults(cols));
            }
        } catch (e) { console.error('Error loading template columns:', e); }
        finally { setLoadingCols(false); }
    };

    const handleHerdChange = (e) => {
        setHerd(e.target.value);
    };

    //  Default mutation 

    const setFieldDefault = (slot, key, value) =>        setDefaults(prev => ({ ...prev, [slot]: { ...prev[slot], [key]: value } }));

    //  Create 

    const handleCreate = () => {
        if (!templateId || !herd || !instanceName.trim()) return;
        setShowAnimalSelector(true);
    };

    const handleCreateWithAnimals = async (animals) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sheets/${templateId}/instances/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    instanceName: instanceName.trim(),
                    herdName:     herd,
                    primaryRecordDate,
                    defaults,
                    animals,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setShowAnimalSelector(false);
                onCreated?.(data);
                onClose();
            } else {
                alert('Failed to create instance');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating instance');
        } finally {
            setLoading(false);
        }
    };

    //  Renderers 

    const renderFieldDefault = (slot, field) => {
        const value = defaults[slot]?.[field.key];

        let input;

        if (field.type === 'select') {
            input = (
                <select
                    value={value ?? ''}
                    onChange={e => setFieldDefault(slot, field.key, e.target.value || null)}
                    style={inputStyle}
                >
                    <option value=''>-- None --</option>
                    {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            );

        } else if (field.type === 'boolean') {
            input = (
                <select
                    value={String(value ?? false)}
                    onChange={e => setFieldDefault(slot, field.key, e.target.value === 'true')}
                    style={inputStyle}
                >
                    <option value='false'>False</option>
                    <option value='true'>True</option>
                </select>
            );

        } else if (field.type === 'date') {
            /**
             * datetime-local input shows local date+time to the user.
             * On change, new Date(value) interprets it as local time, then
             * toISOString() converts to UTC — preserving the true moment in time.
             * The initial default is new Date().toISOString() (set in buildDefaults).
             */
            const localVal = value ? (() => {
                const d = new Date(value);
                const offset = d.getTimezoneOffset() * 60000;
                return new Date(d - offset).toISOString().slice(0, 16);
            })() : '';
            input = (
                <input
                    type='datetime-local'
                    value={localVal}
                    onChange={e => {
                        if (!e.target.value) { setFieldDefault(slot, field.key, null); return; }
                        setFieldDefault(slot, field.key, new Date(e.target.value).toISOString());
                    }}
                    style={inputStyle}
                />
            );

        } else if (field.type === 'number') {
            input = (
                <input
                    type='number'
                    value={value ?? ''}
                    placeholder='No default'
                    onChange={e => setFieldDefault(
                        slot, field.key,
                        e.target.value === '' ? null : Number(e.target.value)
                    )}
                    style={inputStyle}
                />
            );

        } else {
            // text / reference / inline — sourced from animal record, not configurable here
            input = (
                <span style={{ flex: 1, fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>
                    filled from animal record
                </span>
            );
        }

        return (
            <div key={field.key} style={fieldRowStyle}>
                <span style={{ fontSize: '13px', minWidth: '130px', flexShrink: 0 }}>{field.name}</span>
                <TypeBadge type={field.type} />
                {input}
            </div>
        );
    };

    const renderRecordSlot = (col) => {
        const sm          = SOURCE_META[col.source];
        const slotDefaults = defaults[col.recordSlot] || {};
        const selectOnCreate = isSelectOnCreation(col);

        return (
            <div key={col.recordSlot} style={{
                border:          `1px solid ${sm?.border || '#ccc'}`,
                borderRadius:    '4px',
                backgroundColor: 'white',
            }}>
                {/* Slot header */}
                <div style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '8px',
                    padding:         '7px 10px',
                    backgroundColor: sm?.bg || '#f5f5f5',
                    borderBottom:    `1px solid ${sm?.border || '#eee'}`,
                }}>
                    <span style={{ flex: 1, fontWeight: 'bold', fontSize: '14px' }}>{col.name}</span>
                    <span style={{ fontSize: '11px', color: '#666', backgroundColor: 'white', padding: '1px 6px', borderRadius: '3px', border: '1px solid #ddd' }}>
                        {sm?.label || col.source}
                    </span>
                    <span style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>{col.recordSlot}</span>
                </div>

                {/* Fields */}
                <div style={{ padding: '8px 10px 10px 30px', display: 'flex', flexDirection: 'column', gap: '4px' }}>

                    {/* Medicine selector for select-on-creation slots */}
                    {selectOnCreate && (
                        <div style={{
                            display:         'flex',
                            alignItems:      'center',
                            gap:             '8px',
                            padding:         '6px 8px',
                            backgroundColor: '#fff8e1',
                            border:          '1px solid #ffe082',
                            borderRadius:    '3px',
                            marginBottom:    '2px',
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '130px', flexShrink: 0 }}>Medicine</span>
                            <span style={{
                                fontSize: '10px', fontWeight: 'bold', padding: '1px 5px',
                                borderRadius: '3px', backgroundColor: '#f57f17',
                                color: 'white', minWidth: '58px', textAlign: 'center',
                                flexShrink: 0,
                            }}>
                                REQUIRED
                            </span>
                            <div style={{ flex: 1 }}>
                                <SelectMedicine
                                    value={slotDefaults._medicine || ''}
                                    onChange={(id) => setFieldDefault(col.recordSlot, '_medicine', id)}
                                />
                            </div>
                        </div>
                    )}

                    {col.fields?.filter(f => !f.hidden).map(field => renderFieldDefault(col.recordSlot, field))}
                </div>
            </div>
        );
    };

    //  Derived 

    const recordCols   = resolvedColumns.filter(c => c.storage === 'record');
    const snapshotCount = resolvedColumns.filter(c => c.storage !== 'record').length;

    const selectOnCreationSlots = recordCols.filter(col => isSelectOnCreation(col));
    const allMedicinesSelected = selectOnCreationSlots.every(col => !!defaults[col.recordSlot]?._medicine);

    const canCreate = !!templateId && !!herd && !!instanceName.trim() && allMedicinesSelected;

    //  Shared styles 

    const inputStyle  = { flex: 1, padding: '3px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', backgroundColor: 'white' };
    const fieldRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', backgroundColor: '#f9f9f9', border: '1px solid #eee', borderRadius: '3px' };

    //  Render 

    return (
        <>
        <Popup
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Sheet Instance"
            maxWidth="820px"
            contentStyle={{ overflow: 'hidden', paddingBottom: '100px' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Row 1: Instance name + template selector */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Sheet Instance Name</label>
                        <input
                            type="text"
                            value={instanceName}
                            onChange={e => setInstanceName(e.target.value)}
                            placeholder="e.g. Spring 2026 Preg Check"
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Template</label>
                        <select
                            value={templateId}
                            onChange={e => setTemplateId(e.target.value)}
                            style={{ width: '95%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', backgroundColor: 'white' }}
                        >
                            <option value="">Select a template...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 2: Herd + breeding year */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Record Date</label>
                        <input
                            type="datetime-local"
                            value={toLocalInput(primaryRecordDate)}
                            onChange={e => setPrimaryRecordDate(toUTC(e.target.value))}
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Herd</label>
                        <select
                            value={herd}
                            onChange={handleHerdChange}
                            style={{ width: '95%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', backgroundColor: 'white' }}
                        >
                            <option value="">Select a herd...</option>
                            {herds.map(h => (
                                <option key={h.id} value={h.name}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Column / defaults viewer — only shown when a template is selected */}
                {templateId && (
                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f7f8fa', display: 'flex', flexDirection: 'column', maxHeight: '50vh' }}>

                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', fontWeight: 'bold', color: 'black', backgroundColor: '#f0f2f5', flexShrink: 0 }}>
                            Record Defaults
                        </div>

                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', overflowY: 'auto', flex: 1 }}>

                            {loadingCols && (
                                <div style={{ textAlign: 'center', color: '#aaa', padding: '24px', fontSize: '14px' }}>
                                    Loading template columns...
                                </div>
                            )}

                            {!loadingCols && snapshotCount > 0 && (
                                <div style={{ padding: '6px 10px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '3px', fontSize: '12px', color: '#1565c0' }}>
                                    {snapshotCount} snapshot / inline column{snapshotCount !== 1 ? 's' : ''} are filled from animal records and require no configuration.
                                </div>
                            )}

                            {!loadingCols && recordCols.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontSize: '13px' }}>
                                    This template has no record slots to configure.
                                </div>
                            )}

                            {!loadingCols && recordCols.map(col => renderRecordSlot(col))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="button"
                        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || !canCreate}
                        className="button"
                        style={{ padding: '10px 20px', opacity: (loading || !canCreate) ? 0.6 : 1, cursor: (loading || !canCreate) ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? 'Creating...' : 'Create Instance'}
                    </button>
                </div>

            </div>
        </Popup>

        {/* Animal selector — opens after form is filled, before creation */}
        <Popup
            isOpen={showAnimalSelector}
            onClose={() => setShowAnimalSelector(false)}
            title={`Select Animals — ${instanceName}`}
            maxWidth="560px"
            contentStyle={{ paddingBottom: '20px' }}
        >
            <SubmitHerdAnimals
                isOpen={showAnimalSelector}
                herdName={herd}
                loading={loading}
                onClose={() => setShowAnimalSelector(false)}
                onSubmit={handleCreateWithAnimals}
            />
        </Popup>
        </>
    );
}

const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' };

export default SheetInstanceCreator;