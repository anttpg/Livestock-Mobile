import React, { useState, useEffect, useCallback } from 'react';
import TableForm from './tableForm';
import TableViewer from './tableViewer';
import PopupConfirm from './popupConfirm';
import { useTableEdit } from './useTableEdit';
import { formatDateDisplay, toUTC, toLocalDisplay, toLocalInput } from '../utils/dateUtils';
import { PregnancyLinkerBubble } from './pregnancyLinker';


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

function formatBulls(bulls) {
    if (!bulls) return '—';
    if (Array.isArray(bulls)) return bulls.map(b => b.tag || b).join(', ') || '—';
    if (typeof bulls === 'string') return bulls || '—';
    return '—';
}


// ─── Historical records table ─────────────────────────────────────────────────

function PregCheckHistoricalTable({ planId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [deleting, setDeleting] = useState(false);

    const { editTarget, setEditTarget, handleSuccess, handleError, errorNotify } =
        useTableEdit(records, setRecords);

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

                const breedMap = {};
                for (const br of (brData.records || [])) breedMap[br.ID] = br;

                const enriched = (pcData.records || []).map(r => ({
                    ...r,
                    _br: breedMap[r.BreedingRecordID] || null,
                }));
                setRecords(enriched);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [planId]);

    const handleDeleteConfirm = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/pregnancy-checks/${editTarget.ID}`, {
                method: 'DELETE', credentials: 'include',
            });
            if (!res.ok) throw new Error(await res.text());
            handleSuccess(null);
        } catch (e) {
            handleError(e.message);
        } finally {
            setDeleting(false);
        }
    };

    // Column keys for hidable columns intentionally match the entry form so both
    // share the same persisted preference under formName="PregCheck".
    const columns = [
        { key: 'CowTag', label: 'Cow', display: 'bold' },
        {
            key:    'breedingRecord',
            label:  'Breeding Record',
            render: row => {
                const br = row._br;
                if (!br) return '';
                return (
                    <span style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#555' }}>
                        {formatDateDisplay(br.ExposureStartDate)}
                        {br.ExposureEndDate && (
                            <span style={{ color: '#aaa' }}> – {formatDateDisplay(br.ExposureEndDate)}</span>
                        )}
                    </span>
                );
            },
        },
        {
            key:    'exposure',
            label:  'Exposure',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555' }}>
                    {row._br ? formatBulls(row._br.PrimaryBulls) : ''}
                </span>
            ),
        },
        {
            key:    'checkDate',
            label:  'Check Date',
            render: row => row.PregCheckDate ? toLocalDisplay(row.PregCheckDate) : '',
        },
        {
            key:    'testResults',
            label:  'Test Result',
            render: row => row.TestResults ? (
                <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '500',
                    backgroundColor: RESULT_BG[row.TestResults]   || '#e9ecef',
                    color:           RESULT_COLOR[row.TestResults] || '#495057',
                    border:          `1px solid ${RESULT_COLOR[row.TestResults] || '#dee2e6'}44`,
                    whiteSpace:      'nowrap',
                }}>
                    {row.TestResults}
                </span>
            ) : '',
        },
        { key: 'testType',       label: 'Test Type',    hidable: true, render: row => row.TestType || '' },
        { key: 'monthsPregnant', label: 'Months Preg.', hidable: true, render: row => row.MonthsPregnant != null ? `${row.MonthsPregnant} mo` : '' },
        { key: 'fetusSex',       label: 'Fetus Sex',    hidable: true, render: row => row.FetusSex || '' },
        { key: 'Notes', label: 'Notes', tdStyle: { color: '#6c757d', maxWidth: '200px' } },
    ];

    return (
        <>
            <TableViewer
                title={`Plan Records (${records.length})`}
                rows={records}
                columns={columns}
                loading={loading}
                error={error}
                formName="PregCheck"
                onEdit={setEditTarget}
            />

            <PopupConfirm
                isOpen={editTarget !== null}
                onClose={() => setEditTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Record"
                message={`Delete the pregnancy check for <strong>${editTarget?.CowTag ?? ''}</strong>? This cannot be undone.`}
                confirmText={deleting ? 'Deleting...' : 'Delete'}
            />

            {errorNotify}
        </>
    );
}


// ─── Entry form ───────────────────────────────────────────────────────────────

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
                sex:             d.sexes           || [],
            }))
            .catch(() => {});
    }, []);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = breedingPlanId
                ? `/api/breeding-records?planId=${breedingPlanId}&breedingStatus=Active`
                : `/api/breeding-records?breedingStatus=Active&newestOnly=true`;
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
        { key: 'CowTag', label: 'Cow', display: 'bold' },
        {
            key:    'LastBreeding',
            label:  'Breeding Record',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
                    {formatDateDisplay(row.ExposureStartDate)}
                    {row.ExposureEndDate
                        ? <span style={{ color: '#aaa' }}> – {formatDateDisplay(row.ExposureEndDate)}</span>
                        : null
                    }
                </span>
            ),
        },
        {
            key:    'Exposure',
            label:  'Exposure',
            render: row => (
                <span style={{ fontSize: '12px', color: '#555' }}>{formatBulls(row.PrimaryBulls)}</span>
            ),
        },
        { key: 'checkDate',      label: 'Check Date *',  type: 'date',   minWidth: '118px', required: true },
        { key: 'testResults',    label: 'Test Result *',  type: 'select', options: dropdowns.pregTestResults, minWidth: '128px', required: true },
        { key: 'testType',       label: 'Test Type',      type: 'select', options: dropdowns.pregTestTypes,   minWidth: '108px', hidable: true },
        { key: 'monthsPregnant', label: 'Months Preg.',   type: 'number', width: '80px', step: '0.5', min: '0', placeholder: 'mo', hidable: true },
        { key: 'fetusSex',       label: 'Fetus Sex',      type: 'select', options: dropdowns.sex, minWidth: '80px', hidable: true },
        { key: 'notes',          label: 'Notes',          type: 'text',   maxLength: 256, placeholder: 'Notes...', minWidth: '140px' },
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
        <div>
             <div className="multibubble-page" style={{gap: '50px' }}>
                <div className="bubble-container">
                    <PregnancyLinkerBubble />
                    <TableForm
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
                    />
                </div>

                <div className="bubble-container">
                    {breedingPlanId ? (
                        <PregCheckHistoricalTable planId={breedingPlanId} />
                    ) : (
                        <div className="empty-state-box">
                            To see existing records, select a breeding plan.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PregCheck;