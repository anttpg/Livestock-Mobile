import React, { useState, useEffect } from 'react';
import TableViewer from './tableViewer';
import useTableEdit from './useTableEdit';
import Popup from './popup';
import PastureSprayForm from './pastureSprayForm';
import { toLocalDisplay } from '../utils/dateUtils';

/**
 * Spray Applications tab for the pasture folder.
 *
 * @param {string} pastureName
 */
function PastureSprays({ pastureName }) {
    const [records,        setRecords]        = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError,   setRecordsError]   = useState(null);

    const [addOpen, setAddOpen] = useState(false);

    const {
        editTarget,
        setEditTarget,
        handleSuccess,
        handleError,
        errorNotify,
    } = useTableEdit(records, setRecords);

    const fetchRecords = async () => {
        if (!pastureName) return;
        setRecordsLoading(true);
        setRecordsError(null);
        try {
            const res = await fetch(
                `/api/pasture-spray-applications?pastureName=${encodeURIComponent(pastureName)}`,
                { credentials: 'include' }
            );
            if (!res.ok) { setRecordsError('Failed to load spray records.'); return; }
            const data = await res.json();
            setRecords(data.applications ?? data);
        } catch {
            setRecordsError('Failed to load spray records.');
        } finally {
            setRecordsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [pastureName]);

    const columns = [
        {
            key:    'DateApplied',
            label:  'Date Applied',
            render: row => toLocalDisplay(row.DateApplied),
        },
        { key: 'ChemicalName', label: 'Chemical',       display: 'bold' },
        {
            key:    'Rate',
            label:  'Rate',
            hidable: true,
            render: row => row.Rate != null
                ? `${row.Rate}${row.RateUnit ? ` ${row.RateUnit}` : ''}`.trim()
                : '',
        },
        { key: 'AcresSprayed',      label: 'Acres',       hidable: true },
        { key: 'AppliedByUsername', label: 'Applied By',  hidable: true },
        { key: 'Notes',             label: 'Notes',       hidable: true },
    ];

    return (
        <div className="bubble-container">
            <TableViewer
                title="Spray Applications"
                rows={records}
                columns={columns}
                loading={recordsLoading}
                error={recordsError}
                onRetry={fetchRecords}
                onEdit={setEditTarget}
                onAddRecord={() => setAddOpen(true)}
                formName="pasture-spray-applications"
            />

            {/* Add */}
            <Popup
                isOpen={addOpen}
                onClose={() => setAddOpen(false)}
                title="Add Spray Application"
            >
                <PastureSprayForm
                    pastureName={pastureName}
                    onClose={() => setAddOpen(false)}
                    onSuccess={() => { setAddOpen(false); fetchRecords(); }}
                    onError={handleError}
                />
            </Popup>

            {/* Edit */}
            <Popup
                isOpen={editTarget !== null}
                onClose={() => setEditTarget(null)}
                title={`Edit Spray — ${editTarget?.ChemicalName ?? ''}`}
            >
                {editTarget && (
                    <PastureSprayForm
                        initialData={editTarget}
                        pastureName={pastureName}
                        onClose={() => setEditTarget(null)}
                        onSuccess={(res) => handleSuccess(res?.row ?? res)}
                        onError={handleError}
                    />
                )}
            </Popup>
            {errorNotify}
        </div>
    );
}

export default PastureSprays;
