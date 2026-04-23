import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import FormSelect from './formSelect';
import { useUser } from '../UserContext';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

function defaultMaintenanceData(username = '', equipmentIDProp = '', overrides = {}) {
    const today = toLocalInput(new Date().toISOString());
    return {
        equipmentID:           equipmentIDProp,
        dateRecorded:          today,
        recordedByUsername:    username,
        datePerformed:         today,
        performedByUsername:   '',
        title:                 '',
        description:           '',
        serviceType:           '',
        meterReadingAtService: '',
        meterUnit:             '',
        nextServiceDue:        '',
        nextServiceUnits:      '',
        ...overrides
    };
}

/**
 * Add or edit an equipment maintenance record.
 *
 * Temp routes:
 *   POST   /api/equipment-maintenance
 *   PUT    /api/equipment-maintenance/:id
 *
 * @param {Object|null} initialData
 * @param {number|null} equipmentID   - Pre-fills and locks the equipment selector.
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function EquipmentMaintenanceForm({ initialData = null, equipmentID = null, onClose, onSuccess }) {
    const isEditing = !!initialData;
    const { user }  = useUser();

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultMaintenanceData(user?.username, equipmentID || ''), ...initialData,
                dateRecorded: toLocalInput(initialData.dateRecorded), datePerformed: toLocalInput(initialData.datePerformed) };
        }
        return defaultMaintenanceData(user?.username, equipmentID || '');
    });

    const [dropdownData, setDropdownData] = useState({
        serviceTypes: [], meterUnits: [], users: [], equipment: [], _meta: { editable: {} }
    });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
    }, []);

    const setField       = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const equipmentLocked = !!equipmentID || (isEditing && !!initialData.equipmentID);
    const meta           = dropdownData._meta?.editable || {};

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.equipmentID)   e.equipmentID   = 'Equipment is required';
            if (!formData.datePerformed) e.datePerformed  = 'Date performed is required';
            if (!formData.title.trim())  e.title          = 'Title is required';
            return e;
        },
        submit: async () => {
            const payload = {
                ...formData,
                dateRecorded:          toUTC(formData.dateRecorded),
                datePerformed:         toUTC(formData.datePerformed),
                meterReadingAtService: formData.meterReadingAtService ? parseFloat(formData.meterReadingAtService) : null,
                nextServiceDue:        formData.nextServiceDue        ? parseFloat(formData.nextServiceDue)        : null,
            };
            const res = await fetch(
                isEditing ? `/api/equipment-maintenance/${initialData.id}` : '/api/equipment-maintenance',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save maintenance record');
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Service Record</div>

                    <FormField label="Equipment" required error={errors.equipmentID}>
                        <select
                            className={`form-select${errors.equipmentID ? ' form-select--error' : ''}`}
                            value={formData.equipmentID}
                            disabled={equipmentLocked}
                            onChange={e => { setField('equipmentID', e.target.value); setErrors(p => ({ ...p, equipmentID: '' })); }}
                        >
                            <option value="">Select equipment...</option>
                            {dropdownData.equipment.map((eq, i) => (
                                <option key={i} value={eq.id}>{eq.name}</option>
                            ))}
                        </select>
                    </FormField>

                    <FormField label="Title" required error={errors.title}>
                        <input className={`form-input${errors.title ? ' form-input--error' : ''}`}
                            value={formData.title} placeholder="e.g. 250hr Oil & Filter Change"
                            onChange={e => { setField('title', e.target.value); setErrors(p => ({ ...p, title: '' })); }} />
                    </FormField>

                    <FormField label="Service Type">
                        <FormSelect
                            value={formData.serviceType}
                            onChange={val => setField('serviceType', val)}
                            options={dropdownData.serviceTypes}
                            placeholder="Select type..."
                            editable={meta.serviceTypes}
                            table="ServiceTypes"
                            label="Service Type"
                        />
                    </FormField>

                    <FormField label="Description">
                        <textarea className="form-textarea" rows={5} value={formData.description}
                            placeholder="What was done, parts used, observations..."
                            onChange={e => setField('description', e.target.value)} />
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Meter Reading</div>

                    <FormField label="Reading at Service">
                        <div className="form-inline">
                            <input type="number" step="0.1" className="form-input"
                                value={formData.meterReadingAtService} placeholder="e.g. 250"
                                onChange={e => setField('meterReadingAtService', e.target.value)} />
                            <FormSelect
                                value={formData.meterUnit}
                                onChange={val => setField('meterUnit', val)}
                                options={dropdownData.meterUnits}
                                placeholder="Unit..."
                                className="form-select--unit"
                            />
                        </div>
                    </FormField>

                    <FormField label="Next Service Due" hint="Threshold reading at which next service is due">
                        <div className="form-inline">
                            <input type="number" step="0.1" className="form-input"
                                value={formData.nextServiceDue} placeholder="e.g. 500"
                                onChange={e => setField('nextServiceDue', e.target.value)} />
                            <FormSelect
                                value={formData.nextServiceUnits}
                                onChange={val => setField('nextServiceUnits', val)}
                                options={dropdownData.meterUnits}
                                placeholder="Unit..."
                                className="form-select--unit"
                            />
                        </div>
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Date &amp; Personnel</div>

                    <FormField label="Date Performed" required error={errors.datePerformed}>
                        <input type="date" className={`form-input${errors.datePerformed ? ' form-input--error' : ''}`}
                            value={toLocalInput(formData.datePerformed)}
                            onChange={e => { setField('datePerformed', e.target.value); setErrors(p => ({ ...p, datePerformed: '' })); }} />
                    </FormField>

                    <FormField label="Performed By" hint="Leave blank if performed by the logged-in user">
                        <FormSelect
                            value={formData.performedByUsername}
                            onChange={val => setField('performedByUsername', val)}
                            options={dropdownData.users}
                            placeholder="Select user..."
                        />
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
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Record')}
                </button>
            </div>
        </form>
    );
}

export default EquipmentMaintenanceForm;