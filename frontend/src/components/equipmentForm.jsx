import React, { useState, useEffect, useRef } from 'react';
import { useFormSubmit, FormField } from './formKit';
import { FormSelect } from './formControls';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import FileViewer from './FileViewer';
import '../styles/forms.css';

function defaultEquipmentData(overrides = {}) {
    return {
        name:               '',
        description:        '',
        locationID:         '',
        isVehicle:          false,
        equipmentStatus:    '',
        equipmentType:      '',
        make:               '',
        model:              '',
        year:               '',
        serialNumber:       '',
        registration:       '',
        registrationExpiry: '',
        grossWeightRating:  '',
        warrantyExpiry:     '',
        warrantyNotes:      '',
        notes:              '',
        ...overrides
    };
}

function defaultPurchaseData() {
    return { purchaseDate: '', purchasePrice: '', paymentMethod: '', origin: '', purchaseNotes: '' };
}

function defaultSaleData() {
    return { saleDate: '', salePrice: '', paymentMethod: '', customer: '', commission: '', saleNotes: '' };
}

/**
 * Add or edit a piece of equipment.
 *
 * Temp routes:
 *   POST   /api/equipment
 *   PUT    /api/equipment/:id
 *   POST   /api/purchase-records
 *   PUT    /api/purchase-records/:id
 *   POST   /api/sale-records
 *   PUT    /api/sale-records/:id
 *
 * @param {Object|null} initialData
 * @param {Function}    onClose
 * @param {Function}    onSuccess
 */
function EquipmentForm({ initialData = null, onClose, onSuccess }) {
    const isEditing     = !!initialData;
    const fileViewerRef = useRef(null);

    const [formData, setFormData] = useState(() =>
        initialData
            ? { ...defaultEquipmentData(), ...initialData, registrationExpiry: toLocalInput(initialData.registrationExpiry), warrantyExpiry: toLocalInput(initialData.warrantyExpiry) }
            : defaultEquipmentData()
    );

    const [purchaseData, setPurchaseData] = useState(() =>
        initialData?.purchaseRecord
            ? { ...defaultPurchaseData(), ...initialData.purchaseRecord, purchaseDate: toLocalInput(initialData.purchaseRecord.purchaseDate) }
            : defaultPurchaseData()
    );

    const [saleData, setSaleData] = useState(() =>
        initialData?.saleRecord
            ? { ...defaultSaleData(), ...initialData.saleRecord, saleDate: toLocalInput(initialData.saleRecord.saleDate) }
            : defaultSaleData()
    );

    const [dropdownData, setDropdownData] = useState({
        equipmentTypes: [], equipmentStatuses: [], locations: [], paymentMethods: [],
        _meta: { editable: {} }
    });

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
    }, []);

    const setField         = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const setPurchaseField = (f, v) => setPurchaseData(p => ({ ...p, [f]: v }));
    const setSaleField     = (f, v) => setSaleData(p => ({ ...p, [f]: v }));
    const isSold = formData.equipmentStatus === 'Sold';
    const meta   = dropdownData._meta?.editable || {};

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            if (!formData.name.trim())     e.name            = 'Name is required';
            if (!formData.equipmentType)   e.equipmentType   = 'Type is required';
            if (!formData.equipmentStatus) e.equipmentStatus = 'Status is required';
            return e;
        },
        submit: async () => {
            let purchaseRecordID = initialData?.purchaseRecordID || null;
            if (purchaseData.purchaseDate || purchaseData.purchasePrice) {
                const res = await fetch(
                    purchaseRecordID ? `/api/purchases/${purchaseRecordID}` : '/api/purchases',
                    { method: purchaseRecordID ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                      body: JSON.stringify({ ...purchaseData, purchaseDate: purchaseData.purchaseDate ? toUTC(purchaseData.purchaseDate) : null }) }
                );
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to save purchase record');
                purchaseRecordID = (await res.json()).id ?? purchaseRecordID;
            }

            let saleRecordID = initialData?.saleRecordID || null;
            if (isSold && (saleData.saleDate || saleData.salePrice)) {
                const res = await fetch(
                    saleRecordID ? `/api/sales/${saleRecordID}` : '/api/sales',
                    {
                        method: saleRecordID ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                        body: JSON.stringify({ ...saleData, saleDate: saleData.saleDate ? toUTC(saleData.saleDate) : null })
                    }
                );
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to save sale record');
                saleRecordID = (await res.json()).id ?? saleRecordID;
            }

            const { id: _id, purchaseRecord: _pr, saleRecord: _sr, ...formFields } = formData;
            const res = await fetch(
                isEditing ? `/api/equipment/${initialData.id}` : '/api/equipment',
                {
                    method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                    body: JSON.stringify({ ...formFields, registrationExpiry: formData.registrationExpiry ? toUTC(formData.registrationExpiry) : null, warrantyExpiry: formData.warrantyExpiry ? toUTC(formData.warrantyExpiry) : null, purchaseRecordID, saleRecordID: isSold ? saleRecordID : null })
                }
            );
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save equipment');

            if (!isEditing) {
                const { id } = await res.json();
                await fileViewerRef.current?.flushPending(id);
            }
        },
        onSuccess
    });

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div ref={topRef} className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Equipment Details</div>

                    <FormField label="Name" required error={errors.name}>
                        <input className={`form-input${errors.name ? ' form-input--error' : ''}`}
                            value={formData.name} placeholder="e.g. John Deere 5075E"
                            onChange={e => { setField('name', e.target.value); setErrors(p => ({ ...p, name: '' })); }} />
                    </FormField>

                    <FormField label="Type" required error={errors.equipmentType}>
                        <FormSelect
                            value={formData.equipmentType}
                            onChange={val => { setField('equipmentType', val); setErrors(p => ({ ...p, equipmentType: '' })); }}
                            options={dropdownData.equipmentTypes}
                            placeholder="Select type..."
                            error={errors.equipmentType}
                            editable={meta.equipmentTypes}
                            table="EquipmentTypes"
                            label="Equipment Type"
                        />
                    </FormField>

                    <div className="form-checkbox-row" style={{marginTop: '-8px'}}>
                        <input type="checkbox" id="isVehicle" checked={formData.isVehicle}
                            onChange={e => setField('isVehicle', e.target.checked)} />
                        <label htmlFor="isVehicle">This is a vehicle</label>
                    </div>


                    <FormField label="Status" required error={errors.equipmentStatus}>
                        <FormSelect
                            value={formData.equipmentStatus}
                            onChange={val => { setField('equipmentStatus', val); setErrors(p => ({ ...p, equipmentStatus: '' })); }}
                            options={dropdownData.equipmentStatuses}
                            placeholder="Select status..."
                            error={errors.equipmentStatus}
                        />
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Specifications</div>

                    <FormField label="Make">
                        <input className="form-input" value={formData.make} placeholder="e.g. John Deere"
                            onChange={e => setField('make', e.target.value)} />
                    </FormField>

                    <FormField label="Model">
                        <input className="form-input" value={formData.model} placeholder="e.g. 5075E"
                            onChange={e => setField('model', e.target.value)} />
                    </FormField>

                    <FormField label="Year">
                        <input type="number" className="form-input" value={formData.year} placeholder="e.g. 2021"
                            min="1900" max={new Date().getFullYear() + 2}
                            onChange={e => setField('year', e.target.value)} />
                    </FormField>

                    <FormField label={formData.isVehicle ? 'VIN' : 'Serial Number'}>
                        <input className="form-input" value={formData.serialNumber}
                            onChange={e => setField('serialNumber', e.target.value)} />
                    </FormField>

                    {formData.isVehicle && (<>
                        <FormField label="Plate / Registration Number">
                            <input className="form-input" value={formData.registration}
                                onChange={e => setField('registration', e.target.value)} />
                        </FormField>
                        <FormField label="Registration Expiry">
                            <input type="date" className="form-input" value={toLocalInput(formData.registrationExpiry)}
                                onChange={e => setField('registrationExpiry', e.target.value)} />
                        </FormField>
                        <FormField label="Gross Weight Rating">
                            <input className="form-input" value={formData.grossWeightRating} placeholder="e.g. 10,000 lbs"
                                onChange={e => setField('grossWeightRating', e.target.value)} />
                        </FormField>
                    </>)}
                </div>

                <div className="form-col">
                    <div className="form-section-title">Location</div>


                    <FormField label="Location">
                        <select className="form-select" value={formData.locationID}
                            onChange={e => setField('locationID', e.target.value)}>
                            <option value="">Select location...</option>
                            {dropdownData.locations.map((l, i) => (
                                <option key={i} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Warranty</div>

                    <FormField label="Warranty Expiry">
                        <input type="date" className="form-input" value={toLocalInput(formData.warrantyExpiry)}
                            onChange={e => setField('warrantyExpiry', e.target.value)} />
                    </FormField>

                    <FormField label="Warranty Notes">
                        <textarea className="form-textarea" rows={3} value={formData.warrantyNotes}
                            placeholder="Coverage details, claim contact, etc."
                            onChange={e => setField('warrantyNotes', e.target.value)} />
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>Description</div>

                    <FormField label="Description">
                        <textarea className="form-textarea" rows={3} value={formData.description}
                            placeholder="Optional description"
                            onChange={e => setField('description', e.target.value)} />
                    </FormField>

                    <FormField label="Notes">
                        <textarea className="form-textarea" rows={3} value={formData.notes}
                            placeholder="Any additional notes..."
                            onChange={e => setField('notes', e.target.value)} />
                    </FormField>
                </div>
            </div>

            {isSold && (
                <div className="form-info-panel">
                    <div className="form-section-title">Sale Details</div>
                    <div className="form-grid" style={{ padding: 0, gap: '16px' }}>
                        <div className="form-col">
                            <FormField label="Sale Date">
                                <input type="date" className="form-input" value={toLocalInput(saleData.saleDate)}
                                    onChange={e => setSaleField('saleDate', e.target.value)} />
                            </FormField>
                            <FormField label="Sale Price">
                                <input type="number" step="0.01" className="form-input" value={saleData.salePrice} placeholder="0.00"
                                    onChange={e => setSaleField('salePrice', e.target.value)} />
                            </FormField>
                            <FormField label="Payment Method">
                                <FormSelect value={saleData.paymentMethod} onChange={val => setSaleField('paymentMethod', val)}
                                    options={dropdownData.paymentMethods} placeholder="Select..." />
                            </FormField>
                        </div>
                        <div className="form-col">
                            <FormField label="Customer">
                                <input className="form-input" value={saleData.customer} placeholder="Buyer name"
                                    onChange={e => setSaleField('customer', e.target.value)} />
                            </FormField>
                            <FormField label="Commission">
                                <input type="number" step="0.01" className="form-input" value={saleData.commission} placeholder="0.00"
                                    onChange={e => setSaleField('commission', e.target.value)} />
                            </FormField>
                            <FormField label="Sale Notes">
                                <textarea className="form-textarea" rows={3} value={saleData.saleNotes}
                                    onChange={e => setSaleField('saleNotes', e.target.value)} />
                            </FormField>
                        </div>
                    </div>
                </div>
            )}

            <div className="form-info-panel form-info-panel--neutral">
                <div className="form-section-title">Purchase Details</div>
                <div className="form-grid" style={{ padding: 0, gap: '16px' }}>
                    <div className="form-col">
                        <FormField label="Purchase Date">
                            <input type="date" className="form-input" value={toLocalInput(purchaseData.purchaseDate)}
                                onChange={e => setPurchaseField('purchaseDate', e.target.value)} />
                        </FormField>
                        <FormField label="Purchase Price">
                            <input type="number" step="0.01" className="form-input" value={purchaseData.purchasePrice} placeholder="0.00"
                                onChange={e => setPurchaseField('purchasePrice', e.target.value)} />
                        </FormField>
                        <FormField label="Payment Method">
                            <FormSelect value={purchaseData.paymentMethod} onChange={val => setPurchaseField('paymentMethod', val)}
                                options={dropdownData.paymentMethods} placeholder="Select..." />
                        </FormField>
                    </div>
                    <div className="form-col">
                        <FormField label="Origin / Seller">
                            <input className="form-input" value={purchaseData.origin} placeholder="Where purchased from"
                                onChange={e => setPurchaseField('origin', e.target.value)} />
                        </FormField>
                        <FormField label="Purchase Notes">
                            <textarea className="form-textarea" rows={4} value={purchaseData.purchaseNotes}
                                onChange={e => setPurchaseField('purchaseNotes', e.target.value)} />
                        </FormField>
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
                <div className="form-section-title" style={{ marginBottom: '12px' }}>Attachments</div>
                <FileViewer
                    ref={fileViewerRef}
                    domain="equipmentUpload"
                    recordId={isEditing ? initialData.id : null}
                />
            </div>

            <div className="form-actions">
                <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="button" disabled={submitting}>
                    {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Equipment')}
                </button>
            </div>
        </form>
    );
}

export default EquipmentForm;