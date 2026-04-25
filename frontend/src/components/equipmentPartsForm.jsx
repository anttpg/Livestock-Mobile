import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import { useUser } from '../UserContext';
import '../styles/forms.css';

function defaultPartsData(equipmentIDProp = '', overrides = {}) {
    return {
        equipmentID:  equipmentIDProp,
        partType:     '',
        partNumber:   '',
        manufacturer: '',
        notes:        '',
        visible:      true,
        ...overrides
    };
}

/**
 * Add or edit an equipment part record.
 *
 * Routes:
 *   POST   /api/equipment-parts
 *   PUT    /api/equipment-parts/:id
 *
 * @param {Object|null} initialData
 * @param {number|null} equipmentID  - Pre-fills and locks the equipment selector.
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 * @param {Function}    onError
 */
function EquipmentPartsForm({ initialData = null, equipmentID = null, onClose, onSuccess, onError }) {
    const isEditing = !!initialData;

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultPartsData(equipmentID || ''), ...initialData };
        }
        return defaultPartsData(equipmentID || '');
    });

    const [dropdownData, setDropdownData] = useState({ equipment: [] });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setDropdownData(d); })
            .catch(console.error);
    }, []);

    const setField        = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const equipmentLocked = !!equipmentID || (isEditing && !!initialData?.equipmentID);

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.equipmentID)        e.equipmentID = 'Equipment is required';
            if (!formData.partNumber?.trim())  e.partNumber  = 'Part number is required';
            return e;
        },
        submit: async () => {
            const payload = {
                equipmentID:  parseInt(formData.equipmentID),
                partType:     formData.partType     || null,
                partNumber:   formData.partNumber.trim(),
                manufacturer: formData.manufacturer || null,
                notes:        formData.notes        || null,
                visible:      formData.visible,
            };
            const res = await fetch(
                isEditing
                    ? `/api/equipment-parts/${initialData.ID}`
                    : '/api/equipment-parts',
                {
                    method:      isEditing ? 'PUT' : 'POST',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body:        JSON.stringify(payload)
                }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save part record');
            return await res.json();
        },
        onSuccess,
        onError
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Part Details</div>

                    <FormField label="Equipment" required error={errors.equipmentID}>
                        <select
                            className={`form-select${errors.equipmentID ? ' form-select--error' : ''}`}
                            value={formData.equipmentID}
                            disabled={equipmentLocked}
                            onChange={e => { setField('equipmentID', e.target.value); setErrors(p => ({ ...p, equipmentID: '' })); }}
                        >
                            <option value="">Select equipment...</option>
                            {(dropdownData.equipment ?? []).map((eq, i) => (
                                <option key={i} value={eq.id}>{eq.name}</option>
                            ))}
                        </select>
                    </FormField>

                    <FormField label="Part Number" required error={errors.partNumber}>
                        <input
                            className={`form-input${errors.partNumber ? ' form-input--error' : ''}`}
                            value={formData.partNumber}
                            placeholder="e.g. PH3600, 49065-7007"
                            onChange={e => { setField('partNumber', e.target.value); setErrors(p => ({ ...p, partNumber: '' })); }}
                        />
                    </FormField>

                    <FormField label="Part Type" hint="e.g. Oil Filter, Air Filter, Spark Plug">
                        <input
                            className="form-input"
                            value={formData.partType}
                            placeholder="e.g. Oil Filter"
                            onChange={e => setField('partType', e.target.value)}
                        />
                    </FormField>

                    <FormField label="Manufacturer">
                        <input
                            className="form-input"
                            value={formData.manufacturer}
                            placeholder="e.g. Wix, Fram, NGK"
                            onChange={e => setField('manufacturer', e.target.value)}
                        />
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Additional Info</div>

                    <FormField label="Notes">
                        <textarea
                            className="form-textarea"
                            rows={4}
                            value={formData.notes}
                            placeholder="Cross-references, fitment notes, where to purchase..."
                            onChange={e => setField('notes', e.target.value)}
                        />
                    </FormField>

                    <FormField label="Visible" hint="Uncheck to hide this part from the parts list without deleting it">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.visible}
                                onChange={e => setField('visible', e.target.checked)}
                                style={{ width: '15px', height: '15px' }}
                            />
                            <span className="form-hint-text">Show in parts list</span>
                        </label>
                    </FormField>
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
                    Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                    {submitting
                        ? (isEditing ? 'Saving...'    : 'Adding...')
                        : (isEditing ? 'Save Changes' : 'Add Part')}
                </button>
            </div>
        </form>
    );
}

export default EquipmentPartsForm;