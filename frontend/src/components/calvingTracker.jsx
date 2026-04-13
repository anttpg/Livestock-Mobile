import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Form, { fmtDate, addDays } from './forms';
import { toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';
import AddAnimal from './addAnimal';
import Popup from './popup';
import PopupConfirm from './popupConfirm';
import AnimalFolder from './animalFolder';
import '../screenSizing.css';

const DEFAULT_GESTATION_DAYS = 283;

const TH = {
    padding: '8px 10px', textAlign: 'left', fontWeight: '600',
    color: '#495057', backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap', fontSize: '12px',
};
const TD = { padding: '7px 10px', borderBottom: '1px solid #dee2e6', fontSize: '13px' };

function outcomeLabel(r) {
    if (r.EmbryoAborted)   return { text: 'Aborted',       bg: '#fff3e0', color: '#e65100' };
    if (r.DamDiedAtBirth)  return { text: 'Dam Lost',      bg: '#ffebee', color: '#c62828' };
    if (r.CalfDiedAtBirth) return { text: 'Calf Lost',     bg: '#fce4ec', color: '#ad1457' };
    if (!r.CalfTag)        return { text: 'No Calf',       bg: '#f5f5f5', color: '#757575' };
    return                        { text: 'Calf Recorded', bg: '#e8f5e9', color: '#2e7d32' };
}

function CalvingHistoricalTable({ planId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    useEffect(() => {
        if (!planId) return;
        setLoading(true);
        setError(null);
        fetch(`/api/calving-records?planId=${planId}`, { credentials: 'include' })
            .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
            .then(d  => setRecords(d.records || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [planId]);

    if (loading) return <div style={{ padding: '12px 0', color: '#888', fontSize: '13px' }}>Loading records...</div>;
    if (error)   return <div style={{ padding: '12px 0', color: '#dc3545', fontSize: '13px' }}>Failed to load records: {error}</div>;

    return (
        <div className="bubble-container" style={{ marginTop: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600' }}>
                Plan Records
                <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 'normal', color: '#888' }}>
                    ({records.length})
                </span>
            </h3>

            {records.length === 0 ? (
                <div style={{ padding: '12px 0', color: '#888', fontStyle: 'italic', fontSize: '13px' }}>
                    No calving records for this plan yet.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Dam', 'Calf Tag', 'Birth Date', 'Sex', 'Outcome', 'Notes'].map(h => (
                                    <th key={h} style={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r, i) => {
                                const outcome = outcomeLabel(r);
                                return (
                                    <tr key={r.ID} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                        <td style={{ ...TD, fontWeight: '600' }}>{r.DamTag || '—'}</td>
                                        <td style={TD}>{r.CalfTag || '—'}</td>
                                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.BirthDate ? toLocalDisplay(r.BirthDate) : '—'}</td>
                                        <td style={TD}>{r.CalfSex || '—'}</td>
                                        <td style={TD}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '500',
                                                backgroundColor: outcome.bg, color: outcome.color,
                                                border: `1px solid ${outcome.color}44`, whiteSpace: 'nowrap',
                                            }}>
                                                {outcome.text}
                                            </span>
                                        </td>
                                        <td style={{ ...TD, color: '#6c757d', maxWidth: '220px' }}>{r.CalvingNotes || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function CalvingTracker({ breedingPlanId, breedingYear }) {
    const [rows,              setRows]              = useState([]);
    const [loading,           setLoading]           = useState(true);
    const [error,             setError]             = useState(null);
    const [showAddAnimal,     setShowAddAnimal]     = useState(false);
    const [showAnimalPopup,   setShowAnimalPopup]   = useState(false);
    const [showNoCalfConfirm, setShowNoCalfConfirm] = useState(false);
    const [selectedMother,    setSelectedMother]    = useState(null);
    const [selectedFather,    setSelectedFather]    = useState(null);
    const [selectedAnimalTag, setSelectedAnimalTag] = useState(null);
    const [noCalfRow,         setNoCalfRow]         = useState(null);
    const [noCalfSaving,      setNoCalfSaving]      = useState(false);
    const [, setSearchParams] = useSearchParams();

    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url;
            if (breedingPlanId) {
                url = `/api/breeding-records?planId=${breedingPlanId}&breedingStatus=Pregnant`;
            } else {
                url = `/api/breeding-records?breedingStatus=Pregnant&newestOnly=true`;
            }
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();

            // Attach calculated due date to each record
            const withDue = (data.records || []).map(r => ({
                ...r,
                dueDate: r.ExposureStartDate
                    ? addDays(r.ExposureStartDate, DEFAULT_GESTATION_DAYS)
                    : null,
            }));
            setRows(withDue);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [breedingPlanId]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const handleAddCalf = (row) => {
        setSelectedMother(row.CowTag);
        setSelectedFather((row.PrimaryBulls || [])[0]?.tag || '');
        setShowAddAnimal(true);
    };

    const handleViewAnimal = (calfTag) => {
        setSelectedAnimalTag(calfTag);
        setSearchParams({ search: calfTag, tab: 'general' });
        setShowAnimalPopup(true);
    };

    const handleNoCalfClick = (row) => {
        setNoCalfRow(row);
        setShowNoCalfConfirm(true);
    };

    const handleNoCalfConfirm = async () => {
        if (!noCalfRow) return;
        setNoCalfSaving(true);
        try {
            await fetch('/api/calving-records', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    planID:           breedingPlanId ?? noCalfRow.PlanID ?? null,
                    breedingRecordId: noCalfRow.ID   ?? null,
                    damTag:           noCalfRow.CowTag,
                    isTagged:         false,
                    calfTag:          null,
                    birthDate:        toUTC(toLocalInput(new Date().toISOString())),
                    calfDiedAtBirth:  false,
                    damDiedAtBirth:   false,
                    embryoAborted:    false,
                    notes:            'No calf — recorded via calving tracker',
                }),
            });

            if (noCalfRow.ID) {
                await fetch(`/api/breeding-records/${noCalfRow.ID}`, {
                    method:      'PUT',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body:        JSON.stringify({ BreedingStatus: 'Calved' }),
                });
            }

            setShowNoCalfConfirm(false);
            setNoCalfRow(null);
            fetchRows();
        } catch (e) {
            console.error('No Calf save error:', e);
        } finally {
            setNoCalfSaving(false);
        }
    };

    const columns = [
        { key: 'CowTag',  label: 'Cow',     display: 'bold' },
        { key: 'Pasture', label: 'Pasture'  },
        {
            key:    'dueDate',
            label:  'Due Date',
            render: row => (
                <span style={{ whiteSpace: 'nowrap' }}>
                    {row.dueDate ? fmtDate(row.dueDate) : '—'}
                </span>
            ),
        },
        {
            key:    'Method',
            label:  'Method',
            render: row => row.IsAI ? 'AI' : 'NS',
        },
        {
            key:    'Exposure',
            label:  'Exposure',
            render: row => (row.PrimaryBulls || []).map(b => b.tag).join(', ') || '—',
        },
        {
            key:    '_actions',
            label:  '',
            render: row => {
                const calfTag = row.CalfTag || '';
                return (
                    <div style={{ display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
                        <button
                            onClick={() => calfTag.trim() ? handleViewAnimal(calfTag) : handleAddCalf(row)}
                            style={{
                                padding: '5px 10px',
                                backgroundColor: calfTag.trim() ? '#3bb558' : '#007bff',
                                color: 'white', border: 'none', borderRadius: '4px',
                                cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                            }}
                        >
                            {calfTag.trim() ? `View ${calfTag}` : '+ Add Calf'}
                        </button>

                        {!calfTag.trim() && (
                            <button
                                onClick={() => handleNoCalfClick(row)}
                                style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#dc3545',
                                    color: 'white', border: 'none', borderRadius: '4px',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                                }}
                            >
                                No Calf
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    const headerContent = (
        <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
            {breedingPlanId
                ? `Confirmed pregnancies for plan ${breedingYear || breedingPlanId}`
                : 'All confirmed pregnancies pending calving'
            }
        </div>
    );

    const refresh = () => {
        setShowAddAnimal(false);
        setSelectedMother(null);
        setSelectedFather(null);
        fetchRows();
    };

    return (
        <>
            <Form
                title="Calving Tracker"
                headerContent={headerContent}
                rows={rows}
                columns={columns}
                loading={loading}
                error={error}
                onRetry={fetchRows}
                showImportButton={true}
            />

            {breedingPlanId && (
                <CalvingHistoricalTable planId={breedingPlanId} />
            )}

            <Popup
                isOpen={showAddAnimal}
                onClose={() => { setShowAddAnimal(false); setSelectedMother(null); setSelectedFather(null); }}
                title="Add Calf"
                maxWidth="800px"
                maxHeight="100vh"
            >
                <AddAnimal
                    motherTag={selectedMother}
                    fatherTag={selectedFather}
                    showTwinsOption={true}
                    onClose={() => { setShowAddAnimal(false); setSelectedMother(null); setSelectedFather(null); }}
                    onSuccess={refresh}
                    createCalvingRecord={true}
                    breedingYear={breedingYear}
                />
            </Popup>

            <Popup
                isOpen={showAnimalPopup}
                onClose={() => setShowAnimalPopup(false)}
                title={`Animal Details — ${selectedAnimalTag}`}
                fullscreen={true}
            >
                <AnimalFolder />
            </Popup>

            <PopupConfirm
                isOpen={showNoCalfConfirm}
                onClose={() => { setShowNoCalfConfirm(false); setNoCalfRow(null); }}
                onConfirm={handleNoCalfConfirm}
                title="No Calf"
                message={`Record that <strong>${noCalfRow?.CowTag}</strong> had no calf this cycle?<br/><br/>This will close the breeding record and return her to the breeding planner.`}
                confirmText={noCalfSaving ? 'Saving...' : 'Confirm — No Calf'}
            />
        </>
    );
}

export default CalvingTracker;