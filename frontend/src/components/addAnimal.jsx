import React, { useState, useEffect, useRef } from 'react';
import Form from './forms';
import TagGenerator from './tagGenerator';
import AnimalCombobox from './animalCombobox';

const today = new Date().toISOString().split('T')[0];

function AddAnimal({
    motherTag = null,
    fatherTag = null,
    initialTag = null,   // Pre-fills AND locks the cowTag field
    calvingRecordID = null,
    showTwinsOption = false,
    onClose,
    onSuccess
}) {
    const [formData, setFormData] = useState({
        cowTag: initialTag || '',
        dateOfBirth: today,
        description: '',
        dam: motherTag || '',
        sire: fatherTag || '',
        sex: '',
        castrated: null,
        status: 'Current',
        damDiedAtBirth: false,
        calfDiedAtBirth: false,
        currentHerd: '',
        breed: '',
        temperament: '',
        regCert: '',
        regCertNumber: '',
        birthweight: '',
        animalClass: '',
        targetPrice: ''
    });

    const [dropdownData, setDropdownData] = useState({
        breeds: [],
        temperaments: [],
        statuses: [],
        sexes: [],
        regCerts: []
    });

    const [herds, setHerds] = useState([]);
    const [existingTags, setExistingTags] = useState([]);
    const [animalOptions, setAnimalOptions] = useState([]);
    const [tagsLoaded, setTagsLoaded] = useState(false);
    const [invalidCharacters, setInvalidCharacters] = useState([]);
    const [showTagGenerator, setShowTagGenerator] = useState(false);
    const [tagValidationError, setTagValidationError] = useState('');
    const [sexValidationError, setSexValidationError] = useState('');
    const [damWarningDismissed, setDamWarningDismissed] = useState(false);
    const [sireWarningDismissed, setSireWarningDismissed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isTwins, setIsTwins] = useState(false);
    const topRef = useRef(null);
    const [twinData, setTwinData] = useState({
        cowTag: '',
        description: ''
    });

    useEffect(() => {
        fetchDropdownData();
        fetchHerds();
        fetchExistingTags();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const response = await fetch('/api/form-dropdown-data', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setDropdownData(data);
            } else {
                console.error('Failed to fetch dropdown data');
            }
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
        }
    };

    const fetchHerds = async () => {
        try {
            const response = await fetch('/api/herds', { credentials: 'include' });

            if (response.ok) {
                const herdsData = await response.json();
                setHerds((herdsData.herds || []).map(h => h.herdName));
            } else {
                console.error('Failed to fetch herds');
            }
        } catch (error) {
            console.error('Error fetching herds:', error);
        }
    };

    const fetchExistingTags = async () => {
        try {
            const response = await fetch('/api/animals', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const tags = data.cows.map(cow => cow.CowTag);
                setExistingTags(tags);
                setAnimalOptions(data.cows.map(cow => ({
                    name: cow.CowTag,
                    value: cow.CowTag,
                    status: cow.Status,
                    sex: cow.Sex
                })));
            } else {
                console.error('Failed to fetch existing tags');
            }
        } catch (error) {
            console.error('Error fetching existing tags:', error);
        } finally {
            setTagsLoaded(true);
        }
    };

    // Fetch invalid characters on component mount
    useEffect(() => {
        const fetchInvalidCharacters = async () => {
            try {
                const response = await fetch('/api/cows/invalid-tag-chars');
                const data = await response.json();
                setInvalidCharacters(data.invalidCharacters);
            } catch (error) {
                console.error('Failed to fetch invalid characters:', error);
            }
        };

        fetchInvalidCharacters();
    }, []);

    const validateTag = (tag, tags = existingTags) => {
        if (!tag.trim()) {
            return 'Tag is required';
        }
        if (!tagsLoaded) {
            return 'Checking tag availability...';
        }
        if (tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())) {
            return 'Tag already exists. Try generating a unique tag.';
        }
        const hasInvalidChar = invalidCharacters.some(char => tag.includes(char));
        if (hasInvalidChar) {
            return `Invalid tag. Must not contain: ${invalidCharacters.join(' ')}`;
        }
        return '';
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
            ...(field === 'sex' && value !== 'Male' ? { castrated: null } : {}),
            ...(field === 'calfDiedAtBirth' && value ? { status: 'Dead' } : {})
        }));

        if (field === 'cowTag') setTagValidationError(validateTag(value));
        if (field === 'sex') setSexValidationError('');
        if (field === 'dam') setDamWarningDismissed(false);
        if (field === 'sire') setSireWarningDismissed(false);
    };

    const handleTwinInputChange = (field, value) => {
        setTwinData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTagGenerate = () => {
        setShowTagGenerator(true);
    };

    const handleTagSelected = (selectedTag) => {
        handleInputChange('cowTag', selectedTag);
        setShowTagGenerator(false);
    };

    const tagExistsInOptions = (tag, options) => {
        if (!tag) return true; // empty is fine, no warning
        return options.some(o => o.value.toLowerCase() === tag.toLowerCase());
    };

    const handleSubmit = async () => {
        const tagError = validateTag(formData.cowTag);
        setTagValidationError(tagError);

        const sexError = !formData.sex ? 'Please select a sex' : '';
        setSexValidationError(sexError);

        if (tagError) {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        } else if (sexError) {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                ...formData,
                castrated: formData.sex === 'Male' ? formData.castrated : null,
                twins: false,
                calvingRecordID,
            };

            const response = await fetch('/api/cows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.warning) alert(`\n\nOperation was successful, Warning: ${result.warning}`);
                if (onSuccess) onSuccess();
            } else {
                const error = await response.json();
                alert(`Failed to add animal: ${error.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error adding animal');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (onClose) onClose();
    };

    const inputStyle = {
        width: '100%',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '3px'
    };

    const requiredError = (message) => (
        <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
            {message}
        </div>
    );

    const unknownTagHint = (tag, onDismiss) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            color: '#7d4e00',
            backgroundColor: '#fff8e1',
            border: '1px solid #ffc107',
            borderRadius: '3px',
            fontSize: '12px',
            marginTop: '5px',
            padding: '5px 8px',
            gap: '8px'
        }}>
            <span>The animal <strong>{tag}</strong> does not exist in the database. If this is intentional, you may dismiss this message.</span>
            <button
                type="button"
                onClick={onDismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#7d4e00',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    lineHeight: 1,
                    padding: '0 2px',
                    flexShrink: 0
                }}
                aria-label="Dismiss"
            >
                ×
            </button>
        </div>
    );

    const errorStyle = (hasError) => ({
        border: `1px solid ${hasError ? '#dc3545' : '#ccc'}`,
        backgroundColor: hasError ? '#fff5f5' : 'white',
    });

    const damNotFound = !!formData.dam && !tagExistsInOptions(formData.dam, animalOptions.filter(o => o.sex === 'Female'));
    const sireNotFound = !!formData.sire && !tagExistsInOptions(formData.sire, animalOptions.filter(o => o.sex === 'Male'));

    const bodyContent = (
        <div ref={topRef} className="bubble-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                padding: '20px'
            }}>
                {/* Basic Information */}
                <div>
                    <h4 style={{ marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                        Basic Information
                    </h4>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Cow Tag *
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={formData.cowTag}
                                onChange={(e) => handleInputChange('cowTag', e.target.value)}
                                disabled={!!initialTag}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    border: `1px solid ${tagValidationError ? '#dc3545' : '#ccc'}`,
                                    borderRadius: '3px',
                                    backgroundColor: initialTag ? '#f5f5f5' : tagValidationError ? '#fff5f5' : 'white',
                                    cursor: initialTag ? 'not-allowed' : 'text'
                                }}
                                placeholder="Enter unique tag"
                            />
                            <button
                                type="button"
                                onClick={handleTagGenerate}
                                className="button"
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    fontSize: '14px'
                                }}
                            >
                                Generate
                            </button>
                        </div>
                        {tagValidationError && requiredError(tagValidationError)}
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Date of Birth
                        </label>
                        <input
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Description
                        </label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            style={inputStyle}
                            placeholder="Optional description"
                        />
                    </div>
                </div>

                {/* Parentage & Classification */}
                <div>
                    <h4 style={{ marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                        Parentage & Classification
                    </h4>

                    {/* Dam */}
                    <div style={{ marginBottom: '5px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Dam
                        </label>
                        <AnimalCombobox
                            options={animalOptions.filter(o => o.sex === 'Female')}
                            value={formData.dam}
                            onChange={(val) => handleInputChange('dam', val)}
                            onSelect={(val) => handleInputChange('dam', val)}
                            placeholder="Mother's tag"
                            allowCustomValue
                            clearOnOpen={false}
                            disabled={!!motherTag}
                            style={{
                                ...inputStyle,
                                ...(damNotFound && !damWarningDismissed
                                    ? { backgroundColor: '#fff8e1', border: '1px solid #ffc107' }
                                    : {})
                            }}
                        />
                        {damNotFound && !damWarningDismissed && unknownTagHint(formData.dam, () => setDamWarningDismissed(true))}
                    </div>

                    {/* Dam died */}
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            id="damDiedAtBirth"
                            checked={formData.damDiedAtBirth}
                            onChange={(e) => handleInputChange('damDiedAtBirth', e.target.checked)}
                        />
                        <label htmlFor="damDiedAtBirth" style={{ fontSize: '13px', color: '#555' }}>
                            Mother died during childbirth?
                        </label>
                    </div>

                    {/* Sire */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Sire
                        </label>
                        <AnimalCombobox
                            options={animalOptions.filter(o => o.sex === 'Male')}
                            value={formData.sire}
                            onChange={(val) => handleInputChange('sire', val)}
                            onSelect={(val) => handleInputChange('sire', val)}
                            placeholder="Father's tag"
                            allowCustomValue
                            clearOnOpen={false}
                            disabled={!!fatherTag}
                            style={{
                                ...inputStyle,
                                ...(sireNotFound && !sireWarningDismissed
                                    ? { backgroundColor: '#fff8e1', border: '1px solid #ffc107' }
                                    : {})
                            }}
                        />
                        {sireNotFound && !sireWarningDismissed && unknownTagHint(formData.sire, () => setSireWarningDismissed(true))}
                    </div>

                    {/* Sex */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Sex <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <select
                            value={formData.sex}
                            onChange={(e) => handleInputChange('sex', e.target.value)}
                            style={{ ...inputStyle, ...errorStyle(!formData.sex) }}
                        >
                            <option value="">Select sex...</option>
                            {dropdownData.sexes.map((sex, index) => (
                                <option key={index} value={sex}>{sex}</option>
                            ))}
                        </select>
                        {!formData.sex && requiredError('Sex is required')}
                    </div>

                    {/* Castrated — only shown when Male is selected */}
                    {formData.sex === 'Male' && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Castrated
                            </label>
                            <select
                                value={formData.castrated === null ? '' : formData.castrated ? 'yes' : 'no'}
                                onChange={(e) => handleInputChange(
                                    'castrated',
                                    e.target.value === '' ? null : e.target.value === 'yes'
                                )}
                                style={inputStyle}
                            >
                                <option value="">Select...</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    )}

                    {/* Status */}
                    <div style={{ marginBottom: '5px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Status
                        </label>
                        <select
                            value={formData.calfDiedAtBirth ? 'Dead' : formData.status}
                            onChange={(e) => handleInputChange('status', e.target.value)}
                            disabled={formData.calfDiedAtBirth}
                            style={{
                                ...inputStyle,
                                ...(formData.calfDiedAtBirth ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {})
                            }}
                        >
                            {dropdownData.statuses.map((status, index) => (
                                <option key={index} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    {/* Calf died */}
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            id="calfDiedAtBirth"
                            checked={formData.calfDiedAtBirth}
                            onChange={(e) => handleInputChange('calfDiedAtBirth', e.target.checked)}
                        />
                        <label htmlFor="calfDiedAtBirth" style={{ fontSize: '13px', color: '#555' }}>
                            Animal died during childbirth?
                        </label>
                    </div>
                </div>

                {/* Management & Additional Info */}
                <div>
                    <h4 style={{ marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                        Management Info
                    </h4>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Current Herd
                        </label>
                        <select
                            value={formData.currentHerd}
                            onChange={(e) => handleInputChange('currentHerd', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">Select herd...</option>
                            {herds.map((herd, index) => (
                                <option key={index} value={herd}>{herd}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Breed
                        </label>
                        <select
                            value={formData.breed}
                            onChange={(e) => handleInputChange('breed', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">Select breed...</option>
                            {dropdownData.breeds.map((breed, index) => (
                                <option key={index} value={breed}>{breed}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Temperament
                        </label>
                        <select
                            value={formData.temperament}
                            onChange={(e) => handleInputChange('temperament', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">Select temperament...</option>
                            {dropdownData.temperaments.map((temperament, index) => (
                                <option key={index} value={temperament}>{temperament}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Optional Fields */}
                <div>
                    <h4 style={{ marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                        Optional Information
                    </h4>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Registration Certificate
                        </label>
                        <select
                            value={formData.regCert}
                            onChange={(e) => handleInputChange('regCert', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">Select certification...</option>
                            {dropdownData.regCerts.map((cert, index) => (
                                <option key={index} value={cert}>{cert}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Registration Number
                        </label>
                        <input
                            type="text"
                            value={formData.regCertNumber}
                            onChange={(e) => handleInputChange('regCertNumber', e.target.value)}
                            style={inputStyle}
                            placeholder="Certificate number"
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Birth Weight
                        </label>
                        <input
                            type="text"
                            value={formData.birthweight}
                            onChange={(e) => handleInputChange('birthweight', e.target.value)}
                            style={inputStyle}
                            placeholder="Birth weight"
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Target Price
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.targetPrice}
                            onChange={(e) => handleInputChange('targetPrice', e.target.value)}
                            style={inputStyle}
                            placeholder="Target sale price"
                        />
                    </div>
                </div>
            </div>

            {/* Twins Section */}
            {showTwinsOption && (
                <div style={{
                    margin: '20px',
                    padding: '20px',
                    border: '2px dashed #ffc107',
                    borderRadius: '5px',
                    backgroundColor: '#fff8e1'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <input
                            type="checkbox"
                            checked={isTwins}
                            onChange={(e) => setIsTwins(e.target.checked)}
                            style={{ transform: 'scale(1.3)' }}
                        />
                        <label style={{ fontWeight: 'bold', color: '#856404' }}>
                            Twins? (Create second calf record)
                        </label>
                    </div>

                    {isTwins && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Twin Tag
                                </label>
                                <input
                                    type="text"
                                    value={twinData.cowTag}
                                    onChange={(e) => handleTwinInputChange('cowTag', e.target.value)}
                                    style={inputStyle}
                                    placeholder="Tag for twin"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Twin Description
                                </label>
                                <input
                                    type="text"
                                    value={twinData.description}
                                    onChange={(e) => handleTwinInputChange('description', e.target.value)}
                                    style={inputStyle}
                                    placeholder="Optional description for twin"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '15px',
                justifyContent: 'center',
                margin: '30px 20px 20px 20px',
                paddingTop: '20px',
                borderTop: '1px solid #ddd'
            }}>
                <button
                    onClick={handleCancel}
                    disabled={submitting}
                    className="button"
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        fontSize: '16px',
                        opacity: submitting ? 0.6 : 1,
                        cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                >
                    Cancel
                </button>

                <button
                    onClick={handleSubmit}
                    className="button"
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        opacity: submitting ? 0.6 : 1,
                        cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {submitting ? 'Adding...' : 'Add Animal'}
                </button>
            </div>

            {/* Tag Generator Modal */}
            {showTagGenerator && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '5px',
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <TagGenerator
                            baseTag={formData.dam || ''}
                            onTagSelected={handleTagSelected}
                            onClose={() => setShowTagGenerator(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    return bodyContent;
}

export default AddAnimal;