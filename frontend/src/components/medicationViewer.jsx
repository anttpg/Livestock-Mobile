import React, { useState, useEffect } from 'react';
import ColorTable from './colorTable';
import PopupConfirm from './popupConfirm';

function MedicationViewer({ medicines, onClose, onAddMedicine, onUpdateMedicine, medicinesLoading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [formData, setFormData] = useState({
    medicineID: '',
    medicineClass: '',
    dewormerClass: '',
    shorthand: '',
    genericName: '',
    brandName: '',
    manufacturer: '',
    applicationMethod: '',
    mixRecipe: ''
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState({
    shorthand: '',
    genericName: ''
  });

  // Dropdown data from API
  const [dropdownData, setDropdownData] = useState({
    medicineClasses: [],
    dewormerClasses: [],
    MedicineApplicationMethods: []
  });
  const [dropdownLoading, setDropdownLoading] = useState(true);

  // State for adding new dropdown options
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [newDropdownValue, setNewDropdownValue] = useState('');
  const [pendingDropdownAdd, setPendingDropdownAdd] = useState(null);

  // Load dropdown data on mount
  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    setDropdownLoading(true);
    try {
      const response = await fetch('/api/form-dropdown-data', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDropdownData({
          medicineClasses: data.medicineClasses || [],
          dewormerClasses: data.dewormerClasses || [],
          MedicineApplicationMethods: data.MedicineApplicationMethods || []
        });
      } else {
        console.error('Failed to load dropdown data:', response.status);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    } finally {
      setDropdownLoading(false);
    }
  };

  const handleAddNewDropdownOption = (field, table, column) => {
    const value = prompt(`Enter new ${field}:`);
    if (!value || value.trim() === '') return;

    setPendingDropdownAdd({ table, column, value: value.trim(), field });
    setNewDropdownValue(value.trim());
    setShowConfirmPopup(true);
  };

  const confirmAddDropdownOption = async () => {
    console.log('Sending to API:', {
        table: pendingDropdownAdd.table,
        column: pendingDropdownAdd.column,
        value: pendingDropdownAdd.value
    });

    if (!pendingDropdownAdd) return;

    try {
      const response = await fetch('/api/form-dropdown-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: pendingDropdownAdd.table,
          column: pendingDropdownAdd.column,
          value: pendingDropdownAdd.value
        })
      });

      if (response.ok) {
        // Reload dropdown data
        await loadDropdownData();
        
        // Set the newly added value in the form
        handleInputChange(pendingDropdownAdd.field, pendingDropdownAdd.value);
        
        alert(`Successfully added "${pendingDropdownAdd.value}"`);
      } else {
        const error = await response.json();
        alert(`Failed to add option: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding dropdown option:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setShowConfirmPopup(false);
      setPendingDropdownAdd(null);
      setNewDropdownValue('');
    }
  };

  const cancelAddDropdownOption = () => {
    setShowConfirmPopup(false);
    setPendingDropdownAdd(null);
    setNewDropdownValue('');
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'shorthand':
        return !value.trim() ? 'Shorthand is required' : '';
      case 'genericName':
        return !value.trim() ? 'Generic name is required' : '';
      default:
        return '';
    }
  };

  const handleEdit = (medicine) => {
    setSelectedMedicine(medicine);
    setFormData({
      medicineID: medicine.ID || '',
      medicineClass: medicine.MedicineClass || '',
      dewormerClass: medicine.DewormerClass || '',
      shorthand: medicine.Shorthand || '',
      genericName: medicine.GenericName || '',
      brandName: medicine.BrandName || '',
      manufacturer: medicine.Manufacturer || '',
      applicationMethod: medicine.ApplicationMethod || '',
      mixRecipe: medicine.MixRecipe || ''
    });
    setValidationErrors({
      shorthand: '',
      genericName: ''
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedMedicine(null);
    setFormData({
      medicineID: '',
      medicineClass: '',
      dewormerClass: '',
      shorthand: '',
      genericName: '',
      brandName: '',
      manufacturer: '',
      applicationMethod: '',
      mixRecipe: ''
    });
    setValidationErrors({
      shorthand: '',
      genericName: ''
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedMedicine(null);
    setValidationErrors({
      shorthand: '',
      genericName: ''
    });
  };

  const handleSave = async () => {
    // Validate required fields
    const errors = {
      shorthand: validateField('shorthand', formData.shorthand),
      genericName: validateField('genericName', formData.genericName)
    };

    setValidationErrors(errors);

    // Check if there are any errors
    if (Object.values(errors).some(error => error !== '')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      if (isCreating) {
        await onAddMedicine(formData);
      } else if (isEditing) {
        await onUpdateMedicine(selectedMedicine.ID, formData);
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving medicine:', error);
      alert('Failed to save medicine: ' + error.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate in real-time for required fields
    if (field === 'shorthand' || field === 'genericName') {
      const error = validateField(field, value);
      setValidationErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  };

  const columns = [
    {
      key: 'Shorthand',
      header: 'Short',
      width: '80px'
    },
    {
      key: 'GenericName',
      header: 'Generic Name',
      autoWidth: true
    },
    {
      key: 'BrandName',
      header: 'Brand Name',
      autoWidth: true
    },
    {
      key: 'MedicineClass',
      header: 'Class',
      width: '150px'
    },
    {
      key: 'ApplicationMethod',
      header: 'Method',
      width: '120px'
    }
  ];

  if (medicinesLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Loading medicines...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {!isEditing && !isCreating ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Medicine Database</h2>
            <div>
              <button
                onClick={handleCreate}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px',
                  fontSize: '14px'
                }}
              >
                + Add New Medicine
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>
          </div>

          <ColorTable
            data={medicines}
            columns={columns}
            showActionColumn={true}
            actionButtonText="Edit"
            actionButtonColor="#007bff"
            onActionClick={handleEdit}
            alternatingRows={true}
            evenRowColor="#fff"
            oddRowColor="#f4f4f4"
            emptyMessage="No medicines in database"
            headerColors={{
              'Shorthand': '#d0e7ff',
              'GenericName': '#d0e7ff',
              'BrandName': '#d0e7ff',
              'MedicineClass': '#d0e7ff',
              'ApplicationMethod': '#d0e7ff'
            }}
          />
        </>
      ) : (
        <div>
          <h2>{isCreating ? 'Add New Medicine' : 'Edit Medicine'}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Medicine ID
              </label>
              <input
                type="text"
                value={formData.medicineID}
                onChange={(e) => handleInputChange('medicineID', e.target.value)}
                disabled={true}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#f0f0f0'
                }}
                placeholder="Auto-generated"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Shorthand <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.shorthand}
                onChange={(e) => handleInputChange('shorthand', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.shorthand ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: validationErrors.shorthand ? '#fff5f5' : 'white'
                }}
                placeholder="e.g., IV, V8"
              />
              {validationErrors.shorthand && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.shorthand}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Medicine Class
              </label>
              <select
                value={formData.medicineClass}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    handleAddNewDropdownOption('medicineClass', 'MedicineClass', 'MedicineClass');
                  } else {
                    handleInputChange('medicineClass', e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                disabled={dropdownLoading}
              >
                <option value="">Select class...</option>
                {dropdownData.medicineClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
                <option value="ADD_NEW" style={{ 
                  backgroundColor: '#e7f3ff', 
                  fontWeight: 'bold',
                  borderTop: '2px solid #007bff'
                }}>
                  + Add New Medicine Class...
                </option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Dewormer Class
              </label>
              <select
                value={formData.dewormerClass}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    handleAddNewDropdownOption('dewormerClass', 'DewormerClass', 'DewormerClass');
                  } else {
                    handleInputChange('dewormerClass', e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                disabled={dropdownLoading}
              >
                <option value="">Select dewormer class...</option>
                {dropdownData.dewormerClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
                <option value="ADD_NEW" style={{ 
                  backgroundColor: '#e7f3ff', 
                  fontWeight: 'bold',
                  borderTop: '2px solid #007bff'
                }}>
                  + Add New Dewormer Class...
                </option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Generic Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.genericName}
                onChange={(e) => handleInputChange('genericName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.genericName ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: validationErrors.genericName ? '#fff5f5' : 'white'
                }}
                placeholder="e.g., Ivermectin"
              />
              {validationErrors.genericName && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.genericName}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Brand Name
              </label>
              <input
                type="text"
                value={formData.brandName}
                onChange={(e) => handleInputChange('brandName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="e.g., Ivomec"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Manufacturer
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="e.g., Boehringer Ingelheim"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Application Method
              </label>
              <select
                value={formData.applicationMethod}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    handleAddNewDropdownOption('applicationMethod', 'MedicineApplicationMethods', 'MedicineApplicationMethod');
                  } else {
                    handleInputChange('applicationMethod', e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                disabled={dropdownLoading}
              >
                <option value="">Select method...</option>
                {dropdownData.MedicineApplicationMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
                <option value="ADD_NEW" style={{ 
                  backgroundColor: '#e7f3ff', 
                  fontWeight: 'bold',
                  borderTop: '2px solid #007bff'
                }}>
                  + Add New Application Method...
                </option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Mix Recipe / Notes
            </label>
            <textarea
              value={formData.mixRecipe}
              onChange={(e) => handleInputChange('mixRecipe', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="Enter mixing instructions or additional notes..."
            />
          </div>

          <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 30px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isCreating ? 'Create Medicine' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 30px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Popup for Adding New Dropdown Options */}
      <PopupConfirm
        isOpen={showConfirmPopup}
        onClose={cancelAddDropdownOption}
        onConfirm={confirmAddDropdownOption}
        title="Add New Option"
        message={`Add "${newDropdownValue}" to the database?`}
        confirmText="Add"
        cancelText="Cancel"
        requireDelay={false}
      />
    </div>
  );
}

export default MedicationViewer;