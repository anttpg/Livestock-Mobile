import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import FormSelect from './formSelect';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

function defaultPastureData(overrides = {}) {
    return { pastureName: '', pastureType: '', vegetationType: '', area: '', areaUnits: '', notes: '', ...overrides };
}

/**
 * Add or edit a pasture record. PastureName is the PK and is locked in edit mode.
 *
 * Temp routes:
 *   POST   /api/pastures
 *   PUT    /api/pastures/:name
 *
 * @param {Object|null} initialData
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function PastureForm({ initialData = null, onClose, onSuccess }) {
    const isEditing = !!initialData;

    const [formData, setFormData] = useState(() =>
        initialData ? { ...defaultPastureData(), ...initialData } : defaultPastureData()
    );

    const [dropdownData, setDropdownData] = useState({
        pastureTypes: [], vegetationTypes: [], landUnits: [], _meta: { editable: {} }
    });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
    }, []);

    const setField = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const meta     = dropdownData._meta?.editable || {};

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.pastureName.trim()) e.pastureName = 'Pasture name is required';
            return e;
        },
        submit: async () => {
            const res = await fetch(
                isEditing ? `/api/pastures/${encodeURIComponent(initialData.pastureName)}` : '/api/pastures',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(formData) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save pasture');
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Pasture Details</div>

                    <FormField label="Pasture Name" required error={errors.pastureName}>
                        <input
                            className={`form-input${errors.pastureName ? ' form-input--error' : ''}`}
                            value={formData.pastureName}
                            disabled={isEditing}
                            placeholder="e.g. North Pasture"
                            onChange={e => { setField('pastureName', e.target.value); setErrors(p => ({ ...p, pastureName: '' })); }}
                        />
                    </FormField>

                    <FormField label="Pasture Type">
                        <FormSelect
                            value={formData.pastureType}
                            onChange={val => setField('pastureType', val)}
                            options={dropdownData.pastureTypes}
                            placeholder="Select type..."
                            editable={meta.pastureTypes}
                            table="PastureTypes"
                            label="Pasture Type"
                        />
                    </FormField>

                    <FormField label="Vegetation Type">
                        <FormSelect
                            value={formData.vegetationType}
                            onChange={val => setField('vegetationType', val)}
                            options={dropdownData.vegetationTypes}
                            placeholder="Select vegetation..."
                            editable={meta.vegetationTypes}
                            table="VegetationTypes"
                            label="Vegetation Type"
                        />
                    </FormField>

                    <FormField label="Area">
                        <div className="form-inline">
                            <input type="number" step="0.01" className="form-input"
                                value={formData.area} placeholder="0.00"
                                onChange={e => setField('area', e.target.value)} />
                            <FormSelect
                                value={formData.areaUnits}
                                onChange={val => setField('areaUnits', val)}
                                options={dropdownData.landUnits}
                                placeholder="Unit"
                                editable={meta.landUnits}
                                table="LandUnits"
                                label="Land Unit"
                                className="form-select--unit"
                            />
                        </div>
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Notes</div>
                    <FormField label="Notes">
                        <textarea className="form-textarea" rows={6} value={formData.notes}
                            placeholder="Any additional notes about this pasture..."
                            onChange={e => setField('notes', e.target.value)} />
                    </FormField>
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="button" disabled={submitting}>
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Pasture')}
                </button>
            </div>
        </form>
    );
}

export default PastureForm;