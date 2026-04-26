import React, { useState, useEffect } from 'react';
import TableViewer from './tableViewer';
import useTableEdit from './useTableEdit';
import Popup from './popup';
import EquipmentMaintenanceForm from './equipmentMaintenanceForm';
import EquipmentPartsForm from './equipmentPartsForm';
import { toLocalDisplay } from '../utils/dateUtils';

/**
 * Maintenance tab for the equipment folder.
 *
 * @param {number}   equipmentId
 * @param {Function} onRefresh   — provided by Folder, call to force a tab data re-fetch
 */
function EquipmentMaintenance({ equipmentId }) {
    // ── Parts state ──────────────────────────────────────────────────────────
    const [parts,        setParts]        = useState([]);
    const [partsLoading, setPartsLoading] = useState(false);
    const [partsError,   setPartsError]   = useState(null);

    // ── Maintenance records state ────────────────────────────────────────────
    const [records,         setRecords]         = useState([]);
    const [recordsLoading,  setRecordsLoading]  = useState(false);
    const [recordsError,    setRecordsError]    = useState(null);

    const [addPartsOpen,      setAddPartsOpen]      = useState(false);
    const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false);

    const {
        editTarget:    partsEditTarget,
        setEditTarget: setPartsEditTarget,
        handleSuccess: partsHandleSuccess,
        handleError:   partsHandleError,
        errorNotify:   partsErrorNotify,
    } = useTableEdit(parts, setParts);

    const {
        editTarget:    recordsEditTarget,
        setEditTarget: setRecordsEditTarget,
        handleSuccess: recordsHandleSuccess,
        handleError:   recordsHandleError,
        errorNotify:   recordsErrorNotify,
    } = useTableEdit(records, setRecords);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchParts = async () => {
        if (!equipmentId) return;
        setPartsLoading(true);
        setPartsError(null);
        try {
            const res = await fetch(`/api/equipment-parts?equipmentId=${equipmentId}`, { credentials: 'include' });
            if (!res.ok) { setPartsError('Failed to load parts.'); return; }
            const data = await res.json();
            setParts(data.parts ?? data);
        } catch {
            setPartsError('Failed to load parts.');
        } finally {
            setPartsLoading(false);
        }
    };

    const fetchRecords = async () => {
        if (!equipmentId) return;
        setRecordsLoading(true);
        setRecordsError(null);
        try {
            const res = await fetch(`/api/equipment-maintenance?equipmentId=${equipmentId}`, { credentials: 'include' });
            if (!res.ok) { setRecordsError('Failed to load maintenance records.'); return; }
            const data = await res.json();
            setRecords(data.records ?? data);
        } catch {
            setRecordsError('Failed to load maintenance records.');
        } finally {
            setRecordsLoading(false);
        }
    };

    useEffect(() => {
        fetchParts();
        fetchRecords();
    }, [equipmentId]);

    // ── Columns ──────────────────────────────────────────────────────────────
    const partsColumns = [
        { key: 'PartType',     label: 'Part Type'    },
        { key: 'PartNumber',   label: 'Part Number', display: 'bold' },
        { key: 'Manufacturer', label: 'Manufacturer', hidable: true   },
        { key: 'Notes',        label: 'Notes',        hidable: true   },
    ];

    const maintenanceColumns = [
        {
            key:    'DatePerformed',
            label:  'Date',
            render: row => toLocalDisplay(row.DatePerformed),
        },
        { key: 'Title',       label: 'Title',        display: 'bold' },
        { key: 'ServiceType', label: 'Service Type', hidable: true   },
        {
            key:    'MeterReadingAtService',
            label:  'Reading',
            hidable: true,
            render: row => row.MeterReadingAtService != null
                ? `${row.MeterReadingAtService} ${row.MeterUnit ?? ''}`.trim()
                : '',
        },
        {
            key:    'NextServiceDue',
            label:  'Next Due',
            hidable: true,
            render: row => row.NextServiceDue != null
                ? `${row.NextServiceDue} ${row.NextServiceUnits ?? ''}`.trim()
                : '',
        },
    ];

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="multibubble-page">
            <div className="bubble-container">          
            <TableViewer
                title="Parts Reference"
                rows={parts}
                columns={partsColumns}
                loading={partsLoading}
                error={partsError}
                onRetry={fetchParts}
                onEdit={setPartsEditTarget}
                onAddRecord={() => setAddPartsOpen(true)}
                formName="equipment-parts"
            />
            </div>

            <div className="bubble-container">
                <TableViewer
                    title="Maintenance Records"
                    rows={records}
                    columns={maintenanceColumns}
                    loading={recordsLoading}
                    error={recordsError}
                    onRetry={fetchRecords}
                    onEdit={setRecordsEditTarget}
                    onAddRecord={() => setAddMaintenanceOpen(true)}
                    formName="equipment-maintenance-records"
                />
            </div>

            {/* Add Part */}
            <Popup
                isOpen={addPartsOpen}
                onClose={() => setAddPartsOpen(false)}
                title="Add Part"
            >
                <EquipmentPartsForm
                    equipmentID={equipmentId}
                    onClose={() => setAddPartsOpen(false)}
                    onSuccess={() => { setAddPartsOpen(false); fetchParts(); }}
                    onError={partsHandleError}
                />
            </Popup>

            {/* Edit Part */}
            <Popup
                isOpen={partsEditTarget !== null}
                onClose={() => setPartsEditTarget(null)}
                title={`Edit Part — ${partsEditTarget?.PartNumber ?? ''}`}
            >
                {partsEditTarget && (
                    <EquipmentPartsForm
                        initialData={partsEditTarget}
                        equipmentID={equipmentId}
                        onSuccess={(res) => partsHandleSuccess(res?.row ?? res)}
                        onError={partsHandleError}
                        onClose={() => setPartsEditTarget(null)}
                    />
                )}
            </Popup>
            {partsErrorNotify}

            {/* Add Maintenance Record */}
            <Popup
                isOpen={addMaintenanceOpen}
                onClose={() => setAddMaintenanceOpen(false)}
                title="Add Maintenance Record"
            >
                <EquipmentMaintenanceForm
                    equipmentID={equipmentId}
                    onClose={() => setAddMaintenanceOpen(false)}
                    onSuccess={() => { setAddMaintenanceOpen(false); fetchRecords(); }}
                />
            </Popup>

            {/* Edit Maintenance Record */}
            <Popup
                isOpen={recordsEditTarget !== null}
                onClose={() => setRecordsEditTarget(null)}
                title={`Edit Record — ${recordsEditTarget?.Title ?? ''}`}
            >
                {recordsEditTarget && (
                    <EquipmentMaintenanceForm
                        initialData={recordsEditTarget}
                        equipmentID={equipmentId}
                        onSuccess={(res) => recordsHandleSuccess(res?.row ?? res)}
                        onError={recordsHandleError}
                        onClose={() => setRecordsEditTarget(null)}
                    />
                )}
            </Popup>
            {recordsErrorNotify}
        </div>
    );
}

export default EquipmentMaintenance;
