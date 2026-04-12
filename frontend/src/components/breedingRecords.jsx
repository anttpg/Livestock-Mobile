import React, { useState, useEffect, useCallback } from 'react';
import Minimap from './minimap';
import PopupConfirm from './popupConfirm';
import AnimalCombobox from './animalCombobox';
import AnimalTableSelector from './animalTableSelector';
import { toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';

// ─── Status colour maps ───────────────────────────────────────────────────────

const STATUS_COLOR = {
    Active:   '#1976d2',
    Open:     '#e65100',
    Pregnant: '#2e7d32',
    Calved:   '#00695c',
    Voided:   '#757575',
};

const STATUS_BG = {
    Active:   '#e3f2fd',
    Open:     '#fff3e0',
    Pregnant: '#e8f5e9',
    Calved:   '#e0f2f1',
    Voided:   '#f5f5f5',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupIntoExposures(records) {
    const groups = {};
    for (const record of records) {
        const key = [
            (record.ExposureStartDate ?? '').split('T')[0].split(' ')[0],
            (record.ExposureEndDate   ?? '').split('T')[0].split(' ')[0],
            JSON.stringify(record.PrimaryBulls ?? []),
            JSON.stringify(record.CleanupBulls ?? []),
            record.Pasture ?? ''
        ].join('||');
        if (!groups[key]) {
            groups[key] = {
                key,
                isAI:              record.IsAI ?? false,
                exposureStartDate: record.ExposureStartDate,
                exposureEndDate:   record.ExposureEndDate,
                primaryBulls:      record.PrimaryBulls ?? [],
                cleanupBulls:      record.CleanupBulls ?? [],
                pasture:           record.Pasture      ?? '',
                records:           []
            };
        }
        groups[key].records.push(record);
    }
    return Object.values(groups);
}


function sectionLabel(text) {
    return (
        <div style={{
            fontSize: '11px', fontWeight: 'bold', color: '#777',
            textTransform: 'uppercase', marginBottom: '4px'
        }}>
            {text}
        </div>
    );
}

// ─── BullTag ──────────────────────────────────────────────────────────────────

function BullTag({ tag, onRemove }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            backgroundColor: '#e3f2fd', border: '1px solid #90caf9',
            borderRadius: '12px', padding: '2px 8px', fontSize: '13px'
        }}>
            {tag}
            {onRemove && (
                <button
                    onClick={() => onRemove(tag)}
                    style={{
                        background: 'none', border: 'none', padding: '0 1px',
                        cursor: 'pointer', color: '#dc3545', display: 'flex', alignItems: 'center'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                </button>
            )}
        </span>
    );
}

// ─── BullInput ────────────────────────────────────────────────────────────────

function BullInput({ label, bulls, bullOptions = [], onChange }) {
    const [val, setVal] = useState('');

    const add = (tagOverride) => {
        const tag = (tagOverride !== undefined ? tagOverride : val).trim().toUpperCase();
        if (tag && !bulls.find(b => b.tag === tag)) onChange([...bulls, { tag }]);
        setVal('');
    };

    return (
        <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>
                {label}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px', minHeight: '0px' }}>
                {bulls.map(b => (
                    <BullTag
                        key={b.tag}
                        tag={b.tag}
                        onRemove={(t) => onChange(bulls.filter(x => x.tag !== t))}
                    />
                ))}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
                <div style={{ flex: 1 }}>
                    <AnimalCombobox
                        options={bullOptions}
                        value={val}
                        onChange={setVal}
                        onSelect={(v) => { if (v) add(v); }}
                        placeholder="Search bull tag..."
                        allowCustomValue={true}
                        style={{ fontSize: '13px' }}
                    />
                </div>
                <button
                    onClick={() => add()}
                    style={{
                        padding: '5px 10px', backgroundColor: '#1976d2', color: 'white',
                        border: 'none', borderRadius: '3px', cursor: 'pointer',
                        fontSize: '13px', flexShrink: 0
                    }}
                >
                    Add
                </button>
            </div>
        </div>
    );
}

// ─── BullDisplay ──────────────────────────────────────────────────────────────

function BullDisplay({ label, bulls }) {
    return (
        <div style={{ marginBottom: '8px' }}>
            {sectionLabel(label)}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '22px' }}>
                {bulls.length > 0
                    ? bulls.map(b => <BullTag key={b.tag} tag={b.tag} />)
                    : <span style={{ fontSize: '13px', color: '#aaa' }}>—</span>
                }
            </div>
        </div>
    );
}

// ─── AddExposureBubble ────────────────────────────────────────────────────────

function AddExposureBubble({ planId, allAnimals, activeAnimals, bullOptions, assignedCowTags, onRefresh }) {
    const today      = toLocalInput(new Date().toISOString());
    const defaultEnd = toLocalInput(new Date(Date.now() + 45 * 86400000).toISOString());

    const [isAI,              setIsAI]              = useState(false);
    const [exposureDate,      setExposureDate]      = useState(today);
    const [startDate,         setStartDate]         = useState(today);
    const [endDate,           setEndDate]           = useState(defaultEnd);
    const [primaryBulls,      setPrimaryBulls]      = useState([]);
    const [cleanupBulls,      setCleanupBulls]      = useState([]);
    const [selectedPasture,   setSelectedPasture]   = useState('');
    const [availablePastures, setAvailablePastures] = useState([]);
    const [selectedCows,      setSelectedCows]      = useState(new Set());
    const [activeOnly,        setActiveOnly]        = useState(true);
    const [unassignedOnly,    setUnassignedOnly]    = useState(false);
    const [saving,            setSaving]            = useState(false);

    useEffect(() => {
        fetch('/api/pastures', { credentials: 'include' })
            .then(r => r.ok ? r.json() : { pastures: [] })
            .then(d => setAvailablePastures(d.pastures || []))
            .catch(() => {});
    }, []);

    const baseAnimals = activeOnly ? (activeAnimals || []) : (allAnimals || []);
    const animals = unassignedOnly
        ? baseAnimals.filter(a => !assignedCowTags.has(a.CowTag))
        : baseAnimals;

    const handleSubmit = async () => {
        if (selectedCows.size === 0 || primaryBulls.length === 0) {
            alert('Select at least one cow and one primary bull');
            return;
        }
        setSaving(true);
        try {
            const records = Array.from(selectedCows).map(cowTag => ({
                planID:            planId,
                cowTag,
                primaryBulls,
                cleanupBulls,
                isAI,
                exposureStartDate: toUTC(isAI ? exposureDate : startDate),
                exposureEndDate:   toUTC(isAI ? exposureDate : endDate),
                pasture:           isAI ? null : (selectedPasture || null),
                breedingStatus:    'Active',
            }));
            await fetch('/api/breeding-records', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify(records)
            });
            setSelectedCows(new Set());
            setPrimaryBulls([]);
            setCleanupBulls([]);
            setSelectedPasture('');
            setIsAI(false);
            setExposureDate(today);
            setStartDate(today);
            setEndDate(defaultEnd);
            onRefresh();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const canSubmit = selectedCows.size > 0 && primaryBulls.length > 0 && !saving;

    return (
        <div className="bubble-container" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>Add Exposure</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                {/* Left — exposure details */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                        <input type="checkbox" checked={isAI} onChange={(e) => setIsAI(e.target.checked)} />
                        Artifical Insemination
                    </label>

                    {isAI ? (
                        <>
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>Insemination Date</label>
                                <input
                                    type="date" value={exposureDate} onChange={(e) => setExposureDate(e.target.value)}
                                    style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>

                            <BullInput label="Insemination Source" bulls={primaryBulls} bullOptions={bullOptions} onChange={setPrimaryBulls} />
                            <BullInput label="Cleanup Bulls"       bulls={cleanupBulls} bullOptions={bullOptions} onChange={setCleanupBulls} />
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>Start Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                        style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>End Date</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                        style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', fontSize: '13px' }}>Pasture</label>
                                <select
                                    value={selectedPasture}
                                    onChange={(e) => setSelectedPasture(e.target.value)}
                                    style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                                >
                                    <option value="">Select pasture...</option>
                                    {availablePastures.map((p, i) => <option key={i} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <BullInput label="Primary Bulls" bulls={primaryBulls} bullOptions={bullOptions} onChange={setPrimaryBulls} />
                        </>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        style={{
                            marginTop: '8px', width: '100%', padding: '9px',
                            backgroundColor: canSubmit ? '#2e7d32' : '#aaa',
                            color: 'white', border: 'none', borderRadius: '4px',
                            fontSize: '14px', fontWeight: 'bold',
                            cursor: canSubmit ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {saving ? 'Saving...' : `Create Exposure  (${selectedCows.size} cow${selectedCows.size !== 1 ? 's' : ''})`}
                    </button>
                </div>

                {/* Right — cow selector */}
                <div>
                    <AnimalTableSelector
                        animals={animals}
                        selected={selectedCows}
                        onChange={setSelectedCows}
                        maxHeight="320px"
                        label="Select Cows"
                        extraControls={
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
                                    Unassigned only
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                                    Active only
                                </label>
                            </div>
                        }
                    />
                </div>
            </div>
        </div>
    );
}

// ─── ExposureBubble ───────────────────────────────────────────────────────────

function ExposureBubble({ group, bullOptions, onRefresh }) {
    const [editMode,        setEditMode]        = useState(false);
    const [primaryBulls,    setPrimaryBulls]    = useState(group.primaryBulls);
    const [cleanupBulls,    setCleanupBulls]    = useState(group.cleanupBulls);
    const [startDate,       setStartDate]       = useState(toLocalInput(group.exposureStartDate) ?? '');
    const [endDate,         setEndDate]         = useState(toLocalInput(group.exposureEndDate)   ?? '');
    const [saving,          setSaving]          = useState(false);
    const [cowToDelete,     setCowToDelete]     = useState(null);
    const [deleteCowOpen,   setDeleteCowOpen]   = useState(false);
    const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);

    const isAI = group.isAI;

    const patchAll = useCallback(async (patch) => {
        setSaving(true);
        try {
            await Promise.all(group.records.map(r =>
                fetch(`/api/breeding-records/${r.ID}`, {
                    method:      'PUT',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body:        JSON.stringify(patch),
                })
            ));
            onRefresh();
        } finally {
            setSaving(false);
        }
    }, [group.records, onRefresh]);

    const handleBullsBlur = () => {
        patchAll({ PrimaryBulls: primaryBulls, CleanupBulls: cleanupBulls });
    };

    const handleDateBlur = () => {
        patchAll({ ExposureStartDate: toUTC(startDate) || null, ExposureEndDate: toUTC(endDate) || null });
    };

    const handleDeleteCow = async () => {
        if (!cowToDelete) return;
        await fetch(`/api/breeding-records/${cowToDelete.ID}`, {
            method:      'DELETE',
            credentials: 'include',
        });
        setDeleteCowOpen(false);
        setCowToDelete(null);
        onRefresh();
    };

    const handleDeleteGroup = async () => {
        await Promise.all(group.records.map(r =>
            fetch(`/api/breeding-records/${r.ID}`, { method: 'DELETE', credentials: 'include' })
        ));
        setDeleteGroupOpen(false);
        onRefresh();
    };

    const bullSummary = [...primaryBulls, ...cleanupBulls].map(b => b.tag).join(', ') || '—';

    // ── Display (read-only) content ──────────────────────────────────────────

    const displayContent = isAI ? (
        <>
            <div style={{ marginBottom: '8px' }}>
                {sectionLabel('Insemination Date')}
                <div style={{ fontSize: '13px' }}>{toLocalDisplay(group.exposureStartDate)}</div>
            </div>
            <BullDisplay label="Insemination Source" bulls={primaryBulls} />
            <BullDisplay label="Cleanup Bulls"       bulls={cleanupBulls} />
        </>
    ) : (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                    {sectionLabel('Start Date')}
                    <div style={{ fontSize: '13px' }}>{toLocalDisplay(group.exposureStartDate)}</div>
                </div>
                <div>
                    {sectionLabel('End Date')}
                    <div style={{ fontSize: '13px' }}>{toLocalDisplay(group.exposureEndDate)}</div>
                </div>
            </div>
            {group.pasture && (
                <div style={{ marginBottom: '8px' }}>
                    {sectionLabel('Pasture')}
                    <div style={{ fontSize: '13px' }}>{group.pasture}</div>
                </div>
            )}
            <BullDisplay label="Primary Bulls" bulls={primaryBulls} />
            {group.pasture && (
                <div style={{ height: '150px', borderRadius: '5px', overflow: 'hidden', marginTop: '8px' }}>
                    <Minimap pastureName={group.pasture} />
                </div>
            )}
        </>
    );

    // ── Edit content ─────────────────────────────────────────────────────────

    const editContent = isAI ? (
        <div onBlur={handleBullsBlur}>
            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>
                    Insemination Date
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    onBlur={handleDateBlur}
                    style={{ padding: '5px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                />
            </div>
            <BullInput label="Insemination Source" bulls={primaryBulls} bullOptions={bullOptions} onChange={setPrimaryBulls} />
            <BullInput label="Cleanup Bulls"       bulls={cleanupBulls} bullOptions={bullOptions} onChange={setCleanupBulls} />
            {saving && <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Saving...</div>}
        </div>
    ) : (
        <>
            <div onBlur={handleBullsBlur}>
                <BullInput label="Primary Bulls" bulls={primaryBulls} bullOptions={bullOptions} onChange={setPrimaryBulls} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                    {sectionLabel('Start')}
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        onBlur={handleDateBlur}
                        style={{ padding: '5px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    {sectionLabel('End')}
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        onBlur={handleDateBlur}
                        style={{ padding: '5px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
            </div>
            {group.pasture && (
                <div style={{ height: '150px', borderRadius: '5px', overflow: 'hidden' }}>
                    <Minimap pastureName={group.pasture} />
                </div>
            )}
            {saving && <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Saving...</div>}
        </>
    );

    return (
        <div className="bubble-container" style={{ marginBottom: '12px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600' }}>
                        {isAI
                            ? toLocalDisplay(group.exposureStartDate)
                            : `${toLocalDisplay(group.exposureStartDate)} – ${toLocalDisplay(group.exposureEndDate)}`
                        }
                        {isAI && (
                            <span style={{
                                marginLeft: '8px', fontSize: '11px', fontWeight: 'normal',
                                backgroundColor: '#e8eaf6', color: '#3949ab',
                                border: '1px solid #9fa8da', borderRadius: '10px',
                                padding: '1px 8px', verticalAlign: 'middle'
                            }}>
                                AI
                            </span>
                        )}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        {group.records.length} cow{group.records.length !== 1 ? 's' : ''} · {bullSummary}
                        {group.pasture ? ` · ${group.pasture}` : ''}
                    </div>
                </div>
                <button
                    onClick={() => setDeleteGroupOpen(true)}
                    style={{
                        background: 'none', border: '1px solid #dc3545', color: '#dc3545',
                        borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px'
                    }}
                >
                    Delete
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Left — details panel */}
                <div>
                    {/* Panel header with edit toggle */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e8eef3'
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#777', textTransform: 'uppercase' }}>
                            {isAI ? 'Artificial Insemination' : 'Exposure Details'}
                        </span>
                        <button
                            onClick={() => setEditMode(m => !m)}
                            title={editMode ? 'Done editing' : 'Edit'}
                            style={{
                                display: 'flex', alignItems: 'center',
                                background: editMode ? '#e3f2fd' : 'none',
                                border: editMode ? '1px solid #90caf9' : '1px solid transparent',
                                borderRadius: '4px', padding: '2px 4px',
                                cursor: 'pointer', color: editMode ? '#1976d2' : '#888',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { if (!editMode) { e.currentTarget.style.backgroundColor = '#f5f5f5'; e.currentTarget.style.color = '#333'; }}}
                            onMouseLeave={e => { if (!editMode) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888'; }}}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                                {editMode ? 'check' : 'edit'}
                            </span>
                        </button>
                    </div>

                    {editMode ? editContent : displayContent}
                </div>

                {/* Right — exposed cow list */}
                <div>
                    {sectionLabel('Exposed Cows')}
                    <div style={{ overflowY: 'auto', maxHeight: '20rem' }}>
                        {group.records.map((record, idx) => (
                            <div
                                key={record.ID}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '5px 6px', borderBottom: '1px solid #e8eef3', fontSize: '13px',
                                    backgroundColor: idx % 2 === 0 ? 'white' : '#eef3f7'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 'bold' }}>{record.CowTag}</span>
                                    {record.BreedingStatus && record.BreedingStatus !== 'Active' && (
                                        <span style={{
                                            fontSize: '11px', padding: '1px 6px', borderRadius: '8px',
                                            backgroundColor: STATUS_BG[record.BreedingStatus]  || '#e9ecef',
                                            color:           STATUS_COLOR[record.BreedingStatus] || '#495057',
                                            border: `1px solid ${STATUS_COLOR[record.BreedingStatus] || '#dee2e6'}33`
                                        }}>
                                            {record.BreedingStatus}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setCowToDelete(record); setDeleteCowOpen(true); }}
                                    title="Remove from exposure"
                                    style={{
                                        flexShrink: 0, background: 'none', border: 'none',
                                        padding: '2px', cursor: 'pointer', color: '#dc3545',
                                        display: 'flex', alignItems: 'center', borderRadius: '3px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <PopupConfirm
                isOpen={deleteCowOpen}
                onClose={() => { setDeleteCowOpen(false); setCowToDelete(null); }}
                onConfirm={handleDeleteCow}
                title="Remove Cow"
                message={`Remove <strong>${cowToDelete?.CowTag}</strong> from this exposure?`}
                confirmText="Remove"
            />

            <PopupConfirm
                isOpen={deleteGroupOpen}
                onClose={() => setDeleteGroupOpen(false)}
                onConfirm={handleDeleteGroup}
                title="Delete Exposure"
                message={`Delete this entire exposure? This will remove all <strong>${group.records.length}</strong> breeding ${group.records.length === 1 ? 'record' : 'records'}.<br/><br/><span style="color:#dc3545;font-weight:bold">This cannot be undone.</span>`}
                confirmText="Delete Exposure"
                requireDelay={true}
                delaySeconds={3}
            />
        </div>
    );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function BreedingRecords({ planId, isCurrentMode }) {
    const [breedingRecords, setBreedingRecords] = useState([]);
    const [allAnimals,      setAllAnimals]      = useState([]);
    const [activeAnimals,   setActiveAnimals]   = useState([]);
    const [bulls,           setBulls]           = useState([]);
    const [assignedTags,    setAssignedTags]    = useState(new Set());
    const [loading,         setLoading]         = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [allRes, activeRes, statusRes] = await Promise.all([
                fetch('/api/animals',                { credentials: 'include' }),
                fetch('/api/animals/active',         { credentials: 'include' }),
                fetch('/api/bulls', { credentials: 'include' }),
            ]);

            const [allData, activeData, statusData] = await Promise.all([
                allRes.ok    ? allRes.json()    : { cows: [] },
                activeRes.ok ? activeRes.json() : { cows: [] },
                statusRes.ok ? statusRes.json() : { bulls: [] },
            ]);

            setAllAnimals(allData.cows    || []);
            setActiveAnimals(activeData.cows || []);
            setBulls(statusData.bulls     || []);

            if (!isCurrentMode && planId) {
                const ovRes = await fetch(`/api/breeding-plans/${planId}/overview`, { credentials: 'include' });
                if (ovRes.ok) {
                    const data = await ovRes.json();
                    setBreedingRecords(data.breedingRecords   || []);
                    setAssignedTags(new Set((data.assignedAnimals || []).map(a => a.cowTag)));
                }
            } else {
                setBreedingRecords([]);
                setAssignedTags(new Set());
            }
        } catch (e) {
            console.error('BreedingRecords fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [planId, isCurrentMode]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const bullOptions = bulls.map(b => ({
        name:   b.CowTag,
        value:  b.CowTag,
        status: b.Status || 'Current',
    }));

    const exposureGroups = groupIntoExposures(breedingRecords);

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                Loading...
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <AddExposureBubble
                planId={isCurrentMode ? null : planId}
                allAnimals={allAnimals}
                activeAnimals={activeAnimals}
                bullOptions={bullOptions}
                assignedCowTags={assignedTags}
                onRefresh={fetchData}
            />

            {!isCurrentMode && exposureGroups.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                    No exposure records for this plan yet.
                </div>
            )}

            {!isCurrentMode && exposureGroups.map(group => (
                <ExposureBubble
                    key={group.key}
                    group={group}
                    bullOptions={bullOptions}
                    onRefresh={fetchData}
                />
            ))}
        </div>
    );
}

export default BreedingRecords;