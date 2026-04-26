import React, { useMemo } from 'react';
import Minimap from './minimap';
import FileViewer from './FileViewer';

const DETAIL_FIELDS = [
    { key: 'PastureType',    label: 'Type'       },
    { key: 'VegetationType', label: 'Vegetation' },
    // Area and AreaUnits are combined in the rows builder below.
    { key: 'Notes',          label: 'Notes'      },
];

function DetailRow({ label, value }) {
    return (
        <tr>
            <td style={{ padding: '6px 12px 6px 0', color: '#666', fontSize: '13px', verticalAlign: 'top', width: '1%', whiteSpace: 'nowrap' }}>
                {label}
            </td>
            <td style={{ padding: '6px 0', fontSize: '13px', color: '#1a1a1a', verticalAlign: 'top', overflowWrap: 'break-word', minWidth: 0 }}>
                {value}
            </td>
        </tr>
    );
}

/**
 * Overview tab for the pasture folder.
 *
 * @param {string}      pastureName
 * @param {Object|null} data         — raw API response from /api/pastures/:name
 * @param {boolean}     loading
 * @param {Function}    onEdit
 */
function PastureOverview({ pastureName, data, loading, onEdit }) {
    // getPasture returns the raw row directly (no wrapper object).
    const pasture = data ?? null;

    const rows = useMemo(() => {
        if (!pasture) return [];
        const result = [];

        // Area: combine value and unit into a single display string.
        const area = pasture.Area ?? pasture.area;
        if (area != null && area !== '') {
            const units = pasture.AreaUnits ?? pasture.areaUnits ?? '';
            result.push({ label: 'Area', value: units ? `${area} ${units}` : String(area) });
        }

        for (const field of DETAIL_FIELDS) {
            const raw = pasture[field.key];
            if (raw == null || raw === '') continue;
            result.push({ label: field.label, value: String(raw) });
        }

        return result;
    }, [pasture]);

    if (loading) {
        return <div style={{ padding: '32px', color: '#888', fontSize: '14px' }}>Loading...</div>;
    }

    if (!pasture) {
        return <div style={{ padding: '32px', color: '#888', fontSize: '14px' }}>No data available.</div>;
    }

    return (
        <div className="bubble-container">
            <div style={{ marginTop: '4px', marginBottom: '8px', padding: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
                        {pasture.PastureName ?? pastureName}
                    </span>
                    {onEdit && (
                        <button
                            type="button"
                            onClick={onEdit}
                            title="Edit pasture"
                            style={{
                                flexShrink: 0,
                                background: 'none', border: 'none', padding: '2px 4px',
                                cursor: 'pointer', color: '#888',
                                display: 'inline-flex', alignItems: 'center', borderRadius: '3px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5f5f5'; e.currentTarget.style.color = '#333'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888'; }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', padding: '4px 0' }}>
                {/* Minimap — route: /api/images/minimap/:name/photo/1 */}
                <div style={{ flex: '0 1 350px', minWidth: '80px' }}>
                    <Minimap pastureName={pastureName} />
                </div>

                <div style={{ flex: '1 0 0', minWidth: '160px' }}>
                    {rows.length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#aaa', marginTop: '12px' }}>No additional details recorded.</p>
                    ) : (
                        <table style={{ borderCollapse: 'collapse', marginTop: '12px', width: '100%' }}>
                            <tbody>
                                {rows.map(r => (
                                    <DetailRow key={r.label} label={r.label} value={r.value} />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                <div className="form-section-title" style={{ marginBottom: '12px' }}>Files</div>
                <FileViewer
                    domain="pastureUpload"
                    recordId={pastureName}
                />
            </div>
        </div>
    );
}

export default PastureOverview;
