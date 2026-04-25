import React, { useState, useEffect, useRef } from 'react';
import PhotoViewer from './photoViewer';
import FileViewer from './FileViewer';
import { useUser } from '../UserContext';
import SelectMedicine from './selectMedicine';
import { toUTC, toLocalDisplay } from '../utils/dateUtils';

function IssueSubform({
    issue,
    cowTag,
    isCreatingNew,
    onClose,
    onSave,
    onUpdate,
    onResolve
}) {
    // toLocalDateTimeInput: converts a UTC datetime string for use in <input type="datetime-local">.
    // The shared toLocalInput utility returns only YYYY-MM-DD (for <input type="date">),
    // which is insufficient here — datetime-local requires YYYY-MM-DDTHH:MM.
    // NOTE: a toLocalDateTimeInput function should be added to dateUtils to replace this helper.
    const toLocalDateTimeInput = (utcStr) => {
        if (!utcStr) return '';
        const d = new Date(utcStr);
        return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const nowLocal = () => toLocalDateTimeInput(new Date().toISOString());

    const [formData, setFormData] = useState({
        IssueDescription: '',
        IssueObservationDate: nowLocal(),
        IssueObservedBy: useUser()?.username,
        TreatmentMedicineID: '',
        TreatmentDate: nowLocal(),
        TreatmentResponse: '',
        TreatmentIsActive: false,
        VetName: '',
        VetComments: '',
        IssueSerious: false,
        IssueResolved: false,
        IssueResolutionNote: '',
        IssueResolutionDate: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const fileViewerRef = useRef(null);

    const recordId = issue?.ID || issue?.RecordID;

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

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (issue && !isCreatingNew) {
            setFormData({
                IssueDescription: issue.IssueDescription || issue.Description || '',
                IssueObservationDate: toLocalDateTimeInput(issue.IssueObservationDate || issue.DateObserved) || nowLocal(),
                IssueObservedBy: issue.IssueObservedBy || issue.User || '',
                TreatmentMedicineID: issue.TreatmentMedicine || '',
                TreatmentDate: toLocalDateTimeInput(issue.TreatmentDate) || nowLocal(),
                TreatmentResponse: issue.TreatmentResponse || '',
                TreatmentIsActive: issue.TreatmentIsActive || false,
                VetName: issue.VetName || '',
                VetComments: issue.VetComments || '',
                IssueSerious: issue.IssueSerious || issue.IsSerious || false,
                IssueResolved: issue.IssueResolved || issue.IsResolved || false,
                IssueResolutionNote: issue.IssueResolutionNote || '',
                IssueResolutionDate: issue.IssueResolutionDate || ''
            });
        }
    }, [issue, isCreatingNew]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSaveError(null);
    };

    const validateForm = () => {
        const errors = [];
        if (!formData.IssueDescription.trim()) errors.push('Issue description is required');
        if (!formData.IssueObservationDate) errors.push('Observation date is required');
        if (!formData.IssueObservedBy.trim()) errors.push('Observer name is required');
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
                await onSave({
                    recordType: 'issue',
                    Note: `Issue reported by ${formData.IssueObservedBy} on ${toLocalDisplay(formData.IssueObservationDate)}`,
                    IssueDescription: formData.IssueDescription,
                    IssueObservationDate: toUTC(formData.IssueObservationDate),
                    IssueObservedBy: formData.IssueObservedBy,
                    IssueSerious: formData.IssueSerious,
                    TreatmentMedicineID: formData.TreatmentMedicineID?.trim() || null,
                    TreatmentDate: toUTC(formData.TreatmentDate),
                    TreatmentResponse: formData.TreatmentResponse?.trim() || null,
                    TreatmentIsActive: formData.TreatmentIsActive,
                    VetName: formData.VetName?.trim() || null,
                    VetComments: formData.VetComments?.trim() || null,
                }, fileViewerRef);
                // flushPending is handled inside onSave (saveMedicalRecord in medical.jsx).
                // Do NOT call it again here — both closures share the same pendingFiles snapshot
                // and a second call would re-upload every file.
            } else {
                await onUpdate(recordId, {
                    IssueDescription: formData.IssueDescription,
                    IssueObservationDate: toUTC(formData.IssueObservationDate),
                    IssueObservedBy: formData.IssueObservedBy,
                    IssueSerious: formData.IssueSerious,
                    TreatmentMedicineID: formData.TreatmentMedicineID || null,
                    TreatmentDate: toUTC(formData.TreatmentDate),
                    TreatmentResponse: formData.TreatmentResponse || null,
                    TreatmentIsActive: formData.TreatmentIsActive,
                    VetName: formData.VetName || null,
                    VetComments: formData.VetComments || null
                });
            }
            onClose();
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
                await onUpdate(recordId, { IssueSerious: true });
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
            await onResolve(recordId, formData.IssueResolutionNote);
            onClose();
        } catch (error) {
            console.error('Error resolving issue:', error);
            setSaveError(error.message || 'Failed to resolve issue');
        } finally {
            setIsSaving(false);
        }
    };

    const isMobile = screenWidth < 900;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8f9fa' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>

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

                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '15px',
                    padding: '20px',
                }}>

                    {/* Column 1: Issue Information */}
                    <div className="bubble-container" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{
                            margin: '0 0 20px 0',
                            padding: '10px 15px',
                            backgroundColor: '#bbc1cd',
                            borderRadius: '5px',
                            textAlign: 'center'
                        }}>
                            Issue
                        </h3>

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
                                    type="datetime-local"
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
                                        placeholder={formData.IssueResolved ? 'Issue has been resolved' : 'Enter resolution notes to mark as resolved'}
                                        rows={4}
                                        style={textareaStyle}
                                        disabled={formData.IssueResolved}
                                    />
                                </div>
                            )}

                            {isCreatingNew && (
                                <p style={{ margin: '0', fontSize: '13px', color: '#6c757d' }}>
                                    * Photo upload is available after the issue has been saved.
                                </p>
                            )}

                            {/* Issue photo — only available after the record exists */}
                            {!isCreatingNew && recordId && (
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                                        Issue Photo:
                                    </label>
                                    <PhotoViewer domain="medical" recordId={recordId} filter="ISSUE" defaultImage="/images/NoPhoto.png" style={{ width: '100%', borderRadius: '5px', border: '1px solid #ccc' }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Treatment Information */}
                    <div className="bubble-container" style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                            margin: '0 0 20px 0',
                            padding: '10px 15px',
                            backgroundColor: '#f8cbad',
                            borderRadius: '5px',
                            textAlign: 'center'
                        }}>
                            Treatment
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Medicine Applied:
                                </label>
                                <SelectMedicine
                                    value={formData.TreatmentMedicineID}
                                    onChange={(id) => handleInputChange('TreatmentMedicineID', id)}
                                    disabled={formData.IssueResolved}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Date Applied:
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.TreatmentDate}
                                    onChange={(e) => handleInputChange('TreatmentDate', e.target.value)}
                                    style={inputStyle}
                                    disabled={formData.IssueResolved}
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
                                    rows={5}
                                    style={textareaStyle}
                                    disabled={formData.IssueResolved}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.TreatmentIsActive}
                                        onChange={(e) => handleInputChange('TreatmentIsActive', e.target.checked)}
                                        disabled={formData.IssueResolved}
                                    />
                                    <span style={{ fontSize: '14px' }}>Cow is currently on this medicine</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Veterinarian Information */}
                    <div className="bubble-container" style={{ flex: 1 }}>
                        <h3 style={{
                            margin: '0 0 20px 0',
                            padding: '10px 15px',
                            backgroundColor: '#e8e9ea',
                            borderRadius: '5px',
                            textAlign: 'center'
                        }}>
                            Vet
                        </h3>

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

                            {isCreatingNew && (
                                <p style={{ margin: '0', fontSize: '13px', color: '#6c757d' }}>
                                    * File upload is available after the issue has been saved.
                                </p>
                            )}

                            {/* File upload — always rendered; queues files before record exists */}
                            <FileViewer
                                ref={fileViewerRef}
                                domain="medicalUpload"
                                recordId={isCreatingNew ? null : recordId}
                            />
                        </div>
                    </div>
                </div>

            </div>

            {/* Action Buttons */}
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