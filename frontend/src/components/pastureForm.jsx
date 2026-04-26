import React, { useState, useEffect, useRef } from 'react';
import { useFormSubmit, FormField, nullifyEmpty } from './formKit';
import { FormSelect } from './formControls';
import FileViewer from './FileViewer';
import '../styles/forms.css';

// FIX: FK fields (pastureType, vegetationType, areaUnits) default to null, not ''.
// pastureName is the string PK — it stays '' so the required validation fires correctly.
function defaultPastureData(overrides = {}) {
    return { pastureName: '', pastureType: null, vegetationType: null, area: '', areaUnits: null, notes: '', ...overrides };
}

/**
 * Add or edit a pasture record. PastureName is the PK and is locked in edit mode.
 *
 * Routes:
 *   POST   /api/pastures
 *   PUT    /api/pastures/:name
 *
 * @param {Object|null} initialData
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function PastureForm({ initialData = null, onClose, onSuccess }) {
    const isEditing    = !!initialData;
    const fileViewerRef = useRef(null);

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
            const { id: _id, ...formFields } = formData;
            const payload = nullifyEmpty(formFields);
            const res = await fetch(
                isEditing ? `/api/pastures/${encodeURIComponent(initialData.pastureName)}` : '/api/pastures',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save pasture');
            const result = await res.json();
            // PastureName is known before creation, so we can flush immediately.
            if (!isEditing) {
                await fileViewerRef.current?.flushPending(formData.pastureName.trim());
            }
            return result;
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

            <div style={{ padding: '0 20px 20px' }}>
                <div className="form-section-title" style={{ marginBottom: '12px' }}>Attachments</div>
                <FileViewer
                    ref={fileViewerRef}
                    domain="pastureUpload"
                    recordId={isEditing ? initialData.pastureName : null}
                />
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