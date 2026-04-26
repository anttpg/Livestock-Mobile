import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Folder from './folder';
import TableViewer from './tableViewer';
import useTableEdit from './useTableEdit';
import Popup from './popup';
import PastureForm from './pastureForm';
import PastureOverview from './pastureOverview';
import PastureSprays from './pastureSprays';
import PastureHay from './pastureHay';
import PastureNotes from './pastureNotes';

// Map PascalCase API response to camelCase keys PastureForm expects.
// The pastures list returns the full row, so no separate detail fetch is needed.
function normalizePasture(p) {
    return {
        pastureName:    p.PastureName    ?? p.pastureName    ?? '',
        pastureType:    p.PastureType    ?? p.pastureType    ?? null,
        vegetationType: p.VegetationType ?? p.vegetationType ?? null,
        area:           p.Area           ?? p.area           ?? '',
        areaUnits:      p.AreaUnits      ?? p.areaUnits      ?? null,
        notes:          p.Notes          ?? p.notes          ?? '',
    };
}

function Pastures() {
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();

    // PastureName is the string PK. Decode from URL.
    const selectedName = searchParams.get('item')
        ? decodeURIComponent(searchParams.get('item'))
        : null;
    const activeTab = searchParams.get('tab') || 'overview';

    // ── Table data ───────────────────────────────────────────────────────────
    const [records,        setRecords]        = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError,   setRecordsError]   = useState(null);

    const [addOpen, setAddOpen] = useState(false);

    // Edit from the folder (overview tab) — separate from table-level edit popup.
    const [folderEditTarget, setFolderEditTarget] = useState(null);
    const folderRefreshRef = useRef(null);

    const {
        editTarget,
        setEditTarget,
        handleSuccess,
        handleError,
        errorNotify,
    } = useTableEdit(records, setRecords);

    // ── Folder tabs ──────────────────────────────────────────────────────────
    const tabs = useMemo(() => [
        { id: 'overview', label: 'Overview'          },
        { id: 'sprays',   label: 'Spray Applications'},
        { id: 'hay',      label: 'Hay Production'    },
        { id: 'notes',    label: 'Notes'             },
    ], []);

    // ── Fetch pasture list ───────────────────────────────────────────────────
    const fetchPastures = async () => {
        setRecordsLoading(true);
        setRecordsError(null);
        try {
            const res = await fetch('/api/pastures', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setRecords(data.pastures ?? data);
            } else {
                setRecordsError('Failed to load pastures.');
            }
        } catch {
            setRecordsError('Failed to load pastures.');
        } finally {
            setRecordsLoading(false);
        }
    };

    // Only fetch when no item is selected (same pattern as equipment).
    useEffect(() => {
        if (selectedName) return;
        fetchPastures();
    }, [selectedName]);

    // ── Folder data fetch ────────────────────────────────────────────────────
    const handleDataFetch = async (tab) => {
        if (!selectedName) return null;
        try {
            let endpoint;
            switch (tab) {
                case 'overview': endpoint = `/api/pastures/${encodeURIComponent(selectedName)}`; break;
                // Spray and hay tabs manage their own fetches internally.
                case 'sprays':
                case 'hay':
                case 'notes':   return null;
                default:        endpoint = `/api/pastures/${encodeURIComponent(selectedName)}`;
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
        folderRefreshRef.current = helpers.onRefresh;

        if (!tabConfig || !selectedName) return null;
        const shared = { pastureName: selectedName, data, loading: helpers.loading, onRefresh: helpers.onRefresh };

        switch (tabConfig.id) {
            case 'overview': return (
                <PastureOverview
                    {...shared}
                    onEdit={() => {
                        if (data) setFolderEditTarget(normalizePasture(data));
                    }}
                />
            );
            case 'sprays':   return <PastureSprays {...shared} />;
            case 'hay':      return <PastureHay    {...shared} />;
            case 'notes':    return <PastureNotes  {...shared} />;
            default:         return null;
        }
    };

    // ── Columns ──────────────────────────────────────────────────────────────
    const columns = useMemo(() => [
        {
            key:    'PastureName',
            label:  'Pasture',
            render: row => (
                <span
                    onClick={() => navigate(`/pastures?item=${encodeURIComponent(row.PastureName)}&tab=overview`)}
                    style={{ fontWeight: '600', cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                >
                    {row.PastureName}
                </span>
            ),
        },
        { key: 'PastureType',    label: 'Type'       },
        { key: 'VegetationType', label: 'Vegetation', hidable: true },
        {
            key:    'Area',
            label:  'Area',
            hidable: true,
            render: row => row.Area != null
                ? `${row.Area}${row.AreaUnits ? ` ${row.AreaUnits}` : ''}`.trim()
                : '',
        },
    ], [navigate]);

    // ── Folder view ──────────────────────────────────────────────────────────
    if (selectedName) {
        return (
            <div>
                <h1 style={{ marginTop: '0px' }}>Pasture Records</h1>

                <button
                        onClick={() => navigate('/pastures')}
                        className="button-return"
                    >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                    All Pastures
                </button>

                <Folder
                    title=""
                    tabs={tabs}
                    defaultTab={activeTab}
                    fetchKey={selectedName}
                    onDataFetch={handleDataFetch}
                    renderTab={renderTab}
                />

                {/* Edit from overview tab */}
                <Popup
                    isOpen={folderEditTarget !== null}
                    onClose={() => setFolderEditTarget(null)}
                    title={`Edit Pasture — ${folderEditTarget?.pastureName ?? ''}`}
                >
                    {folderEditTarget && (
                        <PastureForm
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

    // ── List view ────────────────────────────────────────────────────────────
    return (
        <>
            <button
                    onClick={() => navigate('/overview')}
                    className="button-return"
                >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                Overview
            </button>

            <div className="bubble-container">
                <TableViewer
                    title="Pastures"
                    rows={records}
                    columns={columns}
                    rowKey={(row, i) => row.PastureName ?? String(i)}
                    loading={recordsLoading}
                    error={recordsError}
                    onRetry={fetchPastures}
                    onEdit={row => setEditTarget(normalizePasture(row))}
                    onAddRecord={() => setAddOpen(true)}
                    formName="pastures"
                />
            </div>

            {/* Add */}
            <Popup
                isOpen={addOpen}
                onClose={() => setAddOpen(false)}
                title="Add Pasture"
            >
                <PastureForm
                    onClose={() => setAddOpen(false)}
                    onSuccess={() => { setAddOpen(false); fetchPastures(); }}
                />
            </Popup>

            {/* Edit */}
            <Popup
                isOpen={editTarget !== null}
                onClose={() => setEditTarget(null)}
                title={`Edit Pasture — ${editTarget?.pastureName ?? ''}`}
            >
                {editTarget && (
                    <PastureForm
                        initialData={editTarget}
                        onSuccess={() => { setEditTarget(null); fetchPastures(); }}
                        onError={handleError}
                        onClose={() => setEditTarget(null)}
                    />
                )}
            </Popup>
            {errorNotify}
        </>
    );
}

export default Pastures;
