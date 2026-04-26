import React, { useState, useEffect, useRef } from 'react';
import { useFormSubmit, FormField, nullifyEmpty } from './formKit';
import { FormSelect, FormSelectBasic, FormValueUnit } from './formControls';
import { useUser } from '../UserContext';
import { useRecordMeta } from './formKit';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import FileViewer from './FileViewer';
import '../styles/forms.css';

// FIX: FK fields (equipmentID, performedByUsername) default to null, not ''.
// Submitting '' for an FK column causes foreign key constraint errors.
function defaultMaintenanceData(equipmentIDProp = null, overrides = {}) {
    const today = toLocalInput(new Date().toISOString());
    return {
        equipmentID:           equipmentIDProp,
        datePerformed:         today,
        performedByUsername:   null,
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
    const isEditing     = !!initialData;
    const { user }      = useUser();
    const { recordMeta} = useRecordMeta();
    const fileViewerRef = useRef(null);

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return {
                // FIX: use ?? null (not || '') for FK fields so a falsy-but-set value
                // (e.g. 0) isn't replaced, and an absent value lands as null not ''.
                ...defaultMaintenanceData(equipmentID ?? initialData.equipmentID ?? initialData.EquipmentID ?? null),
                datePerformed:         toLocalInput(initialData.datePerformed  || initialData.DatePerformed),
                performedByUsername:   initialData.performedByUsername  ?? initialData.PerformedByUsername  ?? null,
                title:                 initialData.title                ?? initialData.Title                ?? '',
                description:           initialData.description          ?? initialData.Description          ?? '',
                serviceType:           initialData.serviceType          ?? initialData.ServiceType          ?? '',
                meterReadingAtService: initialData.meterReadingAtService ?? initialData.MeterReadingAtService ?? '',
                meterUnit:             initialData.meterUnit            ?? initialData.MeterUnit            ?? '',
                nextServiceDue:        initialData.nextServiceDue       ?? initialData.NextServiceDue       ?? '',
                nextServiceUnits:      initialData.nextServiceUnits     ?? initialData.NextServiceUnits     ?? '',
            };
        }
        // FIX: ?? null so a null equipmentID prop stays null rather than becoming ''.
        return defaultMaintenanceData(equipmentID ?? null);
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
            const _id = initialData?.ID ?? initialData?.id;
            const { ID: _, id: __, ...formFields } = formData;   // strip both casings from the payload

            // FIX: wrap payload in nullifyEmpty so any stray '' values on FK or
            // optional fields don't reach the DB as empty strings.
            // Numeric coercions are applied first so they are preserved as-is.
            const payload = nullifyEmpty({
                ...formFields,
                ...recordMeta,
                datePerformed: toUTC(formData.datePerformed),
                meterReadingAtService: formData.meterReadingAtService ? parseFloat(formData.meterReadingAtService) : null,
                nextServiceDue: formData.nextServiceDue ? parseFloat(formData.nextServiceDue) : null,
            });

            const res = await fetch(
                isEditing ? `/api/equipment-maintenance/${_id}` : '/api/equipment-maintenance',
                { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save maintenance record');

            // FIX: consume the response body exactly once and return the result.
            // Previously res.json() was called inside the isEditing branch for
            // flushPending and never returned, so useTableEdit edit mode never
            // received the record back.
            const result = await res.json();
            if (!isEditing) {
                await fileViewerRef.current?.flushPending(result.id);
            }
            return result;
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Service Record</div>

                    {/* FIX: replace raw <select> with FormSelectBasic so an empty
                        selection emits null rather than ''. The field is still
                        disabled when locked; FormSelectBasic forwards the prop. */}
                    <FormField label="Equipment" required error={errors.equipmentID}>
                        <FormSelectBasic
                            value={formData.equipmentID}
                            onChange={val => { setField('equipmentID', val); setErrors(p => ({ ...p, equipmentID: '' })); }}
                            options={dropdownData.equipment}
                            placeholder="Select equipment..."
                            disabled={equipmentLocked}
                            error={errors.equipmentID}
                        />
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
                        <FormValueUnit
                            value={formData.meterReadingAtService}
                            onValueChange={val => setField('meterReadingAtService', val)}
                            unit={formData.meterUnit}
                            onUnitChange={val => setField('meterUnit', val)}
                            unitOptions={dropdownData.meterUnits}
                            valuePlaceholder="e.g. 250"
                            step="0.1"
                        />
                    </FormField>

                    <FormField label="Next Service Due" hint="Threshold reading at which next service is due">
                        <FormValueUnit
                            value={formData.nextServiceDue}
                            onValueChange={val => setField('nextServiceDue', val)}
                            unit={formData.nextServiceUnits}
                            onUnitChange={val => setField('nextServiceUnits', val)}
                            unitOptions={dropdownData.meterUnits}
                            valuePlaceholder="e.g. 500"
                            step="0.1"
                        />
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
                </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
                <div className="form-section-title" style={{ marginBottom: '12px' }}>Attachments</div>
                <FileViewer
                    ref={fileViewerRef}
                    domain="equipmentMaintenanceUpload"
                    recordId={isEditing ? initialData.ID : null}
                />
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