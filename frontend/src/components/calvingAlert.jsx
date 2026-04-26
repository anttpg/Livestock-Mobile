import React, { useState, useRef } from 'react';
import Popup from './popup';
import AnimalTableSelector from './animalTableSelector';
import { toLocalDisplay } from '../utils/dateUtils';


// ---------------------------------------------------------------------------
// Priority helpers
// CalvingAlert tinyint values: 1 = on alert (no priority), 2 = Low, 3 = High, 4 = Highest
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
    { label: 'Highest', value: 4 },
    { label: 'High',    value: 3 },
    { label: 'Low',     value: 2 },
];

// Handles both legacy boolean true (pre-migration reads) and numeric tinyint
const getPriorityValue = (pc) => {
    const v = pc?.CalvingAlert;
    if (!v || v === true) return 1;
    return typeof v === 'number' ? v : 1;
};

// Base: #fff8f8. Each priority step darkens G+B by ~13 (~5% of 255).
const PRIORITY_BG = {
    4: '#ffd2d2', // Highest
    3: '#ffe0e0', // High
    2: '#ffecec', // Low
    1: 'transparent',
};


// ---------------------------------------------------------------------------
// Calving Alerts + Expected Births
// ---------------------------------------------------------------------------

function CalvingAlertsBubble({ calvingAlerts, expectedBirths, pregChecks, calvingRecords, planId, onRefresh, showExpectedBirths = true }) {
    const [savingId,            setSavingId]            = useState(null);
    const [showAddAlert,        setShowAddAlert]        = useState(false);
    const [alertSelected,       setAlertSelected]       = useState(new Set());
    const [addingAlert,         setAddingAlert]         = useState(false);
    const [showBirths,          setShowBirths]          = useState(true);
    const [hideExpectedWindow,  setHideExpectedWindow]  = useState(false);
    const containerRef = useRef(null);

    // Hide the Expected Window column when the Notes column would be narrower than 100px.
    // Observed on the stable container to avoid a ResizeObserver feedback loop.
    // Alert grid: '20px 70px 1fr 80px 2fr', gap 8px  →  Notes (2fr) = 2*(cw−202)/3
    React.useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const cw = entry.contentRect.width;
                const notesWidth = 2 * (cw - 202) / 3;
                setHideExpectedWindow(notesWidth < 100);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Prefer the record with the highest CalvingAlert priority value
    const findPregCheck = (cowTag) => {
        const all = (pregChecks || []).filter(p => p.CowTag === cowTag);
        return all.sort((a, b) => (b.CalvingAlert || 0) - (a.CalvingAlert || 0))[0] ?? null;
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
                    body: JSON.stringify({ CalvingAlert: currentlyOn ? 0 : 1 })
                });
                onRefresh();
            } finally {
                setSavingId(null);
            }
        } else if (!currentlyOn) {
            await fetch('/api/pregnancy-checks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cowTag,
                    planID:       planId ?? null,
                    testResults:  'Untested',
                    calvingAlert: 1
                })
            });
            onRefresh();
        }
    };

    const setPriority = async (cowTag, value) => {
        const pc = findPregCheck(cowTag);
        if (!pc) return;
        await fetch(`/api/pregnancy-checks/${pc.ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ CalvingAlert: value })
        });
        onRefresh();
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

    const alertColHeader = (
        <div style={{
            display: 'grid',
            gridTemplateColumns: hideExpectedWindow ? '20px 70px 80px 2fr' : '20px 70px 1fr 80px 2fr',
            gap: '8px', padding: '4px 10px',
            fontSize: '11px', fontWeight: 'bold', color: '#777',
            textTransform: 'uppercase'
        }}>
            <span />
            <span>Tag</span>
            {!hideExpectedWindow && <span>Expected Window</span>}
            <span>Priority</span>
            <span>Notes</span>
        </div>
    );

    const birthColHeader = (
        <div style={{
            display: 'grid',
            gridTemplateColumns: hideExpectedWindow ? '26px 90px 190px' : '26px 90px 1fr 190px',
            gap: '8px', padding: '4px 10px',
            fontSize: '11px', fontWeight: 'bold', color: '#777',
            textTransform: 'uppercase'
        }}>
            <span />
            <span>Tag</span>
            {!hideExpectedWindow && <span>Expected Window</span>}
            <span>Notes</span>
        </div>
    );

    const AnimalRow = ({ item, isAlert }) => {
        const pc       = findPregCheck(item.cowTag);
        const priority = isAlert ? getPriorityValue(pc) : null;
        const rowBg    = isAlert ? (PRIORITY_BG[priority] ?? 'transparent') : 'transparent';

        const [noteVal, setNoteVal] = useState(pc?.Notes || '');
        const timerRef = useRef(null);

        const handleNoteChange = (e) => {
            const v = e.target.value;
            setNoteVal(v);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => updateNote(item.cowTag, v), 700);
        };

        return (
            <div style={{
                display: 'grid',
                gridTemplateColumns: isAlert
                    ? (hideExpectedWindow ? '20px 70px 80px 2fr'    : '20px 70px 1fr 80px 2fr')
                    : (hideExpectedWindow ? '20px 70px 2fr'          : '20px 70px 1fr 2fr'),
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderBottom: '1px solid #f2f2f2',
                backgroundColor: rowBg,
                transition: 'background-color 0.15s ease',
            }}>
                <input
                    type="checkbox"
                    checked={isAlert}
                    disabled={savingId === pc?.ID}
                    onChange={() => toggleAlert(item.cowTag, isAlert)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.cowTag}</span>
                {!hideExpectedWindow && (
                    <div style={{ fontSize: '12px', color: '#555' }}>
                        {item.earliestBirth && (
                            <span>{toLocalDisplay(item.earliestBirth)} – {toLocalDisplay(item.latestBirth)}</span>
                        )}
                    </div>
                )}

                {isAlert && (
                    <select
                        value={priority > 1 ? priority : ''}
                        onChange={(e) => e.target.value && setPriority(item.cowTag, parseInt(e.target.value))}
                        style={{
                            padding: '3px 5px', border: '1px solid #ddd', borderRadius: '3px',
                            fontSize: '12px', width: '100%', boxSizing: 'border-box',
                            backgroundColor: 'white', color: priority > 1 ? '#333' : '#aaa',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="" disabled>Set priority</option>
                        {PRIORITY_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

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

    const calvedTags  = new Set((calvingRecords || []).map(r => r.DamTag));
    const alertedTags = new Set((calvingAlerts  || []).map(a => a.cowTag));

    // Sort highest priority first
    const sortedAlerts = [...(calvingAlerts || [])].sort((a, b) => {
        const prioA = getPriorityValue(findPregCheck(a.cowTag));
        const prioB = getPriorityValue(findPregCheck(b.cowTag));
        return prioB - prioA;
    });

    const addAlertOptions = (pregChecks || [])
        .filter(pc => pc.TestResults === 'Pregnant' && !pc.CalvingAlert && !calvedTags.has(pc.CowTag) && !alertedTags.has(pc.CowTag))
        .map(pc => ({ CowTag: pc.CowTag, HerdName: null, Status: null }))
        .filter((opt, idx, arr) => arr.findIndex(o => o.CowTag === opt.CowTag) === idx);

    const handleAddAlerts = async () => {
        if (alertSelected.size === 0) return;
        setAddingAlert(true);
        try {
            await Promise.all([...alertSelected].map(cowTag => {
                const pc = (pregChecks || []).find(p => p.CowTag === cowTag && p.TestResults === 'Pregnant');
                return pc ? fetch(`/api/pregnancy-checks/${pc.ID}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ CalvingAlert: 1 })
                }) : Promise.resolve();
            }));
            setAlertSelected(new Set());
            setShowAddAlert(false);
            onRefresh();
        } finally { setAddingAlert(false); }
    };

    return (
        <div ref={containerRef} style={{ marginBottom: '16px' }}>

            {/* Calving Alerts */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#c62828' }}>
                        Calving Alert &nbsp;({calvingAlerts?.length || 0})
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>Uncheck to remove</span>
                </div>
                <div style={{ border: '1px solid #ffcdd2', borderRadius: '5px', backgroundColor: '#fff8f8' }}>
                    <div style={{ backgroundColor: '#ffebee', borderRadius: '5px 5px 0 0' }}>{alertColHeader}</div>
                    {sortedAlerts.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
                            No animals on calving alert
                        </div>
                    ) : sortedAlerts.map(item => <AnimalRow key={item.cowTag} item={item} isAlert={true} />)}

                    <div style={{ padding: '8px 10px 4px' }}>
                        <button
                            type="button"
                            onClick={() => setShowAddAlert(true)}
                            style={{
                                padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px',
                                cursor: 'pointer', backgroundColor: '#c62828', color: 'white',
                                display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                            Add to Alert
                        </button>
                    </div>
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
                                type="button"
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
            {showExpectedBirths && (
            <div>
                <div
                    onClick={() => setShowBirths(v => !v)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', cursor: 'pointer', userSelect: 'none' }}
                >
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1565c0' }}>
                        Expected Births &nbsp;({expectedBirths?.length || 0})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#999' }}>Check to add to alert list</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#999', transition: 'transform 0.2s', transform: showBirths ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                            expand_more
                        </span>
                    </span>
                </div>
                {showBirths && (
                    <div style={{ border: '1px solid #bbdefb', borderRadius: '5px', backgroundColor: '#f8fbff' }}>
                        <div style={{ backgroundColor: '#e3f2fd', borderRadius: '5px 5px 0 0' }}>{birthColHeader}</div>
                        {(!expectedBirths || expectedBirths.length === 0) ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
                                No expected births at this time
                            </div>
                        ) : expectedBirths.map(item => <AnimalRow key={item.cowTag + (item.breedingRecordId || '')} item={item} isAlert={false} />)}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}

export default CalvingAlertsBubble;