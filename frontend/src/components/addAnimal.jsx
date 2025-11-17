import React, { useState, useEffect } from 'react';
import Form from './forms';
import TagGenerator from './tagGenerator';
import '../cow-data.css';

const today = new Date().toISOString().split('T')[0];

function AddAnimal({ 
  motherTag = null, 
  fatherTag = null, 
  showTwinsOption = false,
  createCalvingRecord = false,
  breedingYear = null,
  onClose,
  onSuccess 
}) {
  const [formData, setFormData] = useState({
    cowTag: '',
    dateOfBirth: today,
    description: '',
    dam: motherTag || '',
    sire: fatherTag || '',
    sex: '',
    status: 'Current',
    currentHerd: '',
    breed: '',
    temperament: '',
    regCert: '',
    regCertNumber: '',
    birthweight: '',
    birthweightClass: '',
    targetPrice: '',
    origin: ''
  });

  const [dropdownData, setDropdownData] = useState({
    genotypes: [],
    temperaments: [],
    statuses: [],
    sexes: [],
    regCerts: []
  });

  const [herds, setHerds] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [showTagGenerator, setShowTagGenerator] = useState(false);
  const [tagValidationError, setTagValidationError] = useState('');
  const [sexValidationError, setSexValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isTwins, setIsTwins] = useState(false);
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
      const response = await fetch('/api/herds/list', {
        credentials: 'include'
      });

      if (response.ok) {
        const herdsData = await response.json();
        const herdsList = Array.isArray(herdsData) ? herdsData : (herdsData.herds || []);
        setHerds(herdsList);
      } else {
        console.error('Failed to fetch herds');
      }
    } catch (error) {
      console.error('Error fetching herds:', error);
    }
  };

  const fetchExistingTags = async () => {
    try {
      const response = await fetch('/api/cows', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const tags = data.cows ? data.cows.map(cow => cow.CowTag) : [];
        setExistingTags(tags);
      } else {
        console.error('Failed to fetch existing tags');
      }
    } catch (error) {
      console.error('Error fetching existing tags:', error);
    }
  };

  const validateTag = (tag) => {
    if (!tag.trim()) {
      return 'Tag is required';
    }
    if (existingTags.includes(tag)) {
      return 'Tag already exists, try generating a unique tag?';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate tag in real-time
    if (field === 'cowTag') {
      const error = validateTag(value);
      setTagValidationError(error);
    }
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

  const handleSubmit = async () => {
    // Validate cow tag
    const tagError = validateTag(formData.cowTag);
    setTagValidationError(tagError);

    // Validate sex
    const sexError = !formData.sex ? 'Please select a sex for the cow' : '';
    setSexValidationError(sexError);

    // If there are errors, scroll to top and stop submission
    if (tagError || sexError) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        createCalvingRecord,
        breedingYear,
        calvingNotes: null,
        twins: false
      };

      const response = await fetch('/api/add-cow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        let successMessage = `Successfully added ${formData.cowTag}`;
        if (result.calvingRecordCreated) successMessage += ' with calving record';
        else if (result.warning) successMessage += `\n\nNote: ${result.warning}`;
        alert(successMessage);
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

  const bodyContent = (
    <div className="bubble-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
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
                style={{
                  flex: 1,
                  padding: '8px',
                  border: `1px solid ${tagValidationError ? '#dc3545' : '#ccc'}`,
                  borderRadius: '3px',
                  backgroundColor: tagValidationError ? '#fff5f5' : 'white'
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
            {tagValidationError && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                {tagValidationError}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
              placeholder="Optional description"
            />
          </div>
        </div>

        {/* Parentage & Classification */}
        <div>
          <h4 style={{ marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
            Parentage & Classification
          </h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Dam (Mother)
            </label>
            <input
              type="text"
              value={formData.dam}
              onChange={(e) => handleInputChange('dam', e.target.value)}
              disabled={!!motherTag}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: motherTag ? '#f5f5f5' : 'white'
              }}
              placeholder="Mother's tag"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Sire (Father)
            </label>
            <input
              type="text"
              value={formData.sire}
              onChange={(e) => handleInputChange('sire', e.target.value)}
              disabled={!!fatherTag}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: fatherTag ? '#f5f5f5' : 'white'
              }}
              placeholder="Father's tag"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Sex
            </label>
            <select
              value={formData.sex}
              onChange={(e) => handleInputChange('sex', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${tagValidationError ? '#dc3545' : '#ccc'}`,
                backgroundColor: tagValidationError ? '#fff5f5' : 'white',
                borderRadius: '3px'
              }}
            >
              <option value="">Select sex...</option>
                {dropdownData.sexes.map((sex, index) => (
              <option key={index} value={sex}>{sex}</option>
              ))}
            </select>
            {sexValidationError && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                {sexValidationError}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              {dropdownData.statuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              <option value="">Select herd...</option>
              {herds.map((herd, index) => (
                <option key={index} value={herd}>{herd}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Genotype
            </label>
            <select
              value={formData.genotype}
              onChange={(e) => handleInputChange('genotype', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              <option value="">Select genotype...</option>
              {dropdownData.genotypes.map((genotype, index) => (
                <option key={index} value={genotype}>{genotype}</option>
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
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
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '3px'
                  }}
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
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '3px'
                  }}
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

  return (
    bodyContent
  );
}

export default AddAnimal;