import React, { useState, useEffect, useCallback } from 'react';
import Form, { fmtDate } from './forms';
import { toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';
import '../screenSizing.css';

const PENDING_RESULTS = new Set(['Untested', 'Awaiting Results', 'Retest', '', null, undefined]);

const RESULT_TO_BREEDING_STATUS = {
    Pregnant:  'Pregnant',
    Open:      'Open',
    Unexposed: 'Open',
};

const RESULT_COLOR = {
    'Pregnant':         '#2e7d32',
    'Open':             '#c62828',
    'Retest':           '#e65100',
    'Awaiting Results': '#1565c0',
    'Unexposed':        '#6c757d',
    'Untested':         '#adb5bd',
};
const RESULT_BG = {
    'Pregnant':         '#e8f5e9',
    'Open':             '#ffebee',
    'Retest':           '#fff3e0',
    'Awaiting Results': '#e3f2fd',
    'Unexposed':        '#f5f5f5',
    'Untested':         '#f8f9fa',
};

const TH = {
    padding: '8px 10px', textAlign: 'left', fontWeight: '600',
    color: '#495057', backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap', fontSize: '12px',
};
const TD = { padding: '7px 10px', borderBottom: '1px solid #dee2e6', fontSize: '13px' };

function PregCheckHistoricalTable({ planId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    useEffect(() => {
        if (!planId) return;
        setLoading(true);
        setError(null);
        fetch(`/api/pregnancy-checks?planId=${planId}`, { credentials: 'include' })
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
                    No pregnancy check records for this plan yet.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Cow', 'Check Date', 'Test Type', 'Result', 'Fetus Sex', 'Months Preg.', 'Calving Alert', 'Notes'].map(h => (
                                    <th key={h} style={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r, i) => (
                                <tr key={r.ID} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                    <td style={{ ...TD, fontWeight: '600' }}>{r.CowTag}</td>
                                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.PregCheckDate ? toLocalDisplay(r.PregCheckDate) : '—'}</td>
                                    <td style={TD}>{r.TestType || '—'}</td>
                                    <td style={TD}>
                                        {r.TestResults ? (
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '500',
                                                backgroundColor: RESULT_BG[r.TestResults]  || '#e9ecef',
                                                color:           RESULT_COLOR[r.TestResults] || '#495057',
                                                border: `1px solid ${RESULT_COLOR[r.TestResults] || '#dee2e6'}44`,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {r.TestResults}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td style={TD}>{r.FetusSex || '—'}</td>
                                    <td style={TD}>{r.MonthsPregnant != null ? `${r.MonthsPregnant} mo` : '—'}</td>
                                    <td style={{ ...TD, textAlign: 'center' }}>
                                        {r.CalvingAlert
                                            ? <span style={{ color: '#dc3545', fontSize: '16px' }}>●</span>
                                            : <span style={{ color: '#dee2e6', fontSize: '16px' }}>○</span>
                                        }
                                    </td>
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

function PregCheck({ breedingPlanId, breedingYear }) {
    const [rows,        setRows]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [submitting,  setSubmitting]  = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [savedCount,  setSavedCount]  = useState(null);
    const [dropdowns,   setDropdowns]   = useState({ pregTestResults: [], pregTestTypes: [], sex: [] });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : {})
            .then(d => setDropdowns({
                pregTestResults: d.pregTestResults || [],
                pregTestTypes:   d.pregTestTypes   || [],
                sex: d.sexes || [],
            }))
            .catch(() => {});
    }, []);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url;
            if (breedingPlanId) {
                url = `/api/breeding-records?planId=${breedingPlanId}&breedingStatus=Active`;
            } else {
                url = `/api/breeding-records?breedingStatus=Active&newestOnly=true`;
            }
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

    const columns = [
        {
            key:     'CowTag',
            label:   'Cow',
            display: 'bold',
        },
        {
            key:    'LastBreeding',
            label:  'Breeding Record',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
                    {fmtDate(row.ExposureStartDate)}
                    {row.ExposureEndDate
                        ? <span style={{ color: '#aaa' }}> – {fmtDate(row.ExposureEndDate)}</span>
                        : null
                    }
                </span>
            ),
        },
        {
            key:    'Exposure',
            label:  'Exposure',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555' }}>
                    {(row.PrimaryBulls || []).map(b => b.tag).join(', ') || '—'}
                </span>
            ),
        },
        { key: 'checkDate',      label: 'Check Date *',  type: 'date',     minWidth: '118px' },
        { key: 'testResults',    label: 'Test Result *',       type: 'select',   options: dropdowns.pregTestResults, minWidth: '128px' },
        { key: 'testType',       label: 'Test Type',      type: 'select',   options: dropdowns.pregTestTypes,   minWidth: '108px' },
        { key: 'monthsPregnant', label: 'Months Preg.',     type: 'number',   width: '80px', step: '0.5', min: '0', placeholder: 'mo' },
        { key: 'fetusSex',       label: 'Fetus Sex',      type: 'select',   options: dropdowns.sex, minWidth: '80px' },
        { key: 'calvingAlert',   label: 'Alert',          type: 'checkbox', thStyle: { textAlign: 'center' }, tdStyle: { textAlign: 'center' } },
        { key: 'notes',          label: 'Notes',          type: 'text',     maxLength: 256, placeholder: 'Notes...', minWidth: '140px' },
    ];

    const prefillFields = [
        { key: 'checkDate',   label: 'Check Date',       type: 'date'   },
        { key: 'testType',    label: 'Test Type',         type: 'select', options: dropdowns.pregTestTypes   },
        { key: 'testResults', label: 'Pregnancy Status',  type: 'select', options: dropdowns.pregTestResults },
    ];

    const handleSubmit = async (rows, rowData) => {
        const today = toLocalInput(new Date().toISOString());

        const toSubmit = rows
            .map(r => ({ record: r, value: rowData[r.ID != null ? String(r.ID) : String(r.CowTag)] || {} }))
            .filter(({ value }) => value.checkDate || value.testResults);

        if (toSubmit.length === 0) {
            setSubmitError('Fill in at least one row before saving.');
            return;
        }

        setSubmitting(true);
        setSubmitError(null);
        setSavedCount(null);

        try {
            const payload = toSubmit.map(({ record, value }) => ({
                cowTag: record.CowTag,
                fields: {
                    PlanID:           breedingPlanId ?? record.PlanID ?? null,
                    BreedingRecordID: record.ID      ?? null,
                    PregCheckDate:    toUTC(value.checkDate || today),
                    TestType:         value.testType       || null,
                    TestResults:      value.testResults    || 'Untested',
                    FetusSex:         value.fetusSex       || null,
                    MonthsPregnant:   value.monthsPregnant ? parseFloat(value.monthsPregnant) : null,
                    CalvingAlert:     value.calvingAlert   ?? false,
                    Notes:            value.notes          || null,
                },
            }));

            const res = await fetch('/api/pregnancy-checks', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            // Sync BreedingStatus on records that have a final result
            const statusPatches = toSubmit
                .filter(({ record, value }) => record.ID && RESULT_TO_BREEDING_STATUS[value.testResults])
                .map(({ record, value }) =>
                    fetch(`/api/breeding-records/${record.ID}`, {
                        method:      'PUT',
                        headers:     { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body:        JSON.stringify({ BreedingStatus: RESULT_TO_BREEDING_STATUS[value.testResults] }),
                    })
                );
            await Promise.all(statusPatches);

            setSavedCount(toSubmit.length);
            await fetchRows();
        } catch (e) {
            setSubmitError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const headerContent = (
        <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
            {breedingPlanId
                ? `Cows with active breeding records for plan ${breedingYear || breedingPlanId}`
                : 'All cows with active breeding records pending a pregnancy check'
            }
        </div>
    );

    return (
        <>
            <Form
                title="Pregnancy Check"
                headerContent={headerContent}
                rows={rows}
                columns={columns}
                prefillFields={prefillFields}
                onSubmit={handleSubmit}
                submitLabel="Create Pregnancy Checks"
                submitting={submitting}
                savedCount={savedCount}
                submitError={submitError}
                loading={loading}
                error={error}
                onRetry={fetchRows}
                showImportButton={true}
            />

            {breedingPlanId && (
                <PregCheckHistoricalTable planId={breedingPlanId} />
            )}
        </>
    );
}

export default PregCheck;