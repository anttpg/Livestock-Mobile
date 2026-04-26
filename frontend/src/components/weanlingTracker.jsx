import React, { useState, useEffect, useCallback } from 'react';
import TableForm from './tableForm';
import TableViewer from './tableViewer';
import PopupConfirm from './popupConfirm';
import { useTableEdit } from './useTableEdit';
import { toUTC, toLocalDisplay, toAge } from '../utils/dateUtils';
import { WeaningLinkerBubble } from './weaningLinker';



function WeaningHistoricalTable({ planId }) {
    const [records,  setRecords]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [deleting, setDeleting] = useState(false);

    const { editTarget, setEditTarget, handleSuccess, handleError, errorNotify } =
        useTableEdit(records, setRecords);

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

    const handleDeleteConfirm = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/weaning-records/${editTarget.ID}`, {
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

    const columns = [
        { key: 'CowTag',        label: 'Calf',         display: 'bold' },
        { key: 'WeaningDate',   label: 'Weaning Date', render: row => row.WeaningDate ? toLocalDisplay(row.WeaningDate) : '' },
        { key: 'WeaningWeight', label: 'Weight (lbs)', render: row => row.WeaningWeight != null ? row.WeaningWeight : '' },
        { key: 'Notes',         label: 'Notes',        tdStyle: { color: '#6c757d', maxWidth: '200px' } },
    ];

    return (
        <>
            <TableViewer
                title={`Plan Weaning Records (${records.length})`}
                rows={records}
                columns={columns}
                loading={loading}
                error={error}
                onEdit={setEditTarget}
            />

            <PopupConfirm
                isOpen={editTarget !== null}
                onClose={() => setEditTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Record"
                message={`Delete the weaning record for <strong>${editTarget?.CowTag ?? ''}</strong>? This cannot be undone.`}
                confirmText={deleting ? 'Deleting...' : 'Delete'}
            />

            {errorNotify}
        </>
    );
}


// ─── Main component ───────────────────────────────────────────────────────────

/*
 * Depends on:
 *   GET    /api/unweaned-calves?planId=X
 *   POST   /api/weaning-records
 *   GET    /api/weaning-records?planId=X
 *   DELETE /api/weaning-records/:id
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

    const columns = [
        { key: 'CalfTag', label: 'Calf', display: 'bold' },
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
                    {toLocalDisplay(row.BirthDate)}
                    <span style={{ color: '#aaa', marginLeft: '6px' }}>{toAge(row.BirthDate)}</span>
                </span>
            ),
        },
        { key: 'DamTag',  label: 'Dam',     render: row => <span style={{ fontSize: '12px' }}>{row.DamTag  || ''}</span> },
        { key: 'Sire',    label: 'Sire',    render: row => <span style={{ fontSize: '12px' }}>{row.Sire    || ''}</span> },
        { key: 'Pasture', label: 'Pasture', render: row => <span style={{ fontSize: '12px' }}>{row.Pasture || ''}</span> },
        { key: 'weaningDate',   label: 'Date *',      type: 'date',   minWidth: '118px' },
        { key: 'weaningWeight', label: 'Weight (lbs)', type: 'number', width: '75px', step: '1', min: '0', placeholder: 'lbs' },
        { key: 'notes',         label: 'Notes',        type: 'text',   maxLength: 256, placeholder: 'Notes...', minWidth: '140px' },
    ];

    const prefillFields = [
        { key: 'weaningDate', label: 'Weaning Date', type: 'date' },
    ];

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

    const headerContent = (
        <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
            {breedingPlanId
                ? `Unweaned calves from plan ${breedingYear || breedingPlanId}`
                : 'All unweaned calves'
            }
        </div>
    );

    return (
        <>
            <div className='multibubble-page'>
                <div className="bubble-container">
                    <TableForm
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
                </div>
                <div className="bubble-container">
                    {breedingPlanId ? 
                        (<WeaningHistoricalTable planId={breedingPlanId} />
                        ) : (
                        <div className="empty-state-box">
                            To see existing records, select a breeding plan.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default WeanlingTracker;