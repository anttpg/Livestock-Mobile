import React, { useMemo } from 'react';
import PhotoViewer from './photoViewer';
import FileViewer from './FileViewer';
import { toLocalDisplayLong } from '../utils/dateUtils';

// Fields to display in the detail list.
// vehicleOnly rows are hidden when IsVehicle is false.
// dateFields are formatted with toLocalDisplayLong.
const DETAIL_FIELDS = [
    { key: 'EquipmentStatus', label: 'Status'                              },
    { key: 'EquipmentType',   label: 'Type'                                },
    { key: 'Location',        label: 'Location'                            },
    { key: 'PastureName',     label: 'Pasture'                             },
    { key: 'Make',            label: 'Make'                                },
    { key: 'Model',           label: 'Model'                               },
    { key: 'Year',            label: 'Year'                                },
    // VIN / Serial rendered separately based on IsVehicle
    { key: 'Registration',        label: 'Registration',     vehicleOnly: true                },
    { key: 'RegistrationExpiry',  label: 'Reg. Expiry',      vehicleOnly: true, isDate: true  },
    { key: 'GrossWeightRating',   label: 'GVW Rating',       vehicleOnly: true                },
    { key: 'WarrantyExpiry',      label: 'Warranty Expiry',  isDate: true                     },
    { key: 'WarrantyNotes',       label: 'Warranty Notes'                                     },
    { key: 'Notes',               label: 'Notes'                                              },
];

function DetailRow({ label, value }) {
    return (
        <tr>
            <td style={{ padding: '6px 12px 6px 0', color: '#666', fontSize: '13px', verticalAlign: 'top', width: '1%' }}>
                {label}
            </td>
            <td style={{ padding: '6px 0', fontSize: '13px', color: '#1a1a1a', verticalAlign: 'top', overflowWrap: 'break-word', minWidth: 0 }}>
                {value}
            </td>
        </tr>
    );
}

/**
 * Overview tab for the equipment folder.
 *
 * @param {number}      equipmentId
 * @param {Object|null} data         — raw API response from /api/equipment/:id
 * @param {boolean}     loading
 */
function EquipmentOverview({ equipmentId, data, loading, onEdit }) {
    const equipment = data?.equipment ?? data ?? null;

    const rows = useMemo(() => {
        if (!equipment) return [];

        const result = [];

        // VIN or Serial Number — label depends on IsVehicle
        const idValue = equipment['VIN/SerialNumber'] ?? equipment.VINSerialNumber ?? equipment.VIN ?? null;
        if (idValue != null && idValue !== '') {
            result.push({ label: equipment.IsVehicle ? 'VIN' : 'Serial Number', value: idValue });
        }

        for (const field of DETAIL_FIELDS) {
            if (field.vehicleOnly && !equipment.IsVehicle) continue;

            const raw = equipment[field.key];
            if (raw == null || raw === '') continue;

            const value = field.isDate ? (toLocalDisplayLong(raw) || raw) : String(raw);
            result.push({ label: field.label, value });
        }

        return result;
    }, [equipment]);

    if (loading) {
        return <div style={{ padding: '32px', color: '#888', fontSize: '14px' }}>Loading...</div>;
    }

    if (!equipment) {
        return <div style={{ padding: '32px', color: '#888', fontSize: '14px' }}>No data available.</div>;
    }

    return (
        <div className='bubble-container'>
            <div style={{ marginTop: '4px', marginBottom: '8px', padding: '3px'  }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
                        {equipment.Name}
                    </span>
                    {onEdit && (
                        <button
                            type="button"
                            onClick={onEdit}
                            title="Edit equipment"
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

                {equipment.Description && (
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#555' }}>
                        {equipment.Description}
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', padding: '4px 0' }}>

                <div style={{ flex: '0 1 350px', minWidth: '80px' }}>
                    <PhotoViewer
                        domain="equipment"
                        recordId={equipmentId}
                        defaultImage="/images/NoPhoto.png"
                        style={{ width: '100%', aspectRatio: '1 / 1' }}
                    />
                </div>

                {/*  Detail list */}
                <div style={{ flex: '1 0 0', minWidth: '160px'}}>
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
                    domain="equipmentUpload"
                    recordId={equipmentId}
                />
            </div>
        </div>
    );
}

export default EquipmentOverview;