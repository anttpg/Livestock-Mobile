import React, { useState, useEffect, useCallback } from 'react';
import Form, { fmtDate } from './forms';
import { toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';
import PopupConfirm from './popupConfirm';
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

function formatBulls(bulls) {
    if (!bulls) return '—';
    if (Array.isArray(bulls)) return bulls.map(b => b.tag || b).join(', ') || '—';
    if (typeof bulls === 'string') return bulls || '—';
    return '—';
}

// Column definitions for the historical table. Keys match the hidable column keys
// used in the entry form so that the same visibility settings apply to both.
const HIST_COLUMNS = [
    { key: 'cow',            label: 'Cow' },
    { key: 'breedingRecord', label: 'Breeding Record' },
    { key: 'exposure',       label: 'Exposure' },
    { key: 'checkDate',      label: 'Check Date *' },
    { key: 'testResults',    label: 'Test Result *' },
    { key: 'testType',       label: 'Test Type',    hidable: true },
    { key: 'monthsPregnant', label: 'Months Preg.', hidable: true },
    { key: 'fetusSex',       label: 'Fetus Sex',    hidable: true },
    { key: 'notes',          label: 'Notes' },
];

function PregCheckHistoricalTable({ planId, colVisibility = {}, allowDelete = false }) {
    const [records,      setRecords]      = useState([]);
    const [breedMap,     setBreedMap]     = useState({});
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting,     setDeleting]     = useState(false);

    useEffect(() => {
        if (!planId) return;
        setLoading(true);
        setError(null);

        Promise.all([
            fetch(`/api/pregnancy-checks?planId=${planId}`, { credentials: 'include' }),
            fetch(`/api/breeding-records?planId=${planId}`, { credentials: 'include' }),
        ])
            .then(async ([pcRes, brRes]) => {
                if (!pcRes.ok) throw new Error(`${pcRes.status}`);
                const pcData = await pcRes.json();
                const brData = brRes.ok ? await brRes.json() : { records: [] };

                const map = {};
                for (const br of (brData.records || [])) map[br.ID] = br;

                setRecords(pcData.records || []);
                setBreedMap(map);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [planId]);

    // Apply the same visibility settings as the entry form.
    const visibleCols = HIST_COLUMNS.filter(c => !c.hidable || colVisibility[c.key] !== false);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await fetch(`/api/pregnancy-checks/${deleteTarget.ID}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            setRecords(prev => prev.filter(r => r.ID !== deleteTarget.ID));
            setDeleteTarget(null);
        } catch (e) {
            console.error('Delete preg check failed:', e);
        } finally {
            setDeleting(false);
        }
    };

    const renderCell = (col, r) => {
        const br = breedMap[r.BreedingRecordID];
        switch (col.key) {
            case 'cow':
                return <td key={col.key} style={{ ...TD, fontWeight: '600' }}>{r.CowTag}</td>;
            case 'breedingRecord':
                return (
                    <td key={col.key} style={{ ...TD, whiteSpace: 'nowrap', fontSize: '12px', color: '#555' }}>
                        {br
                            ? <>
                                {fmtDate(br.ExposureStartDate)}
                                {br.ExposureEndDate
                                    ? <span style={{ color: '#aaa' }}> – {fmtDate(br.ExposureEndDate)}</span>
                                    : null
                                }
                              </>
                            : '—'
                        }
                    </td>
                );
            case 'exposure':
                return (
                    <td key={col.key} style={{ ...TD, fontSize: '12px', color: '#555' }}>
                        {br ? formatBulls(br.PrimaryBulls) : '—'}
                    </td>
                );
            case 'checkDate':
                return (
                    <td key={col.key} style={{ ...TD, whiteSpace: 'nowrap' }}>
                        {r.PregCheckDate ? toLocalDisplay(r.PregCheckDate) : '—'}
                    </td>
                );
            case 'testResults':
                return (
                    <td key={col.key} style={TD}>
                        {r.TestResults ? (
                            <span style={{
                                padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '500',
                                backgroundColor: RESULT_BG[r.TestResults]   || '#e9ecef',
                                color:           RESULT_COLOR[r.TestResults] || '#495057',
                                border: `1px solid ${RESULT_COLOR[r.TestResults] || '#dee2e6'}44`,
                                whiteSpace: 'nowrap',
                            }}>
                                {r.TestResults}
                            </span>
                        ) : '—'}
                    </td>
                );
            case 'testType':
                return <td key={col.key} style={TD}>{r.TestType || '—'}</td>;
            case 'monthsPregnant':
                return <td key={col.key} style={TD}>{r.MonthsPregnant != null ? `${r.MonthsPregnant} mo` : '—'}</td>;
            case 'fetusSex':
                return <td key={col.key} style={TD}>{r.FetusSex || '—'}</td>;
            case 'notes':
                return <td key={col.key} style={{ ...TD, color: '#6c757d', maxWidth: '200px' }}>{r.Notes || '—'}</td>;
            default:
                return <td key={col.key} style={TD}>—</td>;
        }
    };

    return (
        <>
        <div className="bubble-container" style={{ marginTop: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600' }}>
                Plan Records
                <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 'normal', color: '#888' }}>
                    ({records.length})
                </span>
            </h3>

            {error ? (
                <div style={{ padding: '12px 0', color: '#dc3545', fontSize: '13px' }}>
                    Failed to load records: {error}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {visibleCols.map(c => (
                                    <th key={c.key} style={TH}>{c.label}</th>
                                ))}
                                {allowDelete && <th style={{ ...TH, width: '32px', padding: '4px' }} />}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={visibleCols.length} style={{ padding: '12px', color: '#888', fontSize: '13px' }}>
                                        Loading...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleCols.length} style={{ padding: '12px', color: '#888', fontStyle: 'italic', fontSize: '13px' }}>
                                        No pregnancy check records for this plan yet.
                                    </td>
                                </tr>
                            ) : (
                                records.map((r, i) => (
                                    <tr key={r.ID} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                        {visibleCols.map(col => renderCell(col, r))}
                                        {allowDelete && (
                                            <td style={{ ...TD, width: '32px', padding: '4px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setDeleteTarget(r)}
                                                    title="Delete record"
                                                    style={{
                                                        background: 'none', border: 'none', padding: '2px 4px',
                                                        cursor: 'pointer', color: '#dc3545',
                                                        display: 'inline-flex', alignItems: 'center', borderRadius: '3px',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        <PopupConfirm
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Delete Pregnancy Check"
            message={`Delete the pregnancy check record for <strong>${deleteTarget?.CowTag}</strong>? This cannot be undone.`}
            confirmText={deleting ? 'Deleting...' : 'Delete'}
        />
        </>
    );
}

function PregCheck({ breedingPlanId, breedingYear }) {
    const [rows,             setRows]             = useState([]);
    const [loading,          setLoading]          = useState(true);
    const [error,            setError]            = useState(null);
    const [submitting,       setSubmitting]       = useState(false);
    const [submitError,      setSubmitError]      = useState(null);
    const [savedCount,       setSavedCount]       = useState(null);
    const [dropdowns,        setDropdowns]        = useState({ pregTestResults: [], pregTestTypes: [], sex: [] });
    // Mirrors the column visibility managed inside <Form> so PregCheckHistoricalTable
    // can apply the same settings without a separate preferences fetch.
    const [sharedVisibility, setSharedVisibility] = useState({});

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : {})
            .then(d => setDropdowns({
                pregTestResults: d.pregTestResults || [],
                pregTestTypes:   d.pregTestTypes   || [],
                sex:             d.sexes           || [],
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

    // Columns marked required: true get the pink header styling.
    // Columns marked hidable: true can be toggled via the column settings popup.
    // calvingAlert is intentionally excluded — it is managed by the calving tracker.
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
                    {formatBulls(row.PrimaryBulls)}
                </span>
            ),
        },
        {
            key:      'checkDate',
            label:    'Check Date *',
            type:     'date',
            minWidth: '118px',
            required: true,
        },
        {
            key:      'testResults',
            label:    'Test Result *',
            type:     'select',
            options:  dropdowns.pregTestResults,
            minWidth: '128px',
            required: true,
        },
        {
            key:      'testType',
            label:    'Test Type',
            type:     'select',
            options:  dropdowns.pregTestTypes,
            minWidth: '108px',
            hidable:  true,
        },
        {
            key:         'monthsPregnant',
            label:       'Months Preg.',
            type:        'number',
            width:       '80px',
            step:        '0.5',
            min:         '0',
            placeholder: 'mo',
            hidable:     true,
        },
        {
            key:      'fetusSex',
            label:    'Fetus Sex',
            type:     'select',
            options:  dropdowns.sex,
            minWidth: '80px',
            hidable:  true,
        },
        {
            key:        'notes',
            label:      'Notes',
            type:       'text',
            maxLength:  256,
            placeholder:'Notes...',
            minWidth:   '140px',
        },
    ];

    const prefillFields = [
        { key: 'checkDate',   label: 'Check Date',      type: 'date'   },
        { key: 'testType',    label: 'Test Type',        type: 'select', options: dropdowns.pregTestTypes   },
        { key: 'testResults', label: 'Pregnancy Status', type: 'select', options: dropdowns.pregTestResults },
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
                    // Prefer the prop-level plan ID. If absent, use the breeding record's own
                    // PlanID so that checks created outside a specific plan view are still
                    // correctly associated with a plan.
                    PlanID:           breedingPlanId ?? record.PlanID ?? null,
                    BreedingRecordID: record.ID      ?? null,
                    PregCheckDate:    toUTC(value.checkDate || today),
                    TestType:         value.testType       || null,
                    TestResults:      value.testResults    || 'Untested',
                    FetusSex:         value.fetusSex       || null,
                    MonthsPregnant:   value.monthsPregnant ? parseFloat(value.monthsPregnant) : null,
                    CalvingAlert:     false,
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

            // Sync BreedingStatus on records that have a final result.
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
                formName="PregCheck"
                onColVisibilityChange={setSharedVisibility}
            />

            {breedingPlanId ? (
                <PregCheckHistoricalTable planId={breedingPlanId} colVisibility={sharedVisibility} allowDelete={true} />
            ) : (
                <div className="bubble-container" style={{ marginTop: '16px' }}>
                    <div className="empty-state-box">
                        To see existing records, select a breeding plan.
                    </div>
                </div>
            )}
        </>
    );
}

export default PregCheck;