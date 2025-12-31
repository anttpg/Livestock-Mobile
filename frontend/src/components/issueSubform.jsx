import React, { useState, useEffect } from 'react';
import PhotoViewer from './photoViewer';

function IssueSubform({ 
  issue, 
  cowTag, 
  currentUser, 
  isCreatingNew, 
  onClose, 
  onSave, 
  onUpdate, 
  onResolve,
  medicines = [],
  medicinesLoading = false,
  onAddMedicine,
  onOpenMedicationViewer
}) {
  const [formData, setFormData] = useState({
    // Issue Information
    IssueDescription: '',
    IssueObservationDate: new Date().toISOString().split('T')[0],
    IssueObservedBy: currentUser?.username || '',
    
    // Treatment Information
    TreatmentMedicineID: '',  // Changed to ID
    TreatmentDate: new Date().toISOString().split('T')[0],
    TreatmentMethod: '',
    TreatmentResponse: '',
    TreatmentIsActive: false,
    
    // Veterinarian Information
    VetName: '',
    VetComments: '',
    
    // Issue-specific fields
    IssueSerious: false,
    IssueResolved: false,
    IssueResolutionNote: '',
    IssueResolutionDate: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Common input style with proper box-sizing
  const inputStyle = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  const textareaStyle = {
    ...inputStyle,
    resize: 'vertical'
  };

  const selectStyle = {
    ...inputStyle,
    backgroundColor: 'white'
  };

  // Handle screen resize
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Populate form when editing existing issue
  useEffect(() => {
    if (issue && !isCreatingNew) {
      setFormData({
        IssueDescription: issue.IssueDescription || issue.Description || '',
        IssueObservationDate: issue.IssueObservationDate ? 
          new Date(issue.IssueObservationDate).toISOString().split('T')[0] : 
          (issue.DateObserved ? new Date(issue.DateObserved).toISOString().split('T')[0] : ''),
        IssueObservedBy: issue.IssueObservedBy || issue.User || '',
        
        // Treatment fields - TreatmentMedicine from backend is now the ID
        TreatmentMedicineID: issue.TreatmentMedicine || '',
        TreatmentDate: issue.TreatmentDate ? 
          new Date(issue.TreatmentDate).toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
        TreatmentMethod: issue.TreatmentMethod || '',
        TreatmentResponse: issue.TreatmentResponse || '',
        TreatmentIsActive: issue.TreatmentIsActive || false,
        
        // Vet fields
        VetName: issue.VetName || '',
        VetComments: issue.VetComments || '',
        
        // Issue-specific
        IssueSerious: issue.IssueSerious || issue.IsSerious || false,
        IssueResolved: issue.IssueResolved || issue.IsResolved || false,
        IssueResolutionNote: issue.IssueResolutionNote || '',
        IssueResolutionDate: issue.IssueResolutionDate || ''
      });
    }
  }, [issue, isCreatingNew]);

  // Separate useEffect for medicine matching
  useEffect(() => {
    if (issue && !isCreatingNew && medicines.length > 0 && issue.TreatmentMedicine) {
      const medicineMatch = medicines.find(m => m.ID === issue.TreatmentMedicine);
      setSelectedMedicine(medicineMatch || null);
    }
  }, [issue?.TreatmentMedicine, medicines.length, isCreatingNew]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveError(null);
  };

  const handleMedicineChange = (medicineID) => {
    if (medicineID === 'OPEN_VIEWER') {
      // Open medication viewer
      if (onOpenMedicationViewer) {
        onOpenMedicationViewer();
      }
      return;
    } else if (medicineID === '') {
      setSelectedMedicine(null);
      handleInputChange('TreatmentMedicineID', '');
      handleInputChange('TreatmentMethod', '');
    } else {
      const medicine = medicines.find(m => m.ID === medicineID);
      setSelectedMedicine(medicine);
      handleInputChange('TreatmentMedicineID', medicine.ID);
      handleInputChange('TreatmentMethod', medicine.ApplicationMethod || '');
    }
  };

  const validateForm = () => {
    const errors = [];
    
    if (!formData.IssueDescription.trim()) {
      errors.push('Issue description is required');
    }
    
    if (!formData.IssueObservationDate) {
      errors.push('Observation date is required');
    }
    
    if (!formData.IssueObservedBy.trim()) {
      errors.push('Observer name is required');
    }
    
    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setSaveError(validationErrors.join(', '));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (isCreatingNew) {
        const recordData = {
          recordType: 'issue',
          // Issue fields
          issueDescription: formData.IssueDescription,
          issueObservationDate: formData.IssueObservationDate,
          issueObservedBy: formData.IssueObservedBy,
          issueSerious: formData.IssueSerious,
          // Treatment fields
          treatmentMedicineID: formData.TreatmentMedicineID?.trim() || null,
          treatmentDate: formData.TreatmentDate || null,
          treatmentResponse: formData.TreatmentResponse?.trim() || null,
          treatmentIsActive: formData.TreatmentIsActive,
          // Vet fields
          vetName: formData.VetName?.trim() || null,
          vetComments: formData.VetComments?.trim() || null,
          // General note
          note: `Issue reported by ${formData.IssueObservedBy} on ${formData.IssueObservationDate}`
        };
        
        await onSave(recordData);
        onClose();
      } else {
        const updateData = {
          IssueDescription: formData.IssueDescription,
          IssueObservationDate: formData.IssueObservationDate,
          IssueObservedBy: formData.IssueObservedBy,
          IssueSerious: formData.IssueSerious,
          TreatmentMedicineID: formData.TreatmentMedicineID || null,
          TreatmentDate: formData.TreatmentDate || null,
          TreatmentResponse: formData.TreatmentResponse || null,
          TreatmentIsActive: formData.TreatmentIsActive,
          VetName: formData.VetName || null,
          VetComments: formData.VetComments || null
        };
        
        await onUpdate(issue.ID || issue.RecordID, updateData);
        onClose();
      }
    } catch (error) {
      console.error('Error saving issue:', error);
      setSaveError(error.message || 'Failed to save issue');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsSerious = async () => {
    if (formData.IssueSerious) return;
    
    handleInputChange('IssueSerious', true);
    
    if (!isCreatingNew) {
      try {
        await onUpdate(issue.ID || issue.RecordID, { IssueSerious: true });
      } catch (error) {
        console.error('Error marking as serious:', error);
        setSaveError('Failed to mark as serious');
        handleInputChange('IssueSerious', false);
      }
    }
  };

  const handleResolveIssue = async () => {
    if (!formData.IssueResolutionNote.trim()) {
      setSaveError('Please enter resolution notes before marking as resolved');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onResolve(issue.ID || issue.RecordID, formData.IssueResolutionNote);
      onClose();
    } catch (error) {
      console.error('Error resolving issue:', error);
      setSaveError(error.message || 'Failed to resolve issue');
    } finally {
      setIsSaving(false);
    }
  };

  const isMobile = screenWidth < 900;

  // Get display name for a medicine
  const getMedicineDisplayName = (med) => {
    if (!med) return '';
    return med.BrandName || med.GenericName || med.Shorthand || med.ID;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Error Display */}
      {saveError && (
        <div style={{
          padding: '15px',
          margin: '10px 20px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '5px',
          color: '#721c24',
          fontSize: '14px'
        }}>
          <strong>Error:</strong> {saveError}
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '15px',
        padding: '20px',
        flex: 1,
        overflowY: 'auto'
      }}>
        {/* Column 1: Issue Information */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ 
              margin: '0', 
              padding: '10px 15px',
              backgroundColor: '#bbc1cd',
              borderRadius: '5px',
              flex: 1,
              textAlign: 'center',
              marginRight: '10px'
            }}>
              Issue
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Issue Description: <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                value={formData.IssueDescription}
                onChange={(e) => handleInputChange('IssueDescription', e.target.value)}
                placeholder="Describe the issue or injury observed"
                rows={6}
                style={textareaStyle}
                disabled={formData.IssueResolved}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Date Observed: <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="date"
                value={formData.IssueObservationDate}
                onChange={(e) => handleInputChange('IssueObservationDate', e.target.value)}
                style={inputStyle}
                disabled={formData.IssueResolved}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Observed By: <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.IssueObservedBy}
                onChange={(e) => handleInputChange('IssueObservedBy', e.target.value)}
                placeholder="Enter your name"
                style={inputStyle}
                disabled={formData.IssueResolved}
              />
            </div>

            {!isCreatingNew && (
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  Resolution Notes:
                </label>
                <textarea
                  value={formData.IssueResolutionNote}
                  onChange={(e) => handleInputChange('IssueResolutionNote', e.target.value)}
                  placeholder={formData.IssueResolved ? "Issue has been resolved" : "Enter resolution notes to mark as resolved"}
                  rows={4}
                  style={textareaStyle}
                  disabled={formData.IssueResolved}
                />
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Treatment Information */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ 
              margin: '0', 
              padding: '10px 15px',
              backgroundColor: '#f8cbad',
              borderRadius: '5px',
              flex: 1,
              textAlign: 'center',
              marginRight: '10px'
            }}>
              Treatment
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Medicine Applied:
              </label>
              <select
                value={formData.TreatmentMedicineID}
                onChange={(e) => handleMedicineChange(e.target.value)}
                style={selectStyle}
                disabled={medicinesLoading}
              >
                <option value="">Select a medicine...</option>
                {medicines.map(med => (
                  <option key={med.ID} value={med.ID}>
                    {getMedicineDisplayName(med)} ({med.Shorthand || med.ID})
                  </option>
                ))}
                <option value="OPEN_VIEWER" style={{ 
                  backgroundColor: '#e7f3ff', 
                  fontWeight: 'bold',
                  borderTop: '2px solid #007bff'
                }}>
                  📋 View/Manage All Medicines...
                </option>
              </select>
              {medicinesLoading && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Loading medicines...
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Application Date:
              </label>
              <input
                type="date"
                value={formData.TreatmentDate}
                onChange={(e) => handleInputChange('TreatmentDate', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Delivery Method:
              </label>
              <input
                type="text"
                value={formData.TreatmentMethod}
                onChange={(e) => handleInputChange('TreatmentMethod', e.target.value)}
                placeholder="e.g., Intramuscular injection"
                disabled={selectedMedicine}
                style={{
                  ...inputStyle,
                  backgroundColor: selectedMedicine ? '#f5f5f5' : 'white',
                  color: selectedMedicine ? '#666' : 'black'
                }}
              />
              {selectedMedicine && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Method auto-filled from medicine database
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Response Notes:
              </label>
              <textarea
                value={formData.TreatmentResponse}
                onChange={(e) => handleInputChange('TreatmentResponse', e.target.value)}
                placeholder="Describe the cow's response to treatment"
                rows={4}
                style={textareaStyle}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.TreatmentIsActive}
                  onChange={(e) => handleInputChange('TreatmentIsActive', e.target.checked)}
                />
                <span style={{ fontSize: '14px' }}>Is the cow currently on this medicine?</span>
              </label>
            </div>
          </div>
        </div>

        {/* Column 3: Veterinarian Information */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ 
              margin: '0', 
              padding: '10px 15px',
              backgroundColor: '#e8e9ea',
              borderRadius: '5px',
              flex: 1,
              textAlign: 'center',
              marginRight: '10px'
            }}>
              Vet
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Vet Name:
              </label>
              <input
                type="text"
                value={formData.VetName}
                onChange={(e) => handleInputChange('VetName', e.target.value)}
                placeholder="Enter veterinarian name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Vet Comments:
              </label>
              <textarea
                value={formData.VetComments}
                onChange={(e) => handleInputChange('VetComments', e.target.value)}
                placeholder="Enter veterinarian's notes and recommendations"
                rows={8}
                style={textareaStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderTop: '1px solid #ddd',
        backgroundColor: 'white',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: isMobile ? '10px' : '0'
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!isCreatingNew && !formData.IssueResolved && (
            <>
              <button
                onClick={handleMarkAsSerious}
                disabled={isSaving || formData.IssueSerious}
                style={{
                  padding: '12px 24px',
                  backgroundColor: formData.IssueSerious ? '#6c757d' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: formData.IssueSerious ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {formData.IssueSerious ? 'Marked as Serious' : 'Mark as Serious Issue'}
              </button>
              
              <button
                onClick={handleResolveIssue}
                disabled={isSaving || !formData.IssueResolutionNote.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: formData.IssueResolutionNote.trim() ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: formData.IssueResolutionNote.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {isSaving ? 'Resolving...' : 'Mark Issue as Resolved'}
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '12px 24px',
              backgroundColor: isSaving ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {isSaving ? 'Saving...' : (isCreatingNew ? 'Create Issue' : 'Update Issue')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IssueSubform;