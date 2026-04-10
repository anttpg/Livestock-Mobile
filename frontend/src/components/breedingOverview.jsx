import React, { useState, useEffect, useCallback, useRef } from 'react';
import Minimap from './minimap';
import PopupConfirm from './popupConfirm';
import AnimalCombobox, { StatusBadge } from './animalCombobox';
import AnimalTableSelector from './animalTableSelector';
import Popup from './popup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupIntoExposures(breedingRecords) {
    const groups = {};
    for (const record of breedingRecords) {
        const key = [
            record.ExposureStartDate ?? '',
            record.ExposureEndDate ?? '',
            JSON.stringify(record.PrimaryBulls ?? []),
            JSON.stringify(record.CleanupBulls ?? []),
            record.Pasture ?? ''
        ].join('||');
        if (!groups[key]) {
            groups[key] = {
                key,
                exposureStartDate: record.ExposureStartDate,
                exposureEndDate:   record.ExposureEndDate,
                primaryBulls:      record.PrimaryBulls  ?? [],
                cleanupBulls:      record.CleanupBulls  ?? [],
                pasture:           record.Pasture       ?? '',
                records:           []
            };
        }
        groups[key].records.push(record);
    }
    return Object.values(groups);
}

function formatDate(d) {
    if (!d) return '?';
    return new Date(d).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// BullTag chip
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// BullInput (add/remove list of bull tags) — uses AnimalCombobox filtered to bulls
// ---------------------------------------------------------------------------

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                {bulls.map(b => (
                    <BullTag key={b.tag} tag={b.tag} onRemove={(t) => onChange(bulls.filter(x => x.tag !== t))} />
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
                        border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', flexShrink: 0
                    }}
                >
                    Add
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bubble 1 — Calving Alerts + Expected Births
// ---------------------------------------------------------------------------

function CalvingAlertsBubble({ calvingAlerts, expectedBirths, pregChecks, calvingRecords, planId, onRefresh }) {
    const [savingId,      setSavingId]      = useState(null);
    const [showAddAlert,  setShowAddAlert]  = useState(false);
    const [alertSelected, setAlertSelected] = useState(new Set());
    const [addingAlert,   setAddingAlert]   = useState(false);

    // Find best pregCheck for a cowTag (prefer one with CalvingAlert=true)
    const findPregCheck = (cowTag) => {
        const all = (pregChecks || []).filter(p => p.CowTag === cowTag);
        return all.find(p => p.CalvingAlert) ?? all[0] ?? null;
    };

    const toggleAlert = async (cowTag, currentlyOn) => {
        const pc = findPregCheck(cowTag);

        if (pc) {
            setSavingId(pc.ID);
            try {
                await fetch(`/api/pregnancy-checks/${pc.ID}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ CalvingAlert: !currentlyOn })
                });
                onRefresh();
            } finally {
                setSavingId(null);
            }
        } else if (!currentlyOn) {
            // No existing pregCheck — create one with just CalvingAlert=true.
            // Note: the createPregancyCheck controller does not yet forward CalvingAlert
            // in its mapped fields. Add it to the controller when ready.
            await fetch('/api/pregnancy-checks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cowTag,
                    planID:     planId,
                    isPregnant: false,
                    CalvingAlert: true
                })
            });
            onRefresh();
        }
    };

    const updateNote = async (cowTag, notes) => {
        const pc = findPregCheck(cowTag);
        if (!pc) return;
        await fetch(`/api/pregnancy-checks/${pc.ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ Notes: notes })
        });
    };

    const colHeader = (
        <div style={{
            display: 'grid', gridTemplateColumns: '26px 90px 1fr 190px',
            gap: '8px', padding: '4px 10px',
            fontSize: '11px', fontWeight: 'bold', color: '#777',
            textTransform: 'uppercase'
        }}>
            <span />
            <span>Tag</span>
            <span>Expected Window</span>
            <span>Notes</span>
        </div>
    );

    const AnimalRow = ({ item, isAlert }) => {
        const pc = findPregCheck(item.cowTag);
        const [noteVal, setNoteVal] = useState(pc?.Notes || '');
        const timerRef = useRef(null);

        const handleNoteChange = (e) => {
            const v = e.target.value;
            setNoteVal(v);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => updateNote(item.cowTag, v), 700);
        };

        const bulls = [
            ...(item.primaryBulls || []).map(b => b.tag),
            ...(item.cleanupBulls  || []).map(b => b.tag)
        ].join(', ');

        return (
            <div style={{
                display: 'grid', gridTemplateColumns: '26px 90px 1fr 190px',
                alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderBottom: '1px solid #f2f2f2'
            }}>
                <input
                    type="checkbox"
                    checked={isAlert}
                    disabled={savingId === pc?.ID}
                    onChange={() => toggleAlert(item.cowTag, isAlert)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.cowTag}</span>
                <div style={{ fontSize: '12px', color: '#555' }}>
                    {item.earliestBirth && (
                        <span>{formatDate(item.earliestBirth)} – {formatDate(item.latestBirth)}</span>
                    )}
                    {bulls && <span style={{ marginLeft: '8px', color: '#999' }}>{bulls}</span>}
                </div>
                <input
                    type="text"
                    value={noteVal}
                    onChange={handleNoteChange}
                    placeholder={pc ? 'Notes...' : 'No preg check on file'}
                    disabled={!pc}
                    style={{
                        padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px',
                        fontSize: '12px', width: '100%', boxSizing: 'border-box',
                        backgroundColor: pc ? 'white' : '#f5f5f5'
                    }}
                />
            </div>
        );
    };

    const calvedTags      = new Set((calvingRecords || []).map(r => r.DamTag));
    const alertedTags     = new Set((calvingAlerts  || []).map(a => a.cowTag));
    const addAlertOptions = (pregChecks || [])
        .filter(pc => pc.IsPregnant && !pc.CalvingAlert && !calvedTags.has(pc.CowTag) && !alertedTags.has(pc.CowTag))
        .map(pc => ({ CowTag: pc.CowTag, HerdName: null, Status: null }));

    const handleAddAlerts = async () => {
        if (alertSelected.size === 0) return;
        setAddingAlert(true);
        try {
            await Promise.all([...alertSelected].map(cowTag => {
                const pc = (pregChecks || []).find(p => p.CowTag === cowTag && p.IsPregnant);
                return pc ? fetch(`/api/pregnancy-checks/${pc.ID}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ CalvingAlert: true })
                }) : Promise.resolve();
            }));
            setAlertSelected(new Set());
            setShowAddAlert(false);
            onRefresh();
        } finally { setAddingAlert(false); }
    };

    return (
        <div className="bubble-container" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>Calving Watch</h3>

            {/* Calving Alerts */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#c62828' }}>
                        Calving Alert &nbsp;({calvingAlerts?.length || 0})
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>Uncheck to remove</span>
                </div>
                <div style={{ border: '1px solid #ffcdd2', borderRadius: '5px', backgroundColor: '#fff8f8' }}>
                    <div style={{ backgroundColor: '#ffebee', borderRadius: '5px 5px 0 0' }}>{colHeader}</div>
                    {(!calvingAlerts || calvingAlerts.length === 0) ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
                            No animals on calving alert
                        </div>
                    ) : calvingAlerts.map(item => <AnimalRow key={item.cowTag} item={item} isAlert={true} />)}
                </div>
                <div style={{ padding: '8px 10px 4px' }}>
                    <button
                        onClick={() => setShowAddAlert(true)}
                        style={{
                            padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px',
                            cursor: 'pointer', backgroundColor: '#c62828', color: 'white',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                        Add to Alert
                    </button>
                </div>
            </div>

            <Popup
                isOpen={showAddAlert}
                onClose={() => { setShowAddAlert(false); setAlertSelected(new Set()); }}
                title="Add Animals to Calving Alert"
                width="500px"
            >
                <div style={{ padding: '16px' }}>
                    {addAlertOptions.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#888' }}>
                            No eligible animals — needs a preg check marked pregnant, no calving record, and not already on alert.
                        </p>
                    ) : (
                        <>
                            <AnimalTableSelector
                                animals={addAlertOptions}
                                selected={alertSelected}
                                onChange={setAlertSelected}
                                maxHeight="360px"
                                label="Pregnant animals"
                            />
                            <button
                                onClick={handleAddAlerts}
                                disabled={alertSelected.size === 0 || addingAlert}
                                style={{
                                    marginTop: '14px', width: '100%', padding: '9px',
                                    backgroundColor: alertSelected.size > 0 && !addingAlert ? '#c62828' : '#aaa',
                                    color: 'white', border: 'none', borderRadius: '4px',
                                    fontSize: '14px', fontWeight: 'bold',
                                    cursor: alertSelected.size > 0 && !addingAlert ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {addingAlert ? 'Saving...' : `Add ${alertSelected.size} to Calving Alert`}
                            </button>
                        </>
                    )}
                </div>
            </Popup>

            {/* Expected Births */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1565c0' }}>
                        Expected Births &nbsp;({expectedBirths?.length || 0})
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>Check to add to alert list</span>
                </div>
                <div style={{ border: '1px solid #bbdefb', borderRadius: '5px', backgroundColor: '#f8fbff' }}>
                    <div style={{ backgroundColor: '#e3f2fd', borderRadius: '5px 5px 0 0' }}>{colHeader}</div>
                    {(!expectedBirths || expectedBirths.length === 0) ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
                            No expected births at this time
                        </div>
                    ) : expectedBirths.map(item => <AnimalRow key={item.cowTag + (item.breedingRecordId || '')} item={item} isAlert={false} />)}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bubble 2 — Unassigned Animals
// ---------------------------------------------------------------------------

function UnassignedAnimalsBubble({ unassignedAnimals, planId, breedingRecords, onRefresh }) {
    const [linkingTag, setLinkingTag]           = useState(null);
    const [selectedExposureKey, setSelectedKey] = useState('');
    const [saving, setSaving]                   = useState(false);

    const exposureGroups = groupIntoExposures(breedingRecords || []);

    const exposureLabel = (g) => {
        const bulls = g.primaryBulls.map(b => b.tag).join(', ') || 'No bulls';
        return `${bulls}  (${formatDate(g.exposureStartDate)} – ${formatDate(g.exposureEndDate)})${g.pasture ? '  •  ' + g.pasture : ''}`;
    };

    const handleLink = async (cowTag) => {
        const group = exposureGroups.find(g => g.key === selectedExposureKey);
        if (!group) return;
        setSaving(true);
        try {
            await fetch('/api/breeding-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    planID:            planId,
                    cowTag,
                    primaryBulls:      group.primaryBulls,
                    cleanupBulls:      group.cleanupBulls,
                    isAI:              false,
                    exposureStartDate: group.exposureStartDate,
                    exposureEndDate:   group.exposureEndDate,
                    pasture:           group.pasture || null
                })
            });
            setLinkingTag(null);
            setSelectedKey('');
            onRefresh();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleIgnore = async (cowTag) => {
        try {
            const res  = await fetch(`/api/breeding-plans/${planId}`, { credentials: 'include' });
            if (!res.ok) return;
            const plan = await res.json();
            let ignored = [];
            try { ignored = JSON.parse(plan.IgnoredAnimals || '[]'); } catch { ignored = []; }
            if (!ignored.includes(cowTag)) ignored.push(cowTag);
            await fetch(`/api/breeding-plans/${planId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ IgnoredAnimals: JSON.stringify(ignored) })
            });
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    if (!unassignedAnimals || unassignedAnimals.length === 0) return null;

    return (
        <div className="bubble-container" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                {unassignedAnimals.length} breeding-age {unassignedAnimals.length === 1 ? 'animal is' : 'animals are'} unassigned to a bull
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '20rem', overflowY: 'auto' }}>
                {unassignedAnimals.map(animal => {
                    const isLinking = linkingTag === animal.CowTag;
                    return (
                        <div key={animal.CowTag} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                            padding: '7px 10px', backgroundColor: '#fafafa',
                            border: '1px solid #eee', borderRadius: '4px'
                        }}>
                            <span style={{ fontWeight: 'bold', minWidth: '80px' }}>{animal.CowTag}</span>
                            {animal.HerdName && (
                                <span style={{ fontSize: '13px', color: '#777' }}>{animal.HerdName}</span>
                            )}

                            {isLinking ? (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                                    <select
                                        value={selectedExposureKey}
                                        onChange={(e) => setSelectedKey(e.target.value)}
                                        style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', flex: 1, minWidth: '200px' }}
                                    >
                                        <option value="">Select an exposure...</option>
                                        {exposureGroups.map(g => (
                                            <option key={g.key} value={g.key}>{exposureLabel(g)}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleLink(animal.CowTag)}
                                        disabled={!selectedExposureKey || saving}
                                        style={{
                                            padding: '5px 12px', fontSize: '13px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                                            backgroundColor: selectedExposureKey && !saving ? '#28a745' : '#aaa', color: 'white'
                                        }}
                                    >
                                        {saving ? 'Saving...' : 'Confirm'}
                                    </button>
                                    <button
                                        onClick={() => { setLinkingTag(null); setSelectedKey(''); }}
                                        style={{ padding: '5px 12px', fontSize: '13px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                    <button
                                        onClick={() => { setLinkingTag(animal.CowTag); setSelectedKey(''); }}
                                        style={{ padding: '5px 12px', fontSize: '13px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#1976d2', color: 'white' }}
                                    >
                                        Link to Exposure
                                    </button>
                                    <button
                                        onClick={() => handleIgnore(animal.CowTag)}
                                        style={{ padding: '5px 12px', fontSize: '13px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#757575', color: 'white' }}
                                    >
                                        Ignore
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bubble 3 — Add Exposure
// ---------------------------------------------------------------------------

function AddExposureBubble({ planId, allAnimals, activeAnimals, bullOptions, assignedCowTags, onRefresh }) {
    const today      = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];

    const [isAI,             setIsAI]             = useState(false);
    const [exposureDate,     setExposureDate]      = useState(today);
    const [startDate,        setStartDate]         = useState(today);
    const [endDate,          setEndDate]           = useState(defaultEnd);
    const [primaryBulls,     setPrimaryBulls]      = useState([]);
    const [cleanupBulls,     setCleanupBulls]      = useState([]);
    const [selectedPasture,  setSelectedPasture]   = useState('');
    const [availablePastures,setAvailablePastures] = useState([]);
    const [selectedCows,     setSelectedCows]      = useState(new Set());
    const [activeOnly,       setActiveOnly]        = useState(true);
    const [unassignedOnly,  setUnassignedOnly]    = useState(false);
    const [saving,           setSaving]            = useState(false);

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
                exposureStartDate: isAI ? exposureDate : startDate,
                exposureEndDate:   isAI ? exposureDate : endDate,
                pasture:           isAI ? null : (selectedPasture || null)
            }));
            await fetch('/api/breeding-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(records)
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
                        AI Exposure
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

                            <BullInput label="Bull"  bulls={primaryBulls}  bullOptions={bullOptions} onChange={setPrimaryBulls} />
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
                        

                            <BullInput label="Primary Bulls"  bulls={primaryBulls}  bullOptions={bullOptions} onChange={setPrimaryBulls} />
                            <BullInput label="Cleanup Bulls"  bulls={cleanupBulls}  bullOptions={bullOptions} onChange={setCleanupBulls} />
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

// ---------------------------------------------------------------------------
// Bubble 4 — Existing Exposure
// ---------------------------------------------------------------------------

function ExposureBubble({ group, bullOptions, onRefresh }) {
    const [startDate,   setStartDate]   = useState(group.exposureStartDate ? new Date(group.exposureStartDate).toISOString().split('T')[0] : '');
    const [endDate,     setEndDate]     = useState(group.exposureEndDate   ? new Date(group.exposureEndDate).toISOString().split('T')[0]   : '');
    const [cleanups,    setCleanups]    = useState(group.cleanupBulls || []);
    const [saving,      setSaving]      = useState(false);

    const [deleteExposureOpen, setDeleteExposureOpen] = useState(false);
    const [deleteCowOpen,      setDeleteCowOpen]      = useState(false);
    const [cowToDelete,        setCowToDelete]        = useState(null);

    // Update every record in this group with the given fields
    const updateAll = async (fields) => {
        setSaving(true);
        try {
            await Promise.all(
                group.records.map(r =>
                    fetch(`/api/breeding-records/${r.ID}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(fields)
                    })
                )
            );
            onRefresh();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDateBlur = () => {
        if (startDate && endDate) {
            updateAll({ ExposureStartDate: startDate, ExposureEndDate: endDate });
        }
    };

    const handleCleanupChange = (newBulls) => {
        setCleanups(newBulls);
        updateAll({ CleanupBulls: newBulls });
    };

    const handleDeleteCow = async () => {
        if (!cowToDelete) return;
        try {
            await fetch(`/api/breeding-records/${cowToDelete.ID}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            setDeleteCowOpen(false);
            setCowToDelete(null);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteExposure = async () => {
        try {
            await Promise.all(
                group.records.map(r =>
                    fetch(`/api/breeding-records/${r.ID}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    })
                )
            );
            setDeleteExposureOpen(false);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const AddCleanupBullInline = () => {
        const [val, setVal] = useState('');
        const add = (tagOverride) => {
            const tag = (tagOverride !== undefined ? tagOverride : val).trim().toUpperCase();
            if (tag && !cleanups.find(b => b.tag === tag)) {
                handleCleanupChange([...cleanups, { tag }]);
            }
            setVal('');
        };
        return (
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <div style={{ flex: 1 }}>
                    <AnimalCombobox
                        options={bullOptions}
                        value={val}
                        onChange={setVal}
                        onSelect={(v) => { if (v) add(v); }}
                        onBlur={(v)   => { if (v) add(v); }}
                        placeholder="Search bull tag..."
                        allowCustomValue={true}
                        style={{ fontSize: '12px' }}
                    />
                </div>
                <button
                    onClick={() => add()}
                    style={{
                        padding: '3px 8px', backgroundColor: '#1976d2', color: 'white',
                        border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', flexShrink: 0
                    }}
                >
                    + Bull
                </button>
            </div>
        );
    };

    const sectionLabel = (text) => (
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
            {text}
        </div>
    );

    return (
        <div className="bubble-container" style={{ marginBottom: '16px', position: 'relative' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                        {group.primaryBulls.map(b => b.tag).join(', ') || 'No primary bulls'}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '13px', color: '#999' }}>
                        {group.records.length} {group.records.length === 1 ? 'cow' : 'cows'}
                    </span>
                    {saving && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#999' }}>Saving...</span>}
                </div>
                <button
                    onClick={() => setDeleteExposureOpen(true)}
                    style={{
                        background: 'none', border: '1px solid #dc3545', borderRadius: '4px',
                        padding: '4px 10px', cursor: 'pointer', color: '#dc3545', fontSize: '12px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                    Delete Exposure
                </button>
            </div>

            {/* Body — each column scrolls independently at its own maxHeight */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>

                {/* Left column */}
                <div style={{ overflowY: 'auto', maxHeight: '40rem', paddingRight: '4px' }}>

                    <div style={{ marginBottom: '10px' }}>
                        {sectionLabel('Primary Bulls')}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {group.primaryBulls.length > 0
                                ? group.primaryBulls.map(b => <BullTag key={b.tag} tag={b.tag} />)
                                : <span style={{ fontSize: '13px', color: '#bbb' }}>None</span>
                            }
                        </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        {sectionLabel('Cleanup Bulls')}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                            {cleanups.map(b => (
                                <BullTag
                                    key={b.tag}
                                    tag={b.tag}
                                    onRemove={(t) => handleCleanupChange(cleanups.filter(x => x.tag !== t))}
                                />
                            ))}
                        </div>
                        <AddCleanupBullInline />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                        <div>
                            {sectionLabel('Start')}
                            <input
                                type="date" value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onBlur={handleDateBlur}
                                style={{ padding: '5px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            {sectionLabel('End')}
                            <input
                                type="date" value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
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
                </div>

                {/* Right column */}
                <div style={{ overflowY: 'auto', maxHeight: '20rem' }}>
                    {sectionLabel('Exposed Cows')}
                    {group.records.map((record, idx) => (
                        <div key={record.ID} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '5px 6px', borderBottom: '1px solid #e8eef3', fontSize: '13px',
                            backgroundColor: idx % 2 === 0 ? 'white' : '#eef3f7'
                        }}>
                            <span style={{ fontWeight: 'bold' }}>{record.CowTag}</span>
                            <button
                                onClick={() => { setCowToDelete(record); setDeleteCowOpen(true); }}
                                title="Remove from exposure"
                                style={{
                                    flexShrink: 0, background: 'none', border: 'none',
                                    padding: '2px', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', color: '#dc3545', borderRadius: '3px'
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

            {/* Remove single cow confirm — no delay */}
            <PopupConfirm
                isOpen={deleteCowOpen}
                onClose={() => { setDeleteCowOpen(false); setCowToDelete(null); }}
                onConfirm={handleDeleteCow}
                title="Remove Cow"
                message={`Remove <strong>${cowToDelete?.CowTag}</strong> from this exposure?`}
                confirmText="Remove"
            />

            {/* Delete entire exposure confirm — 3 second delay */}
            <PopupConfirm
                isOpen={deleteExposureOpen}
                onClose={() => setDeleteExposureOpen(false)}
                onConfirm={handleDeleteExposure}
                title="Delete Exposure"
                message={`Delete this entire exposure? This will remove all <strong>${group.records.length}</strong> breeding ${group.records.length === 1 ? 'record' : 'records'}.<br/><br/><span style="color:#dc3545;font-weight:bold">This cannot be undone.</span>`}
                confirmText="Delete Exposure"
                requireDelay={true}
                delaySeconds={3}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function BreedingOverview({ planId }) {
    const [overview,      setOverview]      = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [allAnimals,    setAllAnimals]    = useState([]);
    const [activeAnimals, setActiveAnimals] = useState([]);
    const [bulls,         setBulls]         = useState([]);

    const fetchOverview = useCallback(async () => {
        if (!planId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/breeding-plans/${planId}/overview`, { credentials: 'include' });
            if (res.ok) setOverview(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [planId]);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    // Pre-fetch both animal lists so switching the "active only" toggle is instant
    useEffect(() => {
        Promise.all([
            fetch('/api/animals',        { credentials: 'include' }).then(r => r.ok ? r.json() : { recordset: [] }),
            fetch('/api/animals/active', { credentials: 'include' }).then(r => r.ok ? r.json() : { recordset: [] })
        ]).then(([all, active]) => {
            setAllAnimals(all.cows    || []);
            setActiveAnimals(active.cows || []);
        }).catch(() => {});
    }, []);

    // Fetch bulls for combobox options
    useEffect(() => {
        fetch('/api/breeding-animal-status', { credentials: 'include' })
            .then(r => r.ok ? r.json() : {})
            .then(d => setBulls(d.bulls || []))
            .catch(() => {});
    }, []);

    if (!planId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                Select a breeding plan to view its overview.
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '16px' }}>
                Loading overview...
            </div>
        );
    }

    if (!overview) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No overview data available.
            </div>
        );
    }

    const exposureGroups = groupIntoExposures(overview.breedingRecords || []);

    const assignedCowTags = new Set((overview.assignedAnimals || []).map(a => a.cowTag));

    const bullOptions = bulls.map(b => ({
        name:   b.CowTag,
        value:  b.CowTag,
        status: b.Status || 'Current'
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CalvingAlertsBubble
                calvingAlerts={overview.calvingAlerts}
                expectedBirths={overview.expectedBirths}
                pregChecks={overview.pregChecks}
                calvingRecords={overview.calvingRecords}
                planId={planId}
                onRefresh={fetchOverview}
            />

            <UnassignedAnimalsBubble
                unassignedAnimals={overview.unassignedAnimals}
                planId={planId}
                breedingRecords={overview.breedingRecords}
                onRefresh={fetchOverview}
            />

            <AddExposureBubble
                planId={planId}
                allAnimals={allAnimals}
                activeAnimals={activeAnimals}
                bullOptions={bullOptions}
                assignedCowTags={assignedCowTags}
                onRefresh={fetchOverview}
            />

            {exposureGroups.map(group => (
                <ExposureBubble
                    key={group.key}
                    group={group}
                    bullOptions={bullOptions}
                    onRefresh={fetchOverview}
                />
            ))}
        </div>
    );
}

export default BreedingOverview;