import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import { FormSelect } from './formControls';
import { useUser } from '../UserContext';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function defaultSprayData(username = '', pastureNameProp = '', overrides = {}) {
    const today = toLocalInput(new Date().toISOString());
    return {
        pastureName:         pastureNameProp,
        dateRecorded:        today,
        recordedByUsername:  username,
        dateApplied:         today,
        appliedByUsername:   '',
        chemicalName:        '',
        rate:                '',
        rateUnit:            '',
        acresSprayed:        '',
        windSpeed:           '',
        windDirection:       '',
        temperature:         '',
        temperatureUnit:     'F',
        notes:               '',
        ...overrides
    };
}

/**
 * Add or edit a pasture spray application record.
 *
 * Temp routes:
 *   POST   /api/pasture-spray
 *   PUT    /api/pasture-spray/:id
 *
 * @param {Object|null} initialData
 * @param {string|null} pastureName   - Pre-fills and locks the pasture selector.
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function PastureSprayForm({ initialData = null, pastureName = null, onClose, onSuccess }) {
    const isEditing = !!initialData;
    const { user }  = useUser();

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultSprayData(user?.username, pastureName || ''), ...initialData,
                dateRecorded: toLocalInput(initialData.dateRecorded), dateApplied: toLocalInput(initialData.dateApplied) };
        }
        return defaultSprayData(user?.username, pastureName || '');
    });

    const [dropdownData, setDropdownData] = useState({
        pastures: [], pastureChemicals: [], users: [], _meta: { editable: {} }
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
            if (!formData.pastureName)  e.pastureName  = 'Pasture is required';
            if (!formData.dateApplied)  e.dateApplied  = 'Date applied is required';
            if (!formData.chemicalName) e.chemicalName = 'Chemical is required';
            return e;
        },
        submit: async () => {
            const payload = {
                ...formData,
                dateRecorded:  toUTC(formData.dateRecorded),
                dateApplied:   toUTC(formData.dateApplied),
                rate:          formData.rate         ? parseFloat(formData.rate)         : null,
                acresSprayed:  formData.acresSprayed ? parseFloat(formData.acresSprayed) : null,
                windSpeed:     formData.windSpeed    ? parseFloat(formData.windSpeed)    : null,
                temperature:   formData.temperature  ? parseFloat(formData.temperature)  : null,
            };
            const res = await fetch(
                isEditing ? `/api/pasture-spray/${initialData.id}` : '/api/pasture-spray',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save spray record');
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Application</div>

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

                    <FormField label="Date Applied" required error={errors.dateApplied}>
                        <input type="date" className={`form-input${errors.dateApplied ? ' form-input--error' : ''}`}
                            value={toLocalInput(formData.dateApplied)}
                            onChange={e => { setField('dateApplied', e.target.value); setErrors(p => ({ ...p, dateApplied: '' })); }} />
                    </FormField>

                    <FormField label="Applied By" hint="Leave blank if applied by you">
                        <FormSelect
                            value={formData.appliedByUsername}
                            onChange={val => setField('appliedByUsername', val)}
                            options={dropdownData.users}
                            placeholder="Select user..."
                        />
                    </FormField>

                    <FormField label="Chemical" required error={errors.chemicalName}>
                        <FormSelect
                            value={formData.chemicalName}
                            onChange={val => { setField('chemicalName', val); setErrors(p => ({ ...p, chemicalName: '' })); }}
                            options={dropdownData.pastureChemicals}
                            placeholder="Select chemical..."
                            error={errors.chemicalName}
                            editable={meta.pastureChemicals}
                            table="PastureChemicals"
                            label="Chemical"
                        />
                    </FormField>

                    <FormField label="Application Rate">
                        <div className="form-inline">
                            <input type="number" step="0.001" className="form-input"
                                value={formData.rate} placeholder="0.00"
                                onChange={e => setField('rate', e.target.value)} />
                            <input
                                className="form-input form-select--unit"
                                value={formData.rateUnit} placeholder="oz/acre"
                                list="rate-unit-suggestions"
                                onChange={e => setField('rateUnit', e.target.value)} />
                            <datalist id="rate-unit-suggestions">
                                <option value="oz/acre" />
                                <option value="pt/acre" />
                                <option value="qt/acre" />
                                <option value="lb/acre" />
                                <option value="gal/acre" />
                            </datalist>
                        </div>
                    </FormField>

                    <FormField label="Acres Sprayed">
                        <input type="number" step="0.01" className="form-input"
                            value={formData.acresSprayed} placeholder="0.00"
                            onChange={e => setField('acresSprayed', e.target.value)} />
                    </FormField>

                    <FormField label="Notes">
                        <textarea className="form-textarea" rows={3} value={formData.notes}
                            onChange={e => setField('notes', e.target.value)} />
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Weather Conditions</div>

                    <FormField label="Wind">
                        <div className="form-inline">
                            <input type="number" step="0.1" className="form-input"
                                value={formData.windSpeed} placeholder="Speed (mph)"
                                onChange={e => setField('windSpeed', e.target.value)} />
                            <select className="form-select form-select--unit"
                                value={formData.windDirection}
                                onChange={e => setField('windDirection', e.target.value)}>
                                <option value="">Dir.</option>
                                {WIND_DIRECTIONS.map((d, i) => <option key={i} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </FormField>

                    <FormField label="Temperature">
                        <div className="form-inline">
                            <input type="number" step="0.1" className="form-input"
                                value={formData.temperature} placeholder="0"
                                onChange={e => setField('temperature', e.target.value)} />
                            <select className="form-select form-select--unit"
                                value={formData.temperatureUnit}
                                onChange={e => setField('temperatureUnit', e.target.value)}>
                                <option value="F">°F</option>
                                <option value="C">°C</option>
                            </select>
                        </div>
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Record Metadata</div>

                    <FormField label="Date Recorded">
                        <input type="date" className="form-input" value={toLocalInput(formData.dateRecorded)}
                            onChange={e => setField('dateRecorded', e.target.value)} />
                    </FormField>

                    <FormField label="Recorded By">
                        <input className="form-input" value={formData.recordedByUsername} disabled />
                    </FormField>
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="button" disabled={submitting}>
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Spray Record')}
                </button>
            </div>
        </form>
    );
}

export default PastureSprayForm;