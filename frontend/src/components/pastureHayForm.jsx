import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import { FormSelect } from './formControls';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

function defaultHayData(pastureNameProp = '', overrides = {}) {
    return {
        pastureName:    pastureNameProp,
        dateMowed:      '',
        dateBaled:      '',
        acresCut:       '',
        vegetationType: '',
        unitsProduced:  '',
        hayUnitType:    '',
        weightProduced: '',
        notes:          '',
        ...overrides
    };
}

/**
 * Add or edit a hay production record.
 *
 * Temp routes:
 *   POST   /api/pasture-hay
 *   PUT    /api/pasture-hay/:id
 *
 * @param {Object|null} initialData
 * @param {string|null} pastureName   - Pre-fills and locks the pasture selector.
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function PastureHayForm({ initialData = null, pastureName = null, onClose, onSuccess }) {
    const isEditing = !!initialData;

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultHayData(pastureName || ''), ...initialData,
                dateMowed: toLocalInput(initialData.dateMowed), dateBaled: toLocalInput(initialData.dateBaled) };
        }
        return defaultHayData(pastureName || '');
    });

    const [dropdownData, setDropdownData] = useState({
        pastures: [], vegetationTypes: [], hayUnitTypes: [], _meta: { editable: {} }
    });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
    }, []);

    const setField      = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const pastureLocked = !!pastureName || (isEditing && !!initialData.pastureName);
    const meta          = dropdownData._meta?.editable || {};

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.pastureName) e.pastureName = 'Pasture is required';
            return e;
        },
        submit: async () => {
            const payload = {
                ...formData,
                dateMowed:      formData.dateMowed      ? toUTC(formData.dateMowed)               : null,
                dateBaled:      formData.dateBaled      ? toUTC(formData.dateBaled)               : null,
                acresCut:       formData.acresCut       ? parseFloat(formData.acresCut)           : null,
                unitsProduced:  formData.unitsProduced  ? parseFloat(formData.unitsProduced)      : null,
                weightProduced: formData.weightProduced ? parseFloat(formData.weightProduced)     : null,
            };
            const res = await fetch(
                isEditing ? `/api/pasture-hay/${initialData.id}` : '/api/pasture-hay',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save hay record');
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Production Details</div>

                    <FormField label="Pasture" required error={errors.pastureName}>
                        <FormSelect
                            value={formData.pastureName}
                            onChange={val => { setField('pastureName', val); setErrors(p => ({ ...p, pastureName: '' })); }}
                            options={dropdownData.pastures}
                            placeholder="Select pasture..."
                            error={errors.pastureName}
                            disabled={pastureLocked}
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

                    <FormField label="Date Mowed">
                        <input type="date" className="form-input" value={toLocalInput(formData.dateMowed)}
                            onChange={e => setField('dateMowed', e.target.value)} />
                    </FormField>

                    <FormField label="Date Baled">
                        <input type="date" className="form-input" value={toLocalInput(formData.dateBaled)}
                            onChange={e => setField('dateBaled', e.target.value)} />
                    </FormField>

                    <FormField label="Acres Cut">
                        <input type="number" step="0.01" className="form-input"
                            value={formData.acresCut} placeholder="0.00"
                            onChange={e => setField('acresCut', e.target.value)} />
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Yield</div>

                    <FormField label="Units Produced">
                        <div className="form-inline">
                            <input type="number" step="0.01" className="form-input"
                                value={formData.unitsProduced} placeholder="0"
                                onChange={e => setField('unitsProduced', e.target.value)} />
                            <FormSelect
                                value={formData.hayUnitType}
                                onChange={val => setField('hayUnitType', val)}
                                options={dropdownData.hayUnitTypes}
                                placeholder="Type"
                                editable={meta.hayUnitTypes}
                                table="HayUnitTypes"
                                label="Hay Unit Type"
                                className="form-select--unit"
                            />
                        </div>
                    </FormField>

                    <FormField label="Weight Produced" hint="Total weight in lbs — optional if unit count is sufficient">
                        <input type="number" step="0.01" className="form-input"
                            value={formData.weightProduced} placeholder="0.00 lbs"
                            onChange={e => setField('weightProduced', e.target.value)} />
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Notes</div>

                    <FormField label="Notes">
                        <textarea className="form-textarea" rows={5} value={formData.notes}
                            placeholder="Field condition, weather, equipment used..."
                            onChange={e => setField('notes', e.target.value)} />
                    </FormField>
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="button" disabled={submitting}>
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Hay Record')}
                </button>
            </div>
        </form>
    );
}

export default PastureHayForm;