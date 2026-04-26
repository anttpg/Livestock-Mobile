import React, { useState, useEffect } from 'react';
import TableViewer from './tableViewer';
import useTableEdit from './useTableEdit';
import Popup from './popup';
import PastureHayForm from './pastureHayForm';
import { toLocalDisplay } from '../utils/dateUtils';

/**
 * Hay Production tab for the pasture folder.
 *
 * @param {string} pastureName
 */
function PastureHay({ pastureName }) {
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
                `/api/pasture-hay-production?pastureName=${encodeURIComponent(pastureName)}`,
                { credentials: 'include' }
            );
            if (!res.ok) { setRecordsError('Failed to load hay records.'); return; }
            const data = await res.json();
            setRecords(data.records ?? data);
        } catch {
            setRecordsError('Failed to load hay records.');
        } finally {
            setRecordsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [pastureName]);

    const columns = [
        {
            key:    'DateBaled',
            label:  'Date Baled',
            render: row => toLocalDisplay(row.DateBaled),
        },
        {
            key:    'DateMowed',
            label:  'Date Mowed',
            hidable: true,
            render: row => toLocalDisplay(row.DateMowed),
        },
        { key: 'VegetationType', label: 'Vegetation',  hidable: true },
        { key: 'AcresCut',       label: 'Acres Cut',   hidable: true },
        {
            key:    'UnitsProduced',
            label:  'Units',
            display: 'bold',
            render: row => row.UnitsProduced != null
                ? `${row.UnitsProduced}${row.HayUnitType ? ` ${row.HayUnitType}` : ''}`.trim()
                : '',
        },
        { key: 'WeightProduced', label: 'Weight (lbs)', hidable: true },
        { key: 'Notes',          label: 'Notes',         hidable: true },
    ];

    return (
        <div className="bubble-container">
            <TableViewer
                title="Hay Production"
                rows={records}
                columns={columns}
                loading={recordsLoading}
                error={recordsError}
                onRetry={fetchRecords}
                onEdit={setEditTarget}
                onAddRecord={() => setAddOpen(true)}
                formName="pasture-hay-production"
            />

            {/* Add */}
            <Popup
                isOpen={addOpen}
                onClose={() => setAddOpen(false)}
                title="Add Hay Production Record"
            >
                <PastureHayForm
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
                title={`Edit Hay Record — ${editTarget ? toLocalDisplay(editTarget.DateBaled) : ''}`}
            >
                {editTarget && (
                    <PastureHayForm
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

export default PastureHay;
