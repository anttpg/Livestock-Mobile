import React, { useState, useEffect } from 'react';
import { FormField, useFormSubmit} from './formKit';
import FormSelect from './formSelect';
import TagGenerator from './tagGenerator';
import AnimalCombobox from './animalCombobox';
import { toUTC, toLocalInput } from '../utils/dateUtils';
import '../styles/forms.css';

function defaultAnimalData(overrides = {}) {
    return {
        cowTag:          '',
        dateOfBirth:     toLocalInput(new Date().toISOString()),
        description:     '',
        dam:             '',
        sire:            '',
        sex:             '',
        castrated:       null,
        status:          'Current',
        damDiedAtBirth:  false,
        calfDiedAtBirth: false,
        currentHerd:     '',
        breed:           '',
        temperament:     '',
        regCert:         '',
        regCertNumber:   '',
        birthweight:     '',
        animalClass:     '',
        targetPrice:     '',
        ...overrides
    };
}

async function submitAnimalRecord(data, { method = 'POST', url = '/api/cows', calvingRecordID = null } = {}) {
    const payload = {
        ...data,
        dateOfBirth:    toUTC(data.dateOfBirth),
        castrated:      data.sex === 'Male' ? data.castrated : null,
        calvingRecordID,
    };
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${method === 'PUT' ? 'update' : 'add'} animal`);
    }
    const result = await res.json();
    if (result.warning) alert(`Operation successful. Warning: ${result.warning}`);
    return result;
}

function UnknownTagWarning({ tag, onDismiss }) {
    return (
        <div className="form-warning">
            <span><strong>{tag}</strong> does not exist in the database. If intentional, dismiss this.</span>
            <button type="button" className="form-warning__dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
    );
}

function AnimalFieldSet({
    formData, onChange, errors, onClearError,
    dropdownData, animalOptions,
    tagLocked = false, damLocked = false, sireLocked = false,
    onGenerateTag = null,
}) {
    const [damWarningDismissed,  setDamWarningDismissed]  = useState(false);
    const [sireWarningDismissed, setSireWarningDismissed] = useState(false);

    const females = animalOptions.filter(o => o.sex === 'Female');
    const males   = animalOptions.filter(o => o.sex === 'Male');
    const tagExists = (tag, opts) => !tag || opts.some(o => o.value.toLowerCase() === tag.toLowerCase());
    const damNotFound  = !tagExists(formData.dam,  females);
    const sireNotFound = !tagExists(formData.sire, males);

    const set = (field, value) => {
        onChange(field, value);
        if (field === 'dam')  setDamWarningDismissed(false);
        if (field === 'sire') setSireWarningDismissed(false);
    };

    const meta = dropdownData._meta?.editable || {};

    return (
        <div className="form-grid">
            <div className="form-col">
                <div className="form-section-title">Basic Information</div>

                <FormField label="Cow Tag" required error={errors.cowTag}>
                    <div className="form-inline">
                        <input
                            className={`form-input${errors.cowTag ? ' form-input--error' : ''}`}
                            value={formData.cowTag}
                            onChange={e => { onChange('cowTag', e.target.value); onClearError?.('cowTag'); }}
                            disabled={tagLocked}
                            placeholder="Enter unique tag"
                        />
                        {!tagLocked && onGenerateTag && (
                            <button type="button" className="button" style={{ whiteSpace: 'nowrap' }} onClick={onGenerateTag}>
                                Generate
                            </button>
                        )}
                    </div>
                </FormField>

                <FormField label="Date of Birth">
                    <input
                        type="date"
                        className="form-input"
                        value={toLocalInput(formData.dateOfBirth)}
                        onChange={e => onChange('dateOfBirth', e.target.value)}
                    />
                </FormField>

                <FormField label="Description">
                    <input
                        className="form-input"
                        value={formData.description}
                        onChange={e => onChange('description', e.target.value)}
                        placeholder="Optional description"
                    />
                </FormField>

                <FormField label="Dam">
                    <AnimalCombobox
                        options={females}
                        value={formData.dam}
                        onChange={val => set('dam', val)}
                        onSelect={val => set('dam', val)}
                        placeholder="Mother's tag"
                        allowCustomValue
                        clearOnOpen={false}
                        disabled={damLocked}
                        className={`form-input${damNotFound && !damWarningDismissed ? ' form-input--warning' : ''}`}
                    />
                    {damNotFound && !damWarningDismissed && (
                        <UnknownTagWarning tag={formData.dam} onDismiss={() => setDamWarningDismissed(true)} />
                    )}
                </FormField>

                <div className="form-checkbox-row">
                    <input type="checkbox" id={`damDied-${formData.cowTag}`}
                        checked={formData.damDiedAtBirth}
                        onChange={e => onChange('damDiedAtBirth', e.target.checked)} />
                    <label htmlFor={`damDied-${formData.cowTag}`}>Mother died during childbirth?</label>
                </div>

                <FormField label="Sire">
                    <AnimalCombobox
                        options={males}
                        value={formData.sire}
                        onChange={val => set('sire', val)}
                        onSelect={val => set('sire', val)}
                        placeholder="Father's tag"
                        allowCustomValue
                        clearOnOpen={false}
                        disabled={sireLocked}
                        className={`form-input${sireNotFound && !sireWarningDismissed ? ' form-input--warning' : ''}`}
                    />
                    {sireNotFound && !sireWarningDismissed && (
                        <UnknownTagWarning tag={formData.sire} onDismiss={() => setSireWarningDismissed(true)} />
                    )}
                </FormField>

                <FormField label="Sex" required error={errors.sex}>
                    <FormSelect
                        value={formData.sex}
                        onChange={val => { onChange('sex', val); onClearError?.('sex'); }}
                        options={dropdownData.sexes}
                        placeholder="Select sex..."
                        error={errors.sex}
                    />
                </FormField>

                {formData.sex === 'Male' && (
                    <FormField label="Castrated">
                        <select
                            className="form-select"
                            value={formData.castrated === null ? '' : formData.castrated ? 'yes' : 'no'}
                            onChange={e => onChange('castrated', e.target.value === '' ? null : e.target.value === 'yes')}
                        >
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </FormField>
                )}

                <FormField label="Status">
                    <FormSelect
                        value={formData.calfDiedAtBirth ? 'Dead' : formData.status}
                        onChange={val => onChange('status', val)}
                        options={dropdownData.statuses}
                        disabled={formData.calfDiedAtBirth}
                    />
                </FormField>

                <div className="form-checkbox-row">
                    <input type="checkbox" id={`calfDied-${formData.cowTag}`}
                        checked={formData.calfDiedAtBirth}
                        onChange={e => onChange('calfDiedAtBirth', e.target.checked)} />
                    <label htmlFor={`calfDied-${formData.cowTag}`}>Animal died during childbirth?</label>
                </div>
            </div>

            <div className="form-col">
                <div className="form-section-title">Management Info</div>

                <FormField label="Current Herd">
                    <FormSelect
                        value={formData.currentHerd}
                        onChange={val => onChange('currentHerd', val)}
                        options={dropdownData.herds}
                        placeholder="Select herd..."
                    />
                </FormField>

                <FormField label="Breed">
                    <FormSelect
                        value={formData.breed}
                        onChange={val => onChange('breed', val)}
                        options={dropdownData.breeds}
                        placeholder="Select breed..."
                        editable={meta.breeds}
                        table="Breed"
                        label="Breed"
                    />
                </FormField>

                <FormField label="Temperament">
                    <FormSelect
                        value={formData.temperament}
                        onChange={val => onChange('temperament', val)}
                        options={dropdownData.temperaments}
                        placeholder="Select temperament..."
                        editable={meta.temperaments}
                        table="Temperament"
                        label="Temperament"
                    />
                </FormField>

                <FormField label="Animal Class">
                    <FormSelect
                        value={formData.animalClass}
                        onChange={val => onChange('animalClass', val)}
                        options={dropdownData.animalClasses}
                        placeholder="Select class..."
                        editable={meta.animalClasses}
                        table="AnimalClass"
                        label="Animal Class"
                    />
                </FormField>

                <div className="form-section-title" style={{ marginTop: '20px' }}>Optional Information</div>

                <FormField label="Registration Certificate">
                    <FormSelect
                        value={formData.regCert}
                        onChange={val => onChange('regCert', val)}
                        options={dropdownData.regCerts}
                        placeholder="Select certification..."
                    />
                </FormField>

                <FormField label="Registration Number">
                    <input
                        className="form-input"
                        value={formData.regCertNumber}
                        onChange={e => onChange('regCertNumber', e.target.value)}
                        placeholder="Certificate number"
                    />
                </FormField>

                <FormField label="Birth Weight">
                    <input
                        className="form-input"
                        value={formData.birthweight}
                        onChange={e => onChange('birthweight', e.target.value)}
                        placeholder="e.g. 82"
                    />
                </FormField>

                <FormField label="Target Price">
                    <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={formData.targetPrice}
                        onChange={e => onChange('targetPrice', e.target.value)}
                        placeholder="0.00"
                    />
                </FormField>
            </div>
        </div>
    );
}

function TwinCard({ index, twin, onChange, onRemove, dropdownData, animalOptions, twinErrors, onClearTwinError }) {
    return (
        <div className="form-twin-card">
            <div className="form-twin-header">
                <span>Twin / Additional Calf {index + 1}</span>
                <button type="button" className="button button--secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }} onClick={onRemove}>
                    Remove
                </button>
            </div>
            <AnimalFieldSet
                formData={twin}
                onChange={onChange}
                errors={twinErrors || {}}
                onClearError={onClearTwinError}
                dropdownData={dropdownData}
                animalOptions={animalOptions}
            />
        </div>
    );
}

function AnimalForm({
    initialData     = null,
    initialTag      = null,
    motherTag       = null,
    fatherTag       = null,
    calvingRecordID = null,
    showTwinsOption = false,
    onClose,
    onSuccess
}) {
    const isEditing = !!initialData;

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return { ...defaultAnimalData(), ...initialData, dateOfBirth: toLocalInput(initialData.dateOfBirth) };
        }
        return defaultAnimalData({ cowTag: initialTag || '', dam: motherTag || '', sire: fatherTag || '' });
    });

    const [dropdownData,    setDropdownData]    = useState({ breeds: [], temperaments: [], statuses: [], sexes: [], regCerts: [], animalClasses: [], herds: [], _meta: { editable: {} } });
    const [animalOptions,   setAnimalOptions]   = useState([]);
    const [existingTags,    setExistingTags]    = useState([]);
    const [tagsLoaded,      setTagsLoaded]      = useState(false);
    const [invalidChars,    setInvalidChars]    = useState([]);
    const [showTagGenerator,setShowTagGenerator]= useState(false);
    const [twins,           setTwins]           = useState([]);
    const [twinErrors,      setTwinErrors]      = useState([]);

    useEffect(() => {
        fetch('/api/form-dropdown-data', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => { if (d) setDropdownData(d); }).catch(console.error);
        fetch('/api/animals', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null).then(d => {
                if (d) {
                    setExistingTags(d.cows.map(c => c.CowTag));
                    setAnimalOptions(d.cows.map(c => ({ name: c.CowTag, value: c.CowTag, status: c.Status, sex: c.Sex })));
                }
            }).catch(console.error).finally(() => setTagsLoaded(true));
        fetch('/api/cows/invalid-tag-chars')
            .then(r => r.json()).then(d => setInvalidChars(d.invalidCharacters || [])).catch(console.error);
    }, []);

    const validateTag = (tag, excludeTag = null) => {
        if (!tag.trim()) return 'Tag is required';
        if (!tagsLoaded) return 'Checking availability...';
        const lower    = tag.toLowerCase();
        const excluded = (excludeTag || '').toLowerCase();
        if (existingTags.map(t => t.toLowerCase()).includes(lower) && lower !== excluded) return 'Tag already exists.';
        if (twins.map(t => t.data.cowTag.toLowerCase()).filter(t => t === lower).length > 1) return 'Duplicate tag across twins.';
        if (invalidChars.some(c => tag.includes(c))) return `Invalid characters: ${invalidChars.join(' ')}`;
        return '';
    };

    const setField = (field, value) => setFormData(prev => ({
        ...prev, [field]: value,
        ...(field === 'sex'             && value !== 'Male' ? { castrated: null }  : {}),
        ...(field === 'calfDiedAtBirth' && value            ? { status: 'Dead' }   : {}),
    }));

    const clearError = (field) => setErrors(prev => ({ ...prev, [field]: '' }));

    const addTwin = () => {
        setTwins(prev => [...prev, { data: defaultAnimalData({ dam: formData.dam, sire: formData.sire }) }]);
        setTwinErrors(prev => [...prev, {}]);
    };
    const removeTwin   = (i) => { setTwins(p => p.filter((_, j) => j !== i)); setTwinErrors(p => p.filter((_, j) => j !== i)); };
    const setTwinField = (i, field, value) => setTwins(prev => prev.map((t, j) => j !== i ? t : {
        ...t, data: { ...t.data, [field]: value,
            ...(field === 'sex'             && value !== 'Male' ? { castrated: null } : {}),
            ...(field === 'calfDiedAtBirth' && value            ? { status: 'Dead' }  : {}),
        }
    }));
    const clearTwinError = (i, field) => setTwinErrors(prev => prev.map((e, j) => j !== i ? e : { ...e, [field]: '' }));

    const { handleSubmit, errors, setErrors, submitting, topRef } = useFormSubmit({
        validate: () => {
            const e = {};
            const tagErr = validateTag(formData.cowTag, isEditing ? initialData.cowTag : null);
            if (tagErr)          e.cowTag = tagErr;
            if (!formData.sex)   e.sex    = 'Sex is required';

            const newTwinErrors = twins.map(twin => {
                const te = {};
                const twinTagErr = validateTag(twin.data.cowTag, null);
                if (twinTagErr)       te.cowTag = twinTagErr;
                if (!twin.data.sex)   te.sex    = 'Sex is required';
                return te;
            });
            setTwinErrors(newTwinErrors);
            if (newTwinErrors.some(te => Object.keys(te).length > 0)) e._twins = 'One or more twin records have errors.';
            return e;
        },
        submit: async () => {
            if (isEditing) {
                await submitAnimalRecord(formData, { method: 'PUT', url: `/api/cows/${encodeURIComponent(initialData.cowTag)}` });
            } else {
                await submitAnimalRecord(formData, { calvingRecordID });
                for (const twin of twins) await submitAnimalRecord(twin.data, { calvingRecordID });
            }
        },
        onSuccess
    });

    return (
        <>
            <form onSubmit={handleSubmit} noValidate>
                <div ref={topRef}>
                    <AnimalFieldSet
                        formData={formData}
                        onChange={setField}
                        errors={errors}
                        onClearError={clearError}
                        dropdownData={dropdownData}
                        animalOptions={animalOptions}
                        tagLocked={!!initialTag || isEditing}
                        damLocked={!!motherTag}
                        sireLocked={!!fatherTag}
                        onGenerateTag={() => setShowTagGenerator(true)}
                    />
                    {errors._twins && (
                        <div style={{ color: '#dc3545', fontSize: '13px', padding: '0 20px 12px', textAlign: 'right' }}>
                            {errors._twins}
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                    <button type="submit" className="button" disabled={submitting}>
                        {submitting ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Animal')}
                    </button>
                </div>
            </form>

            {!isEditing && showTwinsOption && (
                <>
                    {twins.map((twin, index) => (
                        <TwinCard
                            key={index}
                            index={index}
                            twin={twin.data}
                            twinErrors={twinErrors[index] || {}}
                            onChange={(field, value) => setTwinField(index, field, value)}
                            onRemove={() => removeTwin(index)}
                            onClearTwinError={(field) => clearTwinError(index, field)}
                            dropdownData={dropdownData}
                            animalOptions={animalOptions}
                        />
                    ))}
                    <div className="form-add-twin-row">
                        <button type="button" className="button button--secondary" onClick={addTwin} disabled={submitting}>
                            + Add Twin / Additional Calf
                        </button>
                    </div>
                </>
            )}

            {showTagGenerator && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '5px', maxWidth: '500px', width: '90%' }}>
                        <TagGenerator
                            baseTag={formData.dam || ''}
                            onTagSelected={tag => { setField('cowTag', tag); setShowTagGenerator(false); }}
                            onClose={() => setShowTagGenerator(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

export default AnimalForm;