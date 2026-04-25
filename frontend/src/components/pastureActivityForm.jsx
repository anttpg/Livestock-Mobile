import React, { useState, useEffect } from 'react';
import { useFormSubmit, FormField } from './formKit';
import { FormSelect } from './formControls';
import { useUser } from '../UserContext';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

function defaultActivityData(username = '', pastureNameProp = '', overrides = {}) {
    const today = toLocalInput(new Date().toISOString());
    return {
        pastureName:         pastureNameProp,
        dateRecorded:        today,
        recordedByUsername:  username,
        datePerformed:       today,
        performedByUsername: '',
        title:               '',
        description:         '',
        activityType:        '',
        ...overrides
    };
}

/**
 * Add or edit a pasture activity record.
 *
 * Temp routes:
 *   POST   /api/pasture-activity
 *   PUT    /api/pasture-activity/:id
 *
 * @param {Object|null} initialData
 * @param {string|null} pastureName   - Pre-fills and locks the pasture selector.
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function PastureActivityForm({ initialData = null, pastureName = null, onClose, onSuccess }) {
    const isEditing = !!initialData;
    const { user }  = useUser();

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultActivityData(user?.username, pastureName || ''), ...initialData,
                dateRecorded: toLocalInput(initialData.dateRecorded), datePerformed: toLocalInput(initialData.datePerformed) };
        }
        return defaultActivityData(user?.username, pastureName || '');
    });

    const [dropdownData, setDropdownData] = useState({
        pastures: [], pastureActivityTypes: [], users: [], _meta: { editable: {} }
    });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
    }, []);

    const setField       = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const pastureLocked  = !!pastureName || (isEditing && !!initialData.pastureName);
    const meta           = dropdownData._meta?.editable || {};

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.pastureName)   e.pastureName   = 'Pasture is required';
            if (!formData.datePerformed) e.datePerformed  = 'Date performed is required';
            if (!formData.title.trim())  e.title          = 'Title is required';
            return e;
        },
        submit: async () => {
            const payload = { ...formData, dateRecorded: toUTC(formData.dateRecorded), datePerformed: toUTC(formData.datePerformed) };
            const res = await fetch(
                isEditing ? `/api/pasture-activity/${initialData.id}` : '/api/pasture-activity',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save activity record');
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Activity</div>

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

                    <FormField label="Title" required error={errors.title}>
                        <input className={`form-input${errors.title ? ' form-input--error' : ''}`}
                            value={formData.title} placeholder="e.g. Bush-hogged back section"
                            onChange={e => { setField('title', e.target.value); setErrors(p => ({ ...p, title: '' })); }} />
                    </FormField>

                    <FormField label="Activity Type">
                        <FormSelect
                            value={formData.activityType}
                            onChange={val => setField('activityType', val)}
                            options={dropdownData.pastureActivityTypes}
                            placeholder="Select type..."
                            editable={meta.pastureActivityTypes}
                            table="PastureActivityTypes"
                            label="Activity Type"
                        />
                    </FormField>

                    <FormField label="Description">
                        <textarea className="form-textarea" rows={5} value={formData.description}
                            placeholder="Details about what was done..."
                            onChange={e => setField('description', e.target.value)} />
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Date &amp; Personnel</div>

                    <FormField label="Date Performed" required error={errors.datePerformed}>
                        <input type="date" className={`form-input${errors.datePerformed ? ' form-input--error' : ''}`}
                            value={toLocalInput(formData.datePerformed)}
                            onChange={e => { setField('datePerformed', e.target.value); setErrors(p => ({ ...p, datePerformed: '' })); }} />
                    </FormField>

                    <FormField label="Performed By" hint="Leave blank if performed by you">
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
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Activity')}
                </button>
            </div>
        </form>
    );
}

export default PastureActivityForm;