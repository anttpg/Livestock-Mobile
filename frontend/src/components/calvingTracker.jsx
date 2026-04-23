import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Form, { fmtDate, addDays } from './forms';
import { toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';
import AddAnimal from './addAnimal';
import Popup from './popup';
import PopupConfirm from './popupConfirm';
import AnimalFolder from './animalFolder';
import AnimalCombobox from './animalCombobox';
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

// ─── CalvingHistoricalTable ───────────────────────────────────────────────────
// Uses Form with onDelete so all delete state, confirm popup, and delete-mode
// toggle are handled by the shared Form infrastructure.

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

    const handleDelete = async (row) => {
        await fetch(`/api/calving-records/${row.ID}`, {
            method:      'DELETE',
            credentials: 'include',
        });
        setRecords(prev => prev.filter(r => r.ID !== row.ID));
    };

    const columns = [
        {
            key:     'DamTag',
            label:   'Dam',
            display: 'bold',
        },
        {
            key:    'CalfTag',
            label:  'Calf Tag',
            render: row => row.CalfTag || '—',
        },
        {
            key:    'BirthDate',
            label:  'Birth Date',
            render: row => row.BirthDate ? toLocalDisplay(row.BirthDate) : '—',
        },
        {
            key:    'CalfSex',
            label:  'Sex',
            render: row => row.CalfSex || '—',
        },
        {
            key:    'outcome',
            label:  'Outcome',
            render: row => {
                const o = outcomeLabel(row);
                return (
                    <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '500',
                        backgroundColor: o.bg, color: o.color,
                        border: `1px solid ${o.color}44`, whiteSpace: 'nowrap',
                    }}>
                        {o.text}
                    </span>
                );
            },
        },
        {
            key:     'CalvingNotes',
            label:   'Notes',
            tdStyle: { color: '#6c757d', maxWidth: '220px' },
        },
    ];

    return (
        <Form
            title={`Plan Records (${records.length})`}
            rows={records}
            columns={columns}
            loading={loading}
            error={error}
            onDelete={handleDelete}
        />
    );
}

// ─── LinkExistingCalfPopup ────────────────────────────────────────────────────

function LinkExistingCalfPopup({ row, breedingPlanId, onClose, onSuccess }) {
    const [calfTag,  setCalfTag]  = useState('');
    const [animals,  setAnimals]  = useState([]);
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState(null);

    useEffect(() => {
        fetch('/api/animals', { credentials: 'include' })
            .then(r => r.ok ? r.json() : { cows: [] })
            .then(d => setAnimals(d.cows || []))
            .catch(() => {});
    }, []);

    const comboOptions = animals.map(a => ({
        name:   a.CowTag,
        value:  a.CowTag,
        status: a.Status || '',
    }));

    const handleConfirm = async () => {
        const tag = calfTag.trim().toUpperCase();
        if (!tag) return;
        setSaving(true);
        setError(null);
        try {
            const animal    = animals.find(a => a.CowTag === tag);
            const birthDate = animal?.DateOfBirth
                ? toUTC(toLocalInput(animal.DateOfBirth))
                : null;

            await fetch('/api/calving-records', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    planID:           breedingPlanId ?? row.PlanID ?? null,
                    breedingRecordId: row.ID         ?? null,
                    damTag:           row.CowTag,
                    isTagged:         true,
                    calfTag:          tag,
                    birthDate,
                    calfSex:          animal?.Sex ?? null,
                    calfDiedAtBirth:  false,
                    damDiedAtBirth:   false,
                    embryoAborted:    false,
                    notes:            'Linked existing calf',
                }),
            });
            if (row.ID) {
                await fetch(`/api/breeding-records/${row.ID}`, {
                    method:      'PUT',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body:        JSON.stringify({ BreedingStatus: 'Calved' }),
                });
            }
            onSuccess();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '16px', minWidth: '320px' }}>
            <p style={{ marginTop: 0, fontSize: '14px' }}>
                Select the existing calf to link to <strong>{row?.CowTag}</strong>:
            </p>
            <AnimalCombobox
                options={comboOptions}
                value={calfTag}
                onChange={v => setCalfTag(v.toUpperCase())}
                onSelect={v => { if (v) setCalfTag(v.toUpperCase()); }}
                placeholder="Search calf tag..."
                allowCustomValue={true}
            />
            {error && <div style={{ color: '#dc3545', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ padding: '7px 16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px', background: 'white' }}>
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!calfTag.trim() || saving}
                    style={{
                        padding: '7px 16px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                        backgroundColor: calfTag.trim() && !saving ? '#1976d2' : '#aaa',
                        color: 'white', fontWeight: 'bold',
                    }}
                >
                    {saving ? 'Saving...' : 'Link Calf'}
                </button>
            </div>
        </div>
    );
}

// ─── UnexpectedEntryPopup ─────────────────────────────────────────────────────

function UnexpectedEntryPopup({ breedingPlanId, onClose, onSuccess }) {
    const [checks,       setChecks]       = useState([]);
    const [selectedTags, setSelectedTags] = useState(new Set());
    const [loading,      setLoading]      = useState(true);
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState(null);

    useEffect(() => {
        const url = breedingPlanId
            ? `/api/pregnancy-checks?planId=${breedingPlanId}`
            : `/api/pregnancy-checks`;
        fetch(url, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { records: [] })
            .then(d => {
                const nonPregnant = (d.records || []).filter(r => r.TestResults !== 'Pregnant');
                // Dedupe by CowTag, keep most recent per cow
                const seen = new Set();
                const unique = nonPregnant.filter(r => {
                    if (seen.has(r.CowTag)) return false;
                    seen.add(r.CowTag);
                    return true;
                });
                setChecks(unique);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [breedingPlanId]);

    const toggle = (tag) => {
        setSelectedTags(prev => {
            const next = new Set(prev);
            next.has(tag) ? next.delete(tag) : next.add(tag);
            return next;
        });
    };

    const handleConfirm = async () => {
        if (selectedTags.size === 0) return;
        setSaving(true);
        setError(null);
        try {
            const selected = checks.filter(pc => selectedTags.has(pc.CowTag));
            await Promise.all(selected.map(pc =>
                fetch('/api/calving-records', {
                    method:      'POST',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        planID:           breedingPlanId ?? pc.PlanID ?? null,
                        breedingRecordId: pc.BreedingRecordID ?? null,
                        damTag:           pc.CowTag,
                        isTagged:         false,
                        calfTag:          null,
                        birthDate:        null,
                        calfDiedAtBirth:  false,
                        damDiedAtBirth:   false,
                        embryoAborted:    false,
                        notes:            'Unexpected calving entry',
                    }),
                })
            ));
            // Build synthetic rows so they appear in the table immediately
            const newRows = selected.map(pc => ({
                CowTag:            pc.CowTag,
                PlanID:            breedingPlanId ?? pc.PlanID ?? null,
                ID:                pc.BreedingRecordID ?? null,
                PrimaryBulls:      [],
                Pasture:           null,
                ExposureStartDate: null,
                dueDate:           null,
                CalfTag:           '',
            }));
            onSuccess(newRows);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '16px', minWidth: '320px' }}>
            <p style={{ marginTop: 0, fontSize: '14px', color: '#555' }}>
                Select cows with non-pregnant preg check results to add as unexpected calving entries:
            </p>
            {loading ? (
                <div style={{ color: '#888', fontStyle: 'italic' }}>Loading...</div>
            ) : checks.length === 0 ? (
                <div style={{ color: '#888', fontStyle: 'italic' }}>No non-pregnant preg check records found.</div>
            ) : (
                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                    {checks.map(pc => (
                        <label
                            key={pc.CowTag}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                                backgroundColor: selectedTags.has(pc.CowTag) ? '#e3f2fd' : 'white',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedTags.has(pc.CowTag)}
                                onChange={() => toggle(pc.CowTag)}
                            />
                            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{pc.CowTag}</span>
                            {pc.TestResults && (
                                <span style={{ fontSize: '12px', color: '#888' }}>{pc.TestResults}</span>
                            )}
                        </label>
                    ))}
                </div>
            )}
            {error && <div style={{ color: '#dc3545', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '7px 16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px', background: 'white' }}>
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={selectedTags.size === 0 || saving}
                    style={{
                        padding: '7px 16px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                        backgroundColor: selectedTags.size > 0 && !saving ? '#28a745' : '#aaa',
                        color: 'white', fontWeight: 'bold',
                    }}
                >
                    {saving ? 'Saving...' : `Add ${selectedTags.size} Entr${selectedTags.size === 1 ? 'y' : 'ies'}`}
                </button>
            </div>
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
    const [showLinkPopup,     setShowLinkPopup]     = useState(false);
    const [linkRow,           setLinkRow]           = useState(null);
    const [showUnexpectedPopup, setShowUnexpectedPopup] = useState(false);
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

    const handleLinkCalfClick = (row) => {
        setLinkRow(row);
        setShowLinkPopup(true);
    };

    const handleUnexpectedAdded = (newRows) => {
        setRows(prev => [...prev, ...newRows]);
        setShowUnexpectedPopup(false);
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
                                onClick={() => handleLinkCalfClick(row)}
                                style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#6c757d',
                                    color: 'white', border: 'none', borderRadius: '4px',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                                }}
                            >
                                Link Existing
                            </button>
                        )}

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
            >
                <div style={{ marginTop: '12px', borderTop: '1px solid #e9ecef', paddingTop: '12px' }}>
                    <button
                        onClick={() => setShowUnexpectedPopup(true)}
                        style={{
                            padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
                            border: '1px solid #6c757d', borderRadius: '4px',
                            background: 'white', color: '#495057',
                        }}
                    >
                        + Add Unexpected Entry
                    </button>
                </div>
            </Form>

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

            <Popup
                isOpen={showLinkPopup}
                onClose={() => { setShowLinkPopup(false); setLinkRow(null); }}
                title={`Link Existing Calf — ${linkRow?.CowTag}`}
            >
                {linkRow && (
                    <LinkExistingCalfPopup
                        row={linkRow}
                        breedingPlanId={breedingPlanId}
                        onClose={() => { setShowLinkPopup(false); setLinkRow(null); }}
                        onSuccess={() => { setShowLinkPopup(false); setLinkRow(null); fetchRows(); }}
                    />
                )}
            </Popup>

            <Popup
                isOpen={showUnexpectedPopup}
                onClose={() => setShowUnexpectedPopup(false)}
                title="Add Unexpected Calving Entry"
            >
                <UnexpectedEntryPopup
                    breedingPlanId={breedingPlanId}
                    onClose={() => setShowUnexpectedPopup(false)}
                    onSuccess={handleUnexpectedAdded}
                />
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