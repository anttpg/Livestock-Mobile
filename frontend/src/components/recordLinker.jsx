import React, { useState, useEffect } from 'react';
import Popup from './popup';
import { toLocalDisplay } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Candidate card — a single breeding record the user can pick
// Shared between all linker usages
// ---------------------------------------------------------------------------

function BreedingRecordCandidate({ record, isSelected, onClick }) {
    const bulls = [
        ...(record.PrimaryBulls || []).map(b => b.tag),
        ...(record.CleanupBulls || []).map(b => b.tag),
    ].filter(Boolean);

    return (
        <div
            onClick={onClick}
            style={{
                padding: 'var(--table-padding) var(--table-padding)', marginBottom: '6px', borderRadius: '5px', cursor: 'pointer',
                border: `2px solid ${isSelected ? '#1976d2' : '#e0e0e0'}`,
                backgroundColor: isSelected ? '#e3f2fd' : '#fafafa',
                transition: 'border-color 0.12s',
            }}
        >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                    {toLocalDisplay(record.ExposureStartDate) || '—'} – {toLocalDisplay(record.ExposureEndDate) || '—'}
                </span>
                <span style={{
                    fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                    backgroundColor: '#f0f0f0', color: '#555', border: '1px solid #ddd'
                }}>
                    {record.BreedingStatus || 'Active'}
                </span>
                {record.PlanID && (
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Plan {record.PlanID}</span>
                )}
            </div>
            {bulls.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                    Bulls: {bulls.join(', ')}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// RecordLinker — generic inner component (rendered inside a popup)
//
// Props:
//   fetchUnlinked   () => Promise<{ records: Array }>
//   fetchCandidates (record) => Promise<{ records: Array }>
//                   Given the selected unlinked record, returns candidate
//                   breeding records to display. Caller is responsible for
//                   using the right key (CowTag, DamTag, etc.)
//   saveLink        (unlinkedRecord, candidateRecord) => Promise<void>
//                   Called when the user confirms a link. Caller issues
//                   the correct PUT request.
//   renderRecord    (record) => { primary, secondary?, badge?, note? }
//                   Describes how to display each unlinked record in the
//                   left panel. All fields are strings or null.
//   candidateLabel  (record) => string
//                   Header text for the right panel, e.g. "Breeding records
//                   for dam 114". Receives the selected unlinked record.
//   noun            string — singular label, e.g. "pregnancy check"
//   onDone          () => void
// ---------------------------------------------------------------------------

export function RecordLinker({
    fetchUnlinked,
    fetchCandidates,
    saveLink,
    renderRecord,
    candidateLabel,
    CandidateComponent = BreedingRecordCandidate,
    noun,
    onDone,
}) {
    const [records,           setRecords]           = useState([]);
    const [loading,           setLoading]           = useState(true);
    const [selectedRecord,    setSelectedRecord]    = useState(null);
    const [candidates,        setCandidates]        = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [saving,            setSaving]            = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchUnlinked();
            setRecords(data.records || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const selectRecord = async (rec) => {
        setSelectedRecord(rec);
        setSelectedCandidate(null);
        setCandidates([]);
        setLoadingCandidates(true);
        try {
            const data = await fetchCandidates(rec);
            const sorted = (data.records || []).sort((a, b) =>
                new Date(b.ExposureStartDate) - new Date(a.ExposureStartDate)
            );
            setCandidates(sorted);
        } finally {
            setLoadingCandidates(false);
        }
    };

    const handleLink = async () => {
        if (!selectedRecord || !selectedCandidate || saving) return;
        setSaving(true);
        try {
            await saveLink(selectedRecord, selectedCandidate);
            const remaining = records.filter(r => r.ID !== selectedRecord.ID);
            setRecords(remaining);
            setSelectedRecord(null);
            setSelectedCandidate(null);
            setCandidates([]);
            if (remaining.length === 0) onDone?.();
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        const remaining = records.filter(r => r.ID !== selectedRecord.ID);
        setRecords(remaining);
        setSelectedRecord(null);
        setSelectedCandidate(null);
        setCandidates([]);
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading...</div>;
    }

    if (records.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#28a745' }}>
                    check_circle
                </span>
                <p style={{ marginTop: '12px', color: '#555', fontSize: '15px' }}>
                    All {noun}s are linked to a breeding record.
                </p>
                <button
                    onClick={onDone}
                    style={{
                        marginTop: '8px', padding: '8px 24px', fontSize: '14px',
                        backgroundColor: '#28a745', color: 'white',
                        border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '520px', width: '100%', overflow: 'hidden' }}>

            {/* Left panel — unlinked records */}
            <div style={{
                flex: '0 1 220px',
                minWidth: '170px', 
                maxWidth: '300px', 
                borderRight: '1px solid #eee',
                overflow: 'hidden',
                overflowY: 'auto',                             
                paddingTop: '10px',
                paddingBottom: '10px',
                paddingRight: '10px', 
                display: 'flex', flexDirection: 'column', gap: '4px'
            }}>
                <div style={{
                    fontSize: '11px', fontWeight: 'bold', color: '#888',
                    textTransform: 'uppercase', marginBottom: '6px'
                }}>
                    Unlinked {noun}s ({records.length})
                </div>

                {records.map(rec => {
                    const isSelected = selectedRecord?.ID === rec.ID;
                    const { primary, secondary, badge, note } = renderRecord(rec);

                    return (
                        <div
                            key={rec.ID}
                            onClick={() => selectRecord(rec)}
                            style={{
                                padding: '9px 11px', borderRadius: '5px', cursor: 'pointer',
                                border: `2px solid ${isSelected ? '#1976d2' : '#e0e0e0'}`,
                                backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '14px' }}>
                                    {primary}
                                </span>
                                {badge && (
                                    <span style={{
                                        fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                                        backgroundColor: badge.bg   || '#f5f5f5',
                                        color:           badge.color || '#666',
                                        border:          `1px solid ${badge.border || '#ddd'}`
                                    }}>
                                        {badge.label}
                                    </span>
                                )}
                            </div>
                            {secondary && (
                                <div style={{ fontSize: '12px', color: '#777', marginTop: '3px' }}>
                                    {secondary}
                                </div>
                            )}
                            {note && (
                                <div style={{
                                    fontSize: '11px', color: '#999', marginTop: '2px',
                                    fontStyle: 'italic', overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    {note}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Right panel — candidates */}
            <div style={{
                flex: 1, overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
            }}>
                {!selectedRecord ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>
                            arrow_back
                        </span>
                        Select a {noun} to see candidate breeding records
                    </div>
                ) : (
                    <>
                        <div style={{
                            marginBottom: '12px', 
                            padding: '10px',
                            backgroundColor: '#f5f5f5', borderRadius: '5px',
                            fontSize: '11px', fontWeight: 'bold', color: '#888',
                            textTransform: 'uppercase', flexShrink: 0
                        }}>
                            {candidateLabel(selectedRecord)}
                        </div>

                        {loadingCandidates ? (
                            <div style={{ flex: 1, color: '#888', fontSize: '13px', padding: '10px'}}>
                                Loading candidates...
                            </div>
                        ) : candidates.length === 0 ? (
                            <div style={{
                                flex: 1,
                                color: '#888', fontSize: '13px', padding: '20px',
                                textAlign: 'center', backgroundColor: '#fafafa',
                                borderRadius: '5px', border: '1px solid #eee'
                            }}>
                                No breeding records found. Create one first, then return here to link.
                            </div>
                        ) : (
                            <div style={{ Top: '12px', paddingBottom: '12px', paddingLeft: '10px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                {candidates.map(c => (
                                    <CandidateComponent
                                        key={c.ID}
                                        record={c}
                                        isSelected={selectedCandidate?.ID === c.ID}
                                        onClick={() => setSelectedCandidate(c)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Action bar — always visible when a record is selected */}
                        <div style={{
                            display: 'flex', gap: '8px', marginTop: '14px',
                            borderTop: '1px solid #eee', paddingTop: '12px', paddingLeft: '10px', flexShrink: 0
                        }}>
                            <button
                                onClick={handleLink}
                                disabled={!selectedCandidate || saving}
                                style={{
                                    flex: 1, padding: '9px', fontSize: '14px', fontWeight: 'bold',
                                    backgroundColor: selectedCandidate && !saving ? '#1976d2' : '#ccc',
                                    color: 'white', border: 'none', borderRadius: '4px',
                                    cursor: selectedCandidate && !saving ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {saving ? 'Saving...' : 'Confirm Link'}
                            </button>
                            <button
                                onClick={handleSkip}
                                style={{
                                    padding: '9px 18px', fontSize: '13px',
                                    backgroundColor: '#f5f5f5', color: '#555',
                                    border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                Skip
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// UnlinkedRecordsBubble — generic notification banner
//
// Props:
//   fetchUnlinked   () => Promise<{ records: Array }>
//                   Same function passed to RecordLinker — used here just
//                   to get the count.
//   noun            string — singular, e.g. "pregnancy check"
//   nounPlural      string — e.g. "pregnancy checks"
//   popupTitle      string — title shown in the popup header
//   onRefresh       () => void — called when popup closes
//   ...rest         remaining props forwarded directly to RecordLinker
// ---------------------------------------------------------------------------

export function UnlinkedRecordsBubble({
    fetchUnlinked,
    noun,
    nounPlural,
    popupTitle,
    onRefresh,
    ...linkerProps
}) {
    const [count,     setCount]     = useState(0);
    const [popupOpen, setPopupOpen] = useState(false);

    useEffect(() => {
        fetchUnlinked()
            .then(d => setCount((d.records || []).length))
            .catch(() => {});
    }, []);

    if (count === 0) return null;

    const close = () => { setPopupOpen(false); onRefresh?.(); };

    return (
        <>
            <div
                className="bubble-container"
                style={{ borderColor: '#f0ad4e', padding: 0, marginBottom: '16px' }}
            >
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', backgroundColor: '#fff8ee', borderRadius: '5px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#f0ad4e', fontSize: '20px' }}>
                            link_off
                        </span>
                        <div>
                            <span style={{ fontWeight: 'bold', color: '#7a5000', fontSize: '14px' }}>
                                {count} {count === 1 ? noun : nounPlural} not linked to a breeding record
                            </span>
                            <div style={{ fontSize: '12px', color: '#a07030', marginTop: '1px' }}>
                                These were likely imported before breeding records were created
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setPopupOpen(true)}
                        style={{
                            padding: '7px 16px', fontSize: '13px', fontWeight: 'bold',
                            backgroundColor: '#f0ad4e', color: '#000',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0
                        }}
                    >
                        Fix now
                    </button>
                </div>
            </div>

            <Popup isOpen={popupOpen} onClose={close} title={popupTitle} width="840px">
                <RecordLinker
                    {...linkerProps}
                    fetchUnlinked={fetchUnlinked}
                    noun={noun}
                    onDone={() => { close(); setCount(0); }}
                />
            </Popup>
        </>
    );
}