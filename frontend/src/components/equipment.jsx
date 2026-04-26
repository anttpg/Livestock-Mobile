import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Folder from './folder';
import TableViewer from './tableViewer';
import useTableEdit from './useTableEdit';
import Popup from './popup';
import EquipmentForm from './EquipmentForm';
import EquipmentOverview from './EquipmentOverview';
import EquipmentMaintenance from './EquipmentMaintenance';
import EquipmentNotes from './EquipmentNotes';

// Map the PascalCase API response to the camelCase keys EquipmentForm expects.
// Also fetches the full record so all fields are present (the list endpoint
// only returns summary columns).
function normalizeEquipment(eq) {
    return {
        id:                 eq.ID              ?? eq.id,
        name:               eq.Name            ?? eq.name            ?? '',
        description:        eq.Description     ?? eq.description     ?? '',
        equipmentStatus:    eq.EquipmentStatus ?? eq.equipmentStatus ?? '',
        equipmentType:      eq.EquipmentType   ?? eq.equipmentType   ?? '',
        // FIX: FK fields must fall back to null, not ''. Submitting '' for an
        // integer FK column causes a foreign key constraint error. This value
        // is passed directly as initialData to EquipmentForm, so it must
        // already be null when the field is absent.
        locationID:         eq.LocationID      ?? eq.locationID      ?? null,
        isVehicle:          eq.IsVehicle       ?? eq.isVehicle       ?? false,
        make:               eq.Make            ?? eq.make            ?? '',
        model:              eq.Model           ?? eq.model           ?? '',
        year:               eq.Year            ?? eq.year            ?? '',
        // API may use any of these key names for the VIN / serial field
        serialNumber:       eq['VIN/SerialNumber'] ?? eq.VINSerialNumber ?? eq.VIN
                            ?? eq.SerialNumber ?? eq.serialNumber    ?? '',
        registration:       eq.Registration      ?? eq.registration      ?? '',
        registrationExpiry: eq.RegistrationExpiry ?? eq.registrationExpiry ?? '',
        grossWeightRating:  eq.GrossWeightRating  ?? eq.grossWeightRating  ?? '',
        warrantyExpiry:     eq.WarrantyExpiry     ?? eq.warrantyExpiry     ?? '',
        warrantyNotes:      eq.WarrantyNotes      ?? eq.warrantyNotes      ?? '',
        notes:              eq.Notes              ?? eq.notes              ?? '',
        purchaseRecordID:   eq.PurchaseRecordID   ?? eq.purchaseRecordID   ?? null,
        saleRecordID:       eq.SaleRecordID       ?? eq.saleRecordID       ?? null,
        purchaseRecord:     eq.purchaseRecord     ?? eq.PurchaseRecord     ?? null,
        saleRecord:         eq.saleRecord         ?? eq.SaleRecord         ?? null,
    };
}

async function fetchAndNormalize(id) {
    const res = await fetch(`/api/equipment/${id}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeEquipment(data.equipment ?? data);
}

function Equipment() {
    const [searchParams]  = useSearchParams();
    const navigate        = useNavigate();

    const selectedId = searchParams.get('item');
    const activeTab  = searchParams.get('tab') || 'overview';

    // ── Table data ──────────────────────────────────────────────────────────
    const [activeRecords,   setActiveRecords]   = useState([]);
    const [inactiveRecords, setInactiveRecords] = useState([]);
    const [activeLoading,   setActiveLoading]   = useState(false);
    const [inactiveLoading, setInactiveLoading] = useState(false);
    const [activeError,     setActiveError]     = useState(null);
    const [inactiveError,   setInactiveError]   = useState(null);

    const [addOpen, setAddOpen] = useState(false);

    // Edit from the folder (overview tab) — separate state so it doesn't
    // conflict with the table-level edit popups.
    const [folderEditTarget, setFolderEditTarget] = useState(null);
    const folderRefreshRef = useRef(null);

    const {
        editTarget:    activeEditTarget,
        setEditTarget: setActiveEditTarget,
        handleSuccess: activeHandleSuccess,
        handleError:   activeHandleError,
        errorNotify:   activeErrorNotify,
    } = useTableEdit(activeRecords, setActiveRecords);

    const {
        editTarget:    inactiveEditTarget,
        setEditTarget: setInactiveEditTarget,
        handleSuccess: inactiveHandleSuccess,
        handleError:   inactiveHandleError,
        errorNotify:   inactiveErrorNotify,
    } = useTableEdit(inactiveRecords, setInactiveRecords);

    // Fetch the full detail record before opening either edit popup so all
    // form fields are populated (the list endpoint only returns summary columns).
    const handleActiveEdit = async (row) => {
        const data = await fetchAndNormalize(row.ID);
        if (data) setActiveEditTarget(data);
    };

    const handleInactiveEdit = async (row) => {
        const data = await fetchAndNormalize(row.ID);
        if (data) setInactiveEditTarget(data);
    };

    // ── Folder tabs ─────────────────────────────────────────────────────────
    const tabs = useMemo(() => [
        { id: 'overview',     label: 'Overview'     },
        { id: 'maintenance',  label: 'Maintenance'  },
        { id: 'notes',        label: 'Notes'        },
    ], []);

    // ── Fetch equipment lists ────────────────────────────────────────────────
    const fetchEquipment = async () => {
        setActiveLoading(true);
        setInactiveLoading(true);
        setActiveError(null);
        setInactiveError(null);

        try {
            const [activeRes, inactiveRes] = await Promise.all([
                fetch('/api/equipment?status=active',   { credentials: 'include' }),
                fetch('/api/equipment?status=inactive', { credentials: 'include' }),
            ]);

            if (activeRes.ok) {
                const data = await activeRes.json();
                setActiveRecords(data.equipment ?? data);
            } else {
                setActiveError('Failed to load active equipment.');
            }

            if (inactiveRes.ok) {
                const data = await inactiveRes.json();
                setInactiveRecords(data.equipment ?? data);
            } else {
                setInactiveError('Failed to load inactive equipment.');
            }
        } catch {
            setActiveError('Failed to load equipment.');
            setInactiveError('Failed to load equipment.');
        } finally {
            setActiveLoading(false);
            setInactiveLoading(false);
        }
    };

    // Only fetch table data when no item is selected
    useEffect(() => {
        if (selectedId) return;
        fetchEquipment();
    }, [selectedId]);

    // ── Folder data fetch ────────────────────────────────────────────────────
    const handleDataFetch = async (tab) => {
        if (!selectedId) return null;
        try {
            let endpoint;
            switch (tab) {
                case 'overview':    endpoint = `/api/equipment/${selectedId}`;                          break;
                case 'maintenance': endpoint = `/api/equipment-maintenance?equipmentId=${selectedId}`; break;
                case 'notes':       return null;
                default:            endpoint = `/api/equipment/${selectedId}`;
            }

            const res = await fetch(endpoint, { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) { window.location.href = '/login'; return null; }
                throw new Error(`Failed to fetch ${tab} data`);
            }
            return await res.json();
        } catch (err) {
            console.error(`Error fetching ${tab} data:`, err);
            return null;
        }
    };

    const renderTab = (tabConfig, data, helpers) => {
        // Keep a live reference to the folder's refresh so the edit popup can
        // trigger a re-fetch after a successful save.
        folderRefreshRef.current = helpers.onRefresh;

        if (!tabConfig || !selectedId) return null;
        const shared = {
            equipmentId: parseInt(selectedId),
            data,
            loading:     helpers.loading,
            onRefresh:   helpers.onRefresh,
        };
        switch (tabConfig.id) {
            case 'overview':    return <EquipmentOverview    {...shared} onEdit={() => {
                                    const eq = data?.equipment ?? data;
                                    if (eq) setFolderEditTarget(normalizeEquipment(eq));
                                }} />;
            case 'maintenance': return <EquipmentMaintenance {...shared} />;
            case 'notes':       return <EquipmentNotes       {...shared} />;
            default:            return null;
        }
    };

    // ── Columns ──────────────────────────────────────────────────────────────
    const columns = useMemo(() => [
        {
            key:    'Name',
            label:  'Name',
            render: row => (
                <span
                    onClick={() => navigate(`/equipment?item=${row.ID}&tab=overview`)}
                    style={{ fontWeight: '600', cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                >
                    {row.Name}
                </span>
            ),
        },
        { key: 'Description',   label: 'Description', hidable: true },
        { key: 'EquipmentType', label: 'Type'                       },
        { key: 'Location',      label: 'Location'                   },
    ], [navigate]);

    // ── Folder view ──────────────────────────────────────────────────────────
    if (selectedId) {
        return (
            <div >
                <h1 style={{ marginTop: '0px' }}>Equipment Records</h1>

                <button
                    onClick={() => navigate('/equipment')}
                    style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        gap:          '4px',
                        backgroundColor: 'white',
                        border:       '1px solid #ccd3dc',
                        borderRadius: '4px',
                        padding:      '6px 12px',
                        fontSize:     '13px',
                        cursor:       'pointer',
                        color:        '#444',
                        marginBottom: '16px',
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                    All Equipment
                </button>
                
                <Folder
                    title=""
                    tabs={tabs}
                    defaultTab={activeTab}
                    fetchKey={selectedId}
                    onDataFetch={handleDataFetch}
                    renderTab={renderTab}
                />

                {/* Edit from overview tab */}
                <Popup
                    isOpen={folderEditTarget !== null}
                    onClose={() => setFolderEditTarget(null)}
                    title={`Edit Equipment — ${folderEditTarget?.name ?? ''}`}
                    fullscreen={true}
                >
                    {folderEditTarget && (
                        <EquipmentForm
                            initialData={folderEditTarget}
                            onSuccess={() => {
                                setFolderEditTarget(null);
                                folderRefreshRef.current?.();
                            }}
                            onClose={() => setFolderEditTarget(null)}
                        />
                    )}
                </Popup>
            </div>
        );
    }

    return (
        <>
            <div className='multibubble-page'>
                <div className="bubble-container">
                    <TableViewer
                        title="Active Equipment"
                        rows={activeRecords}
                        columns={columns}
                        loading={activeLoading}
                        error={activeError}
                        onRetry={fetchEquipment}
                        onEdit={handleActiveEdit}
                        onAddRecord={() => setAddOpen(true)}
                        formName="equipment-active"
                    />
                </div>
                
                <div className="bubble-container">
                    <TableViewer
                        title="Inactive Equipment"
                        rows={inactiveRecords}
                        columns={columns}
                        loading={inactiveLoading}
                        error={inactiveError}
                        onRetry={fetchEquipment}
                        onEdit={handleInactiveEdit}
                        formName="equipment-inactive"
                    />
                </div>
            </div>

            {/* Add Equipment */}
            <Popup
                isOpen={addOpen}
                onClose={() => setAddOpen(false)}
                title="Add Equipment"
                fullscreen={false}
            >
                <EquipmentForm
                    onClose={() => setAddOpen(false)}
                    onSuccess={() => { setAddOpen(false); fetchEquipment(); }}
                />
            </Popup>

            {/* Edit — Active */}
            <Popup
                isOpen={activeEditTarget !== null}
                onClose={() => setActiveEditTarget(null)}
                title={`Edit Equipment — ${activeEditTarget?.Name ?? ''}`}
            >
                {activeEditTarget && (
                    <EquipmentForm
                        initialData={activeEditTarget}
                         onSuccess={() => { setActiveEditTarget(null); fetchEquipment(); }}
                        onError={activeHandleError}
                        onClose={() => setActiveEditTarget(null)}
                    />
                )}
            </Popup>
            {activeErrorNotify}

            {/* Edit — Inactive */}
            <Popup
                isOpen={inactiveEditTarget !== null}
                onClose={() => setInactiveEditTarget(null)}
                title={`Edit Equipment — ${inactiveEditTarget?.Name ?? ''}`}
            >
                {inactiveEditTarget && (
                    <EquipmentForm
                        initialData={inactiveEditTarget}
                        onSuccess={() => { setInactiveEditTarget(null); fetchEquipment(); }}
                        onError={inactiveHandleError}
                        onClose={() => setInactiveEditTarget(null)}
                    />
                )}
            </Popup>
            {inactiveErrorNotify}

        </>
    );
}

export default Equipment;