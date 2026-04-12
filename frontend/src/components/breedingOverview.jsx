import React, { useState, useEffect, useCallback, useRef } from 'react';
import PopupConfirm from './popupConfirm';
import AnimalCombobox, { StatusBadge } from './animalCombobox';
import AnimalTableSelector from './animalTableSelector';
import { UnlinkedRecordsBubble } from './recordLinker';
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
            // No existing pregCheck — create a minimal one with just the alert set
            await fetch('/api/pregnancy-checks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cowTag,
                    planID:      planId ?? null,
                    testResults: 'Untested',
                    calvingAlert: true
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

    // Updated: use TestResults === 'Pregnant' (IsPregnant column was dropped)
    const addAlertOptions = (pregChecks || [])
        .filter(pc => pc.TestResults === 'Pregnant' && !pc.CalvingAlert && !calvedTags.has(pc.CowTag) && !alertedTags.has(pc.CowTag))
        .map(pc => ({ CowTag: pc.CowTag, HerdName: null, Status: null }));

    const handleAddAlerts = async () => {
        if (alertSelected.size === 0) return;
        setAddingAlert(true);
        try {
            await Promise.all([...alertSelected].map(cowTag => {
                // Updated: use TestResults === 'Pregnant'
                const pc = (pregChecks || []).find(p => p.CowTag === cowTag && p.TestResults === 'Pregnant');
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
        <div style={{ marginBottom: '16px' }}>
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
// Bubble 2 — Unassigned Animals  (plan-specific only, not shown in current mode)
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
        <div style={{ marginBottom: '16px' }}>
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
// Bubble 3 — Chronically Open Cows  (info only)
// ---------------------------------------------------------------------------

// Derives cows that have been confirmed Open in 2+ separate preg checks.
// planNames: Map<planId, { PlanName, PlanYear }> — optional, for display.
function deriveChronicallyOpen(pregChecks, planNames = {}) {
    const openByTag = {};
    for (const pc of (pregChecks || [])) {
        if (pc.TestResults !== 'Open') continue;
        if (!openByTag[pc.CowTag]) openByTag[pc.CowTag] = [];
        openByTag[pc.CowTag].push(pc);
    }

    return Object.entries(openByTag)
        .filter(([, checks]) => checks.length >= 2)
        .map(([cowTag, checks]) => {
            const sorted = [...checks].sort((a, b) => new Date(a.PregCheckDate) - new Date(b.PregCheckDate));
            const earliest = new Date(sorted[0].PregCheckDate);
            const latest   = new Date(sorted[sorted.length - 1].PregCheckDate);
            const yearSpan = latest.getFullYear() - earliest.getFullYear();

            return {
                cowTag,
                count: sorted.length,
                yearSpan,
                checks: sorted.map(pc => ({
                    date:     pc.PregCheckDate,
                    planId:   pc.PlanID,
                    planLabel: pc.PlanID && planNames[pc.PlanID]
                        ? `${planNames[pc.PlanID].PlanYear} — ${planNames[pc.PlanID].PlanName}`
                        : pc.PlanID ? `Plan ${pc.PlanID}` : 'No plan',
                })),
            };
        })
        .sort((a, b) => a.yearSpan - b.yearSpan); // most recent repeaters first (small span = recent problem)
}

function ChronicallyOpenCowsBubble({ pregChecks, planNames }) {
    const cows = deriveChronicallyOpen(pregChecks, planNames);

    if (cows.length === 0) return null;

    return (
        <div className="bubble-container" style={{ marginBottom: '16px', borderLeft: '3px solid #f57c00' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Repeatedly Open Cows</h3>
                <span style={{ fontSize: '12px', color: '#f57c00', fontWeight: '600' }}>
                    {cows.length} {cows.length === 1 ? 'cow' : 'cows'}
                </span>
                <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>
                    Info only — open in 2 or more preg checks
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cows.map(({ cowTag, count, yearSpan, checks }) => (
                    <div
                        key={cowTag}
                        style={{
                            padding: '10px 12px',
                            backgroundColor: '#fffbf5',
                            border: '1px solid #ffe0b2',
                            borderRadius: '5px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{cowTag}</span>
                            <span style={{ fontSize: '12px', color: '#f57c00' }}>
                                Open {count}×
                            </span>
                            {yearSpan === 0 ? (
                                <span style={{
                                    fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                                    backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2'
                                }}>
                                    Same year — consider culling
                                </span>
                            ) : yearSpan <= 2 ? (
                                <span style={{
                                    fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                                    backgroundColor: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2'
                                }}>
                                    {yearSpan}yr span — monitor
                                </span>
                            ) : (
                                <span style={{
                                    fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                                    backgroundColor: '#f3f3f3', color: '#555', border: '1px solid #ddd'
                                }}>
                                    {yearSpan}yr span — likely isolated incidents
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {checks.map((c, i) => (
                                <span
                                    key={i}
                                    style={{
                                        fontSize: '12px', padding: '2px 8px',
                                        backgroundColor: 'white', border: '1px solid #ddd',
                                        borderRadius: '4px', color: '#555'
                                    }}
                                >
                                    {formatDate(c.date)}
                                    <span style={{ color: '#aaa', marginLeft: '4px' }}>{c.planLabel}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// remove the duplicate formatDate — the one already in the file is used by both

const fetchUnlinkedPregChecks = () =>
    fetch('/api/pregnancy-checks/unlinked', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const fetchPregCheckCandidates = (rec) =>
    fetch(`/api/breeding-records?cowTag=${encodeURIComponent(rec.CowTag)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const savePregCheckLink = (rec, candidate) =>
    fetch(`/api/pregnancy-checks/${rec.ID}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ BreedingRecordID: candidate.ID }),
    });

const renderPregCheckRecord = (rec) => ({
    primary:   rec.CowTag,
    secondary: [
        formatDate(rec.PregCheckDate),
        rec.MonthsPregnant != null ? `${rec.MonthsPregnant}mo` : null,
        rec.TestType || null,
    ].filter(Boolean).join('  ·  '),
    badge: rec.TestResults ? {
        label:  rec.TestResults,
        bg:     rec.TestResults === 'Pregnant' ? '#e8f5e9' : '#f5f5f5',
        color:  rec.TestResults === 'Pregnant' ? '#2e7d32' : '#666',
        border: rec.TestResults === 'Pregnant' ? '#a5d6a7' : '#ddd',
    } : null,
    note: rec.Notes || null,
});

const pregCheckCandidateLabel = (rec) =>
    `Breeding records for ${rec.CowTag}`;




const fetchUnlinkedCalvingRecords = () =>
    fetch('/api/calving-records/unlinked', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const fetchCalvingCandidates = (rec) => {
    if (!rec.DamTag) return Promise.resolve({ records: [] });
    return fetch(`/api/breeding-records?cowTag=${encodeURIComponent(rec.DamTag)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });
};

const saveCalvingLink = (rec, candidate) =>
    fetch(`/api/calving-records/${rec.ID}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ BreedingRecordID: candidate.ID }),
    });

const renderCalvingRecord = (rec) => ({
    primary:   rec.DamTag || 'No dam tag',
    secondary: [
        rec.CalfTag ? `Calf: ${rec.CalfTag}` : null,
        formatDate(rec.BirthDate),
        rec.CalfSex || null,
        rec.CalfDiedAtBirth ? 'Died at birth' : null,
    ].filter(Boolean).join('  ·  '),
    badge: null,
    note: rec.CalvingNotes || null,
});

const calvingCandidateLabel = (rec) =>
    rec.DamTag
        ? `Breeding records for dam ${rec.DamTag}`
        : 'No dam tag — cannot look up breeding records';


// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function BreedingOverview({ planId }) {
    const [overview,  setOverview]  = useState(null);
    const [planNames, setPlanNames] = useState({});
    const [loading,   setLoading]   = useState(true);

    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            if (planId) {
                // Specific plan selected
                const res = await fetch(`/api/breeding-plans/${planId}/overview`, { credentials: 'include' });
                if (res.ok) setOverview(await res.json());
            } else {
                // Current Animals: merge all active plans
                const plansRes = await fetch('/api/breeding-plans', { credentials: 'include' });
                if (!plansRes.ok) return;
                const plansData = await plansRes.json();

                const activePlans = (plansData.plans || []).filter(p => p.IsActive);

                // Build planId → label map for ChronicallyOpenCowsBubble
                const nameMap = {};
                for (const p of activePlans) nameMap[p.ID] = { PlanName: p.PlanName, PlanYear: p.PlanYear };
                setPlanNames(nameMap);

                if (activePlans.length === 0) {
                    setOverview({ calvingAlerts: [], expectedBirths: [], pregChecks: [], calvingRecords: [], breedingRecords: [], unassignedAnimals: [], assignedAnimals: [] });
                    return;
                }

                const overviews = await Promise.all(
                    activePlans.map(p =>
                        fetch(`/api/breeding-plans/${p.ID}/overview`, { credentials: 'include' })
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null)
                    )
                );

                const seenAlerts = new Set();
                const seenBirths = new Set();
                const merged = {
                    calvingAlerts:     [],
                    expectedBirths:    [],
                    pregChecks:        [],
                    calvingRecords:    [],
                    breedingRecords:   [],
                    unassignedAnimals: [],   // not meaningful cross-plan
                    assignedAnimals:   [],
                };

                for (const data of overviews) {
                    if (!data) continue;
                    for (const a of (data.calvingAlerts || [])) {
                        if (!seenAlerts.has(a.cowTag)) { seenAlerts.add(a.cowTag); merged.calvingAlerts.push(a); }
                    }
                    for (const b of (data.expectedBirths || [])) {
                        const k = b.cowTag + (b.breedingRecordId || '');
                        if (!seenBirths.has(k)) { seenBirths.add(k); merged.expectedBirths.push(b); }
                    }
                    merged.pregChecks.push(...(data.pregChecks        || []));
                    merged.calvingRecords.push(...(data.calvingRecords || []));
                    merged.breedingRecords.push(...(data.breedingRecords || []));
                    merged.assignedAnimals.push(...(data.assignedAnimals || []));
                }

                setOverview(merged);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [planId]);

    // Build planNames map when a specific plan is selected
    useEffect(() => {
        if (!planId) return;
        fetch('/api/breeding-plans', { credentials: 'include' })
            .then(r => r.ok ? r.json() : { plans: [] })
            .then(d => {
                const map = {};
                for (const p of (d.plans || [])) map[p.ID] = { PlanName: p.PlanName, PlanYear: p.PlanYear };
                setPlanNames(map);
            })
            .catch(() => {});
    }, [planId]);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

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

    return (
        <div className='bubble-container' style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Unlinked records always shown regardless of plan selection */}
            <UnlinkedRecordsBubble
                fetchUnlinked={fetchUnlinkedPregChecks}
                fetchCandidates={fetchPregCheckCandidates}
                saveLink={savePregCheckLink}
                renderRecord={renderPregCheckRecord}
                candidateLabel={pregCheckCandidateLabel}
                noun="pregnancy check"
                nounPlural="pregnancy checks"
                popupTitle="Link Pregnancy Checks to Breeding Records"
                onRefresh={fetchOverview}
            />
            <UnlinkedRecordsBubble
                fetchUnlinked={fetchUnlinkedCalvingRecords}
                fetchCandidates={fetchCalvingCandidates}
                saveLink={saveCalvingLink}
                renderRecord={renderCalvingRecord}
                candidateLabel={calvingCandidateLabel}
                noun="calving record"
                nounPlural="calving records"
                popupTitle="Link Calving Records to Breeding Records"
                onRefresh={fetchOverview}
            />

            <CalvingAlertsBubble
                calvingAlerts={overview.calvingAlerts}
                expectedBirths={overview.expectedBirths}
                pregChecks={overview.pregChecks}
                calvingRecords={overview.calvingRecords}
                planId={planId ?? null}
                onRefresh={fetchOverview}
            />
 
            {planId && (
                <UnassignedAnimalsBubble
                    unassignedAnimals={overview.unassignedAnimals}
                    planId={planId}
                    breedingRecords={overview.breedingRecords}
                    onRefresh={fetchOverview}
                />
            )}
 

 
            <ChronicallyOpenCowsBubble
                pregChecks={overview.pregChecks}
                planNames={planNames}
            />
        </div>
    );
}

export default BreedingOverview;