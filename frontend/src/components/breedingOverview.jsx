import React, { useState, useEffect, useCallback } from 'react';
import PopupConfirm from './popupConfirm';
import AnimalCombobox, { StatusBadge } from './animalCombobox';
import { PregnancyLinkerBubble } from './pregnancyLinker';
import { CalvingLinkerBubble } from './calvingLinker';
import { WeaningLinkerBubble } from './weaningLinker';
import { toUTC, toLocalDisplay } from '../utils/dateUtils';
import CalvingAlertsBubble from './calvingAlert';


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
                planId:            record.PlanID           ?? null,
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
// Bubble 1 — Calving Alerts + Expected Births  →  see calvingAlert.jsx
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bubble 2 — Unassigned Animals  (plan-specific only, not shown in current mode)
// ---------------------------------------------------------------------------

function UnassignedAnimalsBubble({ unassignedAnimals, planId = null, breedingRecords, onRefresh }) {
    const [linkingTag, setLinkingTag]           = useState(null);
    const [selectedExposureKey, setSelectedKey] = useState('');
    const [saving, setSaving]                   = useState(false);

    const exposureGroups = groupIntoExposures(breedingRecords || []);

    const exposureLabel = (g) => {
        const bulls = g.primaryBulls.map(b => b.tag).join(', ') || 'No bulls';
        return `${bulls}  (${toLocalDisplay(g.exposureStartDate)} – ${toLocalDisplay(g.exposureEndDate)})${g.pasture ? '  •  ' + g.pasture : ''}`;
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
                    planID:            group.planId,
                    cowTag,
                    primaryBulls:      group.primaryBulls,
                    cleanupBulls:      group.cleanupBulls,
                    isAI:              false,
                    exposureStartDate: toUTC(group.exposureStartDate),
                    exposureEndDate:   toUTC(group.exposureEndDate),
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                The following animals were open in 2 or more preg checks
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
                                    {toLocalDisplay(c.date)}
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
            const seenUnassigned = new Set();
            const merged = {
                calvingAlerts:     [],
                expectedBirths:    [],
                pregChecks:        [],
                calvingRecords:    [],
                breedingRecords:   [],
                unassignedAnimals: [],
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
                for (const u of (data.unassignedAnimals || [])) {
                    if (!seenUnassigned.has(u.CowTag)) { seenUnassigned.add(u.CowTag); merged.unassignedAnimals.push(u); }
                }
                merged.pregChecks.push(...(data.pregChecks        || []));
                merged.calvingRecords.push(...(data.calvingRecords || []));
                merged.breedingRecords.push(...(data.breedingRecords || []));
                merged.assignedAnimals.push(...(data.assignedAnimals || []));
            }

            setOverview(merged);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

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
            <PregnancyLinkerBubble onRefresh={fetchOverview} />
            <CalvingLinkerBubble onRefresh={fetchOverview} />

            <ChronicallyOpenCowsBubble
                pregChecks={overview.pregChecks}
                planNames={planNames}
            />

            <CalvingAlertsBubble
                calvingAlerts={overview.calvingAlerts}
                expectedBirths={overview.expectedBirths}
                pregChecks={overview.pregChecks}
                calvingRecords={overview.calvingRecords}
                planId={planId ?? null}
                onRefresh={fetchOverview}
            />
 
            <UnassignedAnimalsBubble
                unassignedAnimals={overview.unassignedAnimals}
                breedingRecords={overview.breedingRecords}
                onRefresh={fetchOverview}
            />
 


        </div>
    );
}

export default BreedingOverview;