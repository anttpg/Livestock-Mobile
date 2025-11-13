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
  onAddMedicine
}) {
  const [formData, setFormData] = useState({
    // Issue Information
    IssueDescription: '',
    IssueObservationDate: new Date().toISOString().split('T')[0],
    IssueObservedBy: currentUser?.username || '',
    
    // Treatment Information
    TreatmentMedicine: '',
    TreatmentDate: new Date().toISOString().split('T')[0],
    TreatmentMethod: '',
    TreatmentResponse: '',
    TreatmentIsImmunization: false,
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
  const [showNewMedicineForm, setShowNewMedicineForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    medicine: '',
    applicationMethod: '',
    isImmunization: false
  });
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

  // Populate form when editing existing issue - FIXED: Removed medicines dependency
  useEffect(() => {
    if (issue && !isCreatingNew) {
      setFormData({
        IssueDescription: issue.IssueDescription || issue.Description || '',
        IssueObservationDate: issue.IssueObservationDate ? 
          new Date(issue.IssueObservationDate).toISOString().split('T')[0] : 
          (issue.DateObserved ? new Date(issue.DateObserved).toISOString().split('T')[0] : ''),
        IssueObservedBy: issue.IssueObservedBy || issue.User || '',
        
        // Treatment fields
        TreatmentMedicine: issue.TreatmentMedicine || '',
        TreatmentDate: issue.TreatmentDate ? 
          new Date(issue.TreatmentDate).toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
        TreatmentMethod: issue.TreatmentMethod || '',
        TreatmentResponse: issue.TreatmentResponse || '',
        TreatmentIsImmunization: issue.TreatmentIsImmunization || false,
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
  }, [issue, isCreatingNew]); // Removed medicines from dependency array

  // Separate useEffect for medicine matching - FIXED: More stable dependency checking
  useEffect(() => {
    if (issue && !isCreatingNew && medicines.length > 0 && issue.TreatmentMedicine) {
      const medicineMatch = medicines.find(m => m.Medicine === issue.TreatmentMedicine);
      setSelectedMedicine(medicineMatch || null);
    }
  }, [issue?.TreatmentMedicine, medicines.length, isCreatingNew]); // More specific dependencies

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveError(null);
  };

  const handleMedicineChange = (medicineValue) => {
    if (medicineValue === 'NEW_MEDICINE') {
      setShowNewMedicineForm(true);
      setSelectedMedicine(null);
      handleInputChange('TreatmentMedicine', '');
    } else if (medicineValue === '') {
      setSelectedMedicine(null);
      handleInputChange('TreatmentMedicine', '');
      handleInputChange('TreatmentMethod', '');
      handleInputChange('TreatmentIsImmunization', false);
    } else {
      const medicine = medicines.find(m => m.Medicine === medicineValue);
      setSelectedMedicine(medicine);
      handleInputChange('TreatmentMedicine', medicine.Medicine);
      handleInputChange('TreatmentMethod', medicine.ApplicationMethod);
      handleInputChange('TreatmentIsImmunization', medicine.IsImmunization);
      setShowNewMedicineForm(false);
    }
  };

  const handleNewMedicineSubmit = async () => {
    if (!newMedicine.medicine.trim() || !newMedicine.applicationMethod.trim()) {
      setSaveError('Medicine name and application method are required');
      return;
    }

    try {
      await onAddMedicine(newMedicine);
      
      // Set the newly created medicine as selected
      setSelectedMedicine(newMedicine);
      handleInputChange('TreatmentMedicine', newMedicine.medicine);
      handleInputChange('TreatmentMethod', newMedicine.applicationMethod);
      handleInputChange('TreatmentIsImmunization', newMedicine.isImmunization);
      
      // Reset form and hide
      setNewMedicine({ medicine: '', applicationMethod: '', isImmunization: false });
      setShowNewMedicineForm(false);
      setSaveError(null);
    } catch (error) {
      setSaveError(`Failed to add medicine: ${error.message}`);
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
          treatmentMedicine: formData.TreatmentMedicine?.trim() || null,
          treatmentDate: formData.TreatmentDate || null,
          treatmentMethod: formData.TreatmentMethod || null,
          treatmentResponse: formData.TreatmentResponse?.trim() || null,
          treatmentIsImmunization: formData.TreatmentIsImmunization,
          treatmentIsActive: formData.TreatmentIsActive,
          // Vet fields
          vetName: formData.VetName?.trim() || null,
          vetComments: formData.VetComments?.trim() || null,
          // General note
          note: `Issue reported by ${formData.IssueObservedBy} on ${formData.IssueObservationDate}`
        };
        
        await onSave(recordData);
      } else {
        // UPDATED: Send data in the format the new database function expects
        const updateData = {};
        
        // Only include fields that should be updated
        updateData.IssueDescription = formData.IssueDescription;
        updateData.IssueObservationDate = formData.IssueObservationDate;
        updateData.IssueObservedBy = formData.IssueObservedBy;
        updateData.IssueSerious = formData.IssueSerious;
        
        // Treatment fields - include even if empty/null to allow clearing
        updateData.TreatmentMedicine = formData.TreatmentMedicine || null;
        updateData.TreatmentDate = formData.TreatmentDate || null;
        updateData.TreatmentResponse = formData.TreatmentResponse || null;
        updateData.TreatmentIsActive = formData.TreatmentIsActive;
        
        // Vet fields - include even if empty/null to allow clearing
        updateData.VetName = formData.VetName || null;
        updateData.VetComments = formData.VetComments || null;
        
        console.log('Sending update data to API:', updateData);
        
        await onUpdate(issue.RecordID, updateData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving issue:', error);
      setSaveError(error.message || 'Failed to save issue');
    } finally {
      setIsSaving(false);
    }
  };    

  const handleResolveIssue = async () => {
    if (!formData.IssueResolutionNote.trim()) {
      setSaveError('Resolution note is required to resolve an issue');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onResolve(issue.RecordID, formData.IssueResolutionNote);
      onClose();
    } catch (error) {
      console.error('Error resolving issue:', error);
      setSaveError(error.message || 'Failed to resolve issue');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsSerious = () => {
    setFormData(prev => ({ ...prev, IssueSerious: true }));
  };

  const isMobile = screenWidth < 700;

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f4f4f4'
    }}>
      {saveError && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          margin: '10px',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Error: {saveError}
        </div>
      )}

      {/* Three Column Layout - Responsive */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '20px',
        overflow: 'auto'
      }}>
        {/* Column 1: Issue Information WITH PHOTO VIEWER */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            padding: '10px 15px',
            backgroundColor: '#e8e9ea',
            borderRadius: '5px',
            textAlign: 'center'
          }}>
            Issue Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Date Observed: *
              </label>
              <input
                type="date"
                value={formData.IssueObservationDate}
                onChange={(e) => handleInputChange('IssueObservationDate', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Observed By: *
              </label>
              <input
                type="text"
                value={formData.IssueObservedBy}
                onChange={(e) => handleInputChange('IssueObservedBy', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Description of Issue: *
              </label>
              <textarea
                value={formData.IssueDescription}
                onChange={(e) => handleInputChange('IssueDescription', e.target.value)}
                rows={6}
                style={textareaStyle}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.IssueSerious}
                  onChange={(e) => handleInputChange('IssueSerious', e.target.checked)}
                />
                <span style={{ fontWeight: 'bold' }}>Mark as Serious Issue</span>
              </label>
            </div>

            {/* PHOTO VIEWER - Only show for existing issues */}
            {!isCreatingNew && issue?.RecordID && (
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  Issue Photos:
                </label>
                <div style={{
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <PhotoViewer
                    cowTag={`medical_${issue.RecordID}`}
                    imageType="issue"
                    style={{
                      width: '100%',
                      height: '200px'
                    }}
                    alternateDefaultPhoto={true}
                  />
                </div>
              </div>
            )}

            {/* Show message for new issues */}
            {isCreatingNew && (
              <div style={{
                border: '1px dashed #ccc',
                borderRadius: '4px',
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontStyle: 'italic'
              }}>
                Photos can be added after creating the issue
              </div>
            )}

            {/* Rest of your existing code for resolution section... */}
            {!isCreatingNew && !formData.IssueResolved && (
              <div style={{ 
                borderTop: '1px solid #ccc', 
                paddingTop: '15px',
                marginTop: '15px'
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Issue Resolution</h4>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Resolution Notes:
                  </label>
                  <textarea
                    value={formData.IssueResolutionNote}
                    onChange={(e) => handleInputChange('IssueResolutionNote', e.target.value)}
                    rows={3}
                    placeholder="Describe how this issue was resolved..."
                    style={textareaStyle}
                  />
                </div>
              </div>
            )}

            {!isCreatingNew && formData.IssueResolved && (
              <div style={{
                backgroundColor: '#d4edda',
                color: '#155724',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                <strong>Issue Resolved</strong><br />
                {formData.IssueResolutionNote && (
                  <span>Resolution: {formData.IssueResolutionNote}</span>
                )}
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
              backgroundColor: '#fbe5d6',
              borderRadius: '5px',
              flex: 1,
              textAlign: 'center',
            }}>
              Treatment
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Medicine Dropdown */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Medicine:
              </label>
              <select
                value={formData.TreatmentMedicine}
                onChange={(e) => handleMedicineChange(e.target.value)}
                disabled={medicinesLoading}
                style={{
                  ...selectStyle,
                  backgroundColor: medicinesLoading ? '#f5f5f5' : 'white'
                }}
              >
                <option value="">Select medicine...</option>
                {medicines.map((medicine, index) => (
                  <option key={index} value={medicine.Medicine}>
                    {medicine.Medicine}
                  </option>
                ))}
                <option value="NEW_MEDICINE">+ Add New Medicine</option>
              </select>
            </div>

            {/* New Medicine Form */}
            {showNewMedicineForm && (
              <div style={{
                border: '2px solid #007bff',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: '#f8f9ff'
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#007bff' }}>Add New Medicine</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                      Medicine Name: *
                    </label>
                    <input
                      type="text"
                      value={newMedicine.medicine}
                      onChange={(e) => setNewMedicine(prev => ({ ...prev, medicine: e.target.value }))}
                      placeholder="Enter medicine name"
                      style={{
                        ...inputStyle,
                        padding: '6px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                      Application Method: *
                    </label>
                    <input
                      type="text"
                      value={newMedicine.applicationMethod}
                      onChange={(e) => setNewMedicine(prev => ({ ...prev, applicationMethod: e.target.value }))}
                      placeholder="e.g., Intramuscular injection"
                      style={{
                        ...inputStyle,
                        padding: '6px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={newMedicine.isImmunization}
                        onChange={(e) => setNewMedicine(prev => ({ ...prev, isImmunization: e.target.checked }))}
                      />
                      <span style={{ fontSize: '14px' }}>Is an Immunization?</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      onClick={handleNewMedicineSubmit}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Add Medicine
                    </button>
                    <button
                      onClick={() => {
                        setShowNewMedicineForm(false);
                        setNewMedicine({ medicine: '', applicationMethod: '', isImmunization: false });
                      }}
                      style={{
                        padding: '8px 16px',
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
              </div>
            )}

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
                disabled={selectedMedicine && !showNewMedicineForm}
                style={{
                  ...inputStyle,
                  backgroundColor: (selectedMedicine && !showNewMedicineForm) ? '#f5f5f5' : 'white',
                  color: (selectedMedicine && !showNewMedicineForm) ? '#666' : 'black'
                }}
              />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.TreatmentIsImmunization}
                    onChange={(e) => handleInputChange('TreatmentIsImmunization', e.target.checked)}
                    disabled={selectedMedicine && !showNewMedicineForm}
                  />
                  <span style={{ 
                    fontSize: '14px',
                    color: (selectedMedicine && !showNewMedicineForm) ? '#666' : 'black'
                  }}>Is an Immunization?</span>
                </label>
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