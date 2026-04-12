import React, { useState, useEffect, useCallback } from 'react';
import Form, { fmtDate } from './forms';
import { toUTC, toLocalDisplay } from '../utils/dateUtils';
import '../screenSizing.css';

// ─── Style constants (mirror pregCheck) ──────────────────────────────────────

const TH = {
    padding: '8px 10px', textAlign: 'left', fontWeight: '600',
    color: '#495057', backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap', fontSize: '12px',
};
const TD = { padding: '7px 10px', borderBottom: '1px solid #dee2e6', fontSize: '13px' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate) {
    if (!birthDate) return '—';
    const days = Math.floor((Date.now() - new Date(birthDate)) / 86_400_000);
    return `${days}d`;
}

// ─── Historical records table (plan-scoped, mirrors PregCheckHistoricalTable) ─

function WeaningHistoricalTable({ planId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    useEffect(() => {
        if (!planId) return;
        setLoading(true);
        setError(null);
        fetch(`/api/weaning-records?planId=${planId}`, { credentials: 'include' })
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
                Plan Weaning Records
                <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 'normal', color: '#888' }}>
                    ({records.length})
                </span>
            </h3>

            {records.length === 0 ? (
                <div style={{ padding: '12px 0', color: '#888', fontStyle: 'italic', fontSize: '13px' }}>
                    No weaning records for this plan yet.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Calf', 'Weaning Date', 'Weight (lbs)', 'Notes'].map(h => (
                                    <th key={h} style={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r, i) => (
                                <tr key={r.ID} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                    <td style={{ ...TD, fontWeight: '600' }}>{r.CowTag}</td>
                                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.WeaningDate ? toLocalDisplay(r.WeaningDate) : '—'}</td>
                                    <td style={TD}>{r.WeaningWeight != null ? r.WeaningWeight : '—'}</td>
                                    <td style={{ ...TD, color: '#6c757d', maxWidth: '200px' }}>{r.Notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

/*
 * Depends on:
 *   GET /api/unweaned-calves?planId=X
 *       Joins CalvingRecords + BreedingRecords, left-joins WeaningRecords,
 *       returns calves where no WeaningRecord exists yet.
 *       Response: { records: [{
 *           ID,           -- CalvingRecords.ID (used as rowKey)
 *           PlanID,
 *           CalfTag,
 *           CalfSex,
 *           BirthDate,    -- 'yyyy-MM-dd'
 *           DamTag,
 *           IsAI,         -- bool
 *           Sire,         -- string, from BreedingRecords.PrimaryBulls (first bull tag)
 *           Pasture,      -- from BreedingRecords.Pasture
 *       }] }
 *
 *   POST /api/weaning-records   -- batch array, handled by createWeaningRecord
 *   GET  /api/weaning-records?planId=X  -- for the historical table
 */

function WeanlingTracker({ breedingPlanId, breedingYear }) {
    const [rows,        setRows]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [submitting,  setSubmitting]  = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [savedCount,  setSavedCount]  = useState(null);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = breedingPlanId
                ? `/api/unweaned-calves?planId=${breedingPlanId}`
                : `/api/unweaned-calves`;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            setRows(data.records || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [breedingPlanId]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // ── Column definitions ──────────────────────────────────────────────────

    const columns = [
        {
            key:     'CalfTag',
            label:   'Calf',
            display: 'bold',
        },
        {
            key:    'CalfSex',
            label:  'Sex',
            render: row => (
                <span style={{ fontSize: '12px' }}>
                    {row.CalfSex || <span style={{ color: '#dc3545' }}>No Sex</span>}
                </span>
            ),
        },
        {
            key:    'BirthDate',
            label:  'Birth & Age',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
                    {fmtDate(row.BirthDate)}
                    <span style={{ color: '#aaa', marginLeft: '6px' }}>{calcAge(row.BirthDate)}</span>
                </span>
            ),
        },
        {
            key:    'IsAI',
            label:  'Conc.',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555' }}>
                    {row.IsAI ? 'AI' : 'NS'}
                </span>
            ),
        },
        {
            key:    'DamTag',
            label:  'Dam',
            render: row => <span style={{ fontSize: '12px' }}>{row.DamTag || '—'}</span>,
        },
        {
            key:    'Sire',
            label:  'Sire',
            render: row => <span style={{ fontSize: '12px' }}>{row.Sire || '—'}</span>,
        },
        {
            key:    'Pasture',
            label:  'Pasture',
            render: row => <span style={{ fontSize: '12px' }}>{row.Pasture || '—'}</span>,
        },
        {
            key:      'weaningDate',
            label:    'Date *',
            type:     'date',
            minWidth: '118px',
        },
        {
            key:         'weaningWeight',
            label:       'Weight (lbs)',
            type:        'number',
            width:       '75px',
            step:        '1',
            min:         '0',
            placeholder: 'lbs',
        },
        {
            key:         'notes',
            label:       'Notes',
            type:        'text',
            maxLength:   256,
            placeholder: 'Notes...',
            minWidth:    '140px',
        },
    ];

    // ── Prefill fields ──────────────────────────────────────────────────────

    const prefillFields = [
        { key: 'weaningDate', label: 'Weaning Date', type: 'date' },
    ];

    // ── Submit ──────────────────────────────────────────────────────────────

    const handleSubmit = async (rows, rowData) => {
        const toSubmit = rows
            .map(r => ({ record: r, value: rowData[String(r.ID)] || {} }))
            .filter(({ value }) => value.weaningDate);

        if (toSubmit.length === 0) {
            setSubmitError('Enter a weaning date for at least one calf before saving.');
            return;
        }

        setSubmitting(true);
        setSubmitError(null);
        setSavedCount(null);

        try {
            const payload = toSubmit.map(({ record, value }) => ({
                planId:          breedingPlanId ?? record.PlanID ?? null,
                cowTag:          record.CalfTag,
                weaningDate:     toUTC(value.weaningDate),
                weaningWeight:   value.weaningWeight ? parseInt(value.weaningWeight) : null,
                notes:           value.notes || null,
                calvingRecordId: record.ID,
            }));

            const res = await fetch('/api/weaning-records', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            setSavedCount(toSubmit.length);
            await fetchRows();
        } catch (e) {
            setSubmitError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Header ──────────────────────────────────────────────────────────────

    const headerContent = (
        <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
            {breedingPlanId
                ? `Unweaned calves from plan ${breedingYear || breedingPlanId}`
                : 'All unweaned calves'
            }
        </div>
    );

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <>
            <Form
                title="Weanling Tracker"
                headerContent={headerContent}
                rows={rows}
                columns={columns}
                prefillFields={prefillFields}
                onSubmit={handleSubmit}
                submitLabel="Record Weanings"
                submitting={submitting}
                savedCount={savedCount}
                submitError={submitError}
                loading={loading}
                error={error}
                onRetry={fetchRows}
                showImportButton={true}
            />

            {breedingPlanId && (
                <WeaningHistoricalTable planId={breedingPlanId} />
            )}
        </>
    );
}

export default WeanlingTracker;