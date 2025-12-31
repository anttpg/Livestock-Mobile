/* eslint-disable react/prop-types */
import React, { useState, useCallback, useEffect } from 'react';
import ColorTable from './colorTable'; 
import Popup from './popup';
import IssueSubform from './issueSubform';
import MedicationViewer from './MedicationViewer';

// Responsive breakpoint constants
const BREAKPOINT_HIDE_USER = 800;
const BREAKPOINT_HIDE_TREATMENT = 600;

function Medical({ cowTag, cowData, currentUser, loading = false, hideSearchBar = false, onDataUpdate }) {
  const [expandedMedicines, setExpandedMedicines] = useState(new Set());
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [medicines, setMedicines] = useState([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [showMedicationViewer, setShowMedicationViewer] = useState(false);

  // Handle screen resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load medicines when component mounts
  useEffect(() => {
    loadMedicines();
  }, []);

  // Debug log medical records when cowData changes
  useEffect(() => {
    if (cowData?.medicalRecords) {
      console.log('Medical records for cow:', cowData.medicalRecords);
    }
  }, [cowData]);

  const loadMedicines = async () => {
    setMedicinesLoading(true);
    try {
      const response = await fetch('/api/medical/medicines', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines || []);
      } else {
        console.error('Failed to load medicines:', response.status);
        setMedicines([]);
      }
    } catch (error) {
      console.error('Error loading medicines:', error);
      setMedicines([]);
    } finally {
      setMedicinesLoading(false);
    }
  };

  const addNewMedicine = async (medicineData) => {
    try {
      const response = await fetch('/api/medical/medicines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(medicineData)
      });
      
      if (response.ok) {
        await loadMedicines(); // Reload medicines list
        return true;
      } else {
        throw new Error('Failed to add medicine');
      }
    } catch (error) {
      console.error('Error adding medicine:', error);
      throw error;
    }
  };

  const updateMedicine = async (medicineID, medicineData) => {
    try {
      const response = await fetch(`/api/medical/medicines/${medicineID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(medicineData)
      });
      
      if (response.ok) {
        await loadMedicines(); // Reload medicines list
        return true;
      } else {
        throw new Error('Failed to update medicine');
      }
    } catch (error) {
      console.error('Error updating medicine:', error);
      throw error;
    }
  };

  // Calculate cow age to determine if calf regimen should show
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const now = new Date();
    const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                       (now.getMonth() - birthDate.getMonth());
    return ageInMonths;
  };

  const cowAge = cowData?.cowData?.[0]?.DateOfBirth ? 
    calculateAge(cowData.cowData[0].DateOfBirth) : null;
  const isYoungCalf = cowAge !== null && cowAge < 12;

  // Helper function to get medicine name from ID
  const getMedicineName = (medicineID) => {
    if (!medicineID) return 'None';
    const medicine = medicines.find(m => m.ID === medicineID);
    if (!medicine) return medicineID; // Fallback to ID if not found
    // Prefer BrandName, then GenericName, then Shorthand
    return medicine.BrandName || medicine.GenericName || medicine.Shorthand || medicineID;
  };

  // Transform database medical records
  const transformIssuesData = () => {
    if (!cowData?.medicalRecords?.issues) return [];
    
    return cowData.medicalRecords.issues.map(issue => ({
      RecordID: issue.ID, // Map ID to RecordID
      Description: issue.IssueDescription || 'No description',
      DateObserved: issue.IssueObservationDate,
      User: issue.IssueObservedBy || 'Unknown',
      TreatmentMedicine: getMedicineName(issue.TreatmentMedicine),
      IsSerious: issue.IssueSerious || false,
      IsResolved: issue.IssueResolved || false,
      // Include all original database fields for IssueSubform
      ...issue
    }));
  };

  const transformTreatmentData = () => {
    if (!cowData?.medicalRecords?.treatments) return [];
    
    // Group ALL treatments by medicine name (not just immunizations)
    const grouped = {};
    cowData.medicalRecords.treatments.forEach(treatment => {
      const medicineName = getMedicineName(treatment.TreatmentMedicine);
      const key = medicineName;
      
      if (!grouped[key]) {
        grouped[key] = {
          Medicine: medicineName,
          Dose: treatment.TreatmentMethod || 'Unknown method',
          DateApplied: treatment.TreatmentDate,
          IsImmunization: treatment.IsImmunization,
          hasMultiple: false,
          allRecords: []
        };
      }
      
      grouped[key].allRecords.push({
        DateApplied: treatment.TreatmentDate,
        Dose: treatment.TreatmentMethod || 'Unknown method',
        IsImmunization: treatment.IsImmunization
      });
      
      if (grouped[key].allRecords.length > 1) {
        grouped[key].hasMultiple = true;
      }
    });
    
    return Object.values(grouped);
  };

  const saveMedicalRecord = useCallback(async (recordData) => {
    try {
      const response = await fetch('/api/medical/add-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cowTag: cowTag,
          recordType: 'issue', // Default to issue, could be dynamic
          ...recordData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save medical record');
      }
      
      const result = await response.json();
      console.log('Medical record saved:', result);
      
      // Refresh cow data
      if (onDataUpdate) {
        await onDataUpdate();
      }
      
      return result;
    } catch (error) {
      console.error('Error saving medical record:', error);
      throw error;
    }
  }, [cowTag, onDataUpdate]);

  const updateMedicalRecord = useCallback(async (recordID, updateData) => {
    try {
      console.log('Medical.jsx sending update data:', updateData);
      
      const response = await fetch(`/api/medical/update-record/${recordID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update medical record');
      }
      
      const result = await response.json();
      console.log('Medical record updated:', result);
      
      // Refresh cow data
      if (onDataUpdate) {
        await onDataUpdate();
      }
      
      return result;
    } catch (error) {
      console.error('Error updating medical record:', error);
      throw error;
    }
  }, [onDataUpdate]);

  const resolveIssue = useCallback(async (recordID, resolutionNote) => {
    try {
      const response = await fetch(`/api/medical/resolve-record/${recordID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resolutionNote,
          resolutionDate: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resolve issue');
      }
      
      const result = await response.json();
      console.log('Issue resolved:', result);
      
      // Refresh cow data
      if (onDataUpdate) {
        await onDataUpdate();
      }
      
      return result;
    } catch (error) {
      console.error('Error resolving issue:', error);
      throw error;
    }
  }, [onDataUpdate]);

  const issuesData = transformIssuesData();
  const treatmentsData = transformTreatmentData();

  const toggleMedicineExpansion = (medicine) => {
    const newExpanded = new Set(expandedMedicines);
    if (newExpanded.has(medicine)) {
      newExpanded.delete(medicine);
    } else {
      newExpanded.add(medicine);
    }
    setExpandedMedicines(newExpanded);
  };

  const handleViewDetails = (issue) => {
    setSelectedIssue(issue);
    setIsCreatingNew(false);
    setShowIssueDetails(true);
  };

  const handleCreateNewIssue = () => {
    setSelectedIssue(null);
    setIsCreatingNew(true);
    setShowIssueDetails(true);
  };

  const handleCloseIssueDetails = () => {
    setShowIssueDetails(false);
    setSelectedIssue(null);
    setIsCreatingNew(false);
  };

  const handleOpenMedicationViewer = () => {
    setShowMedicationViewer(true);
  };

  const handleCloseMedicationViewer = () => {
    setShowMedicationViewer(false);
  };

  // Responsive Issues & Injuries columns - filter based on screen width
  const getIssuesColumns = () => {
    const baseColumns = [
      {
        key: 'Description',
        header: 'Description of Issue',
        customRender: (value, row, rowIndex, styling) => (
          <div style={{
            backgroundColor: styling.backgroundColor,
            color: styling.textColor,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            minHeight: '30px',
            padding: '8px',
            boxSizing: 'border-box'
          }}>
            {value} {row.IsResolved && '(RESOLVED)'}
          </div>
        )
      },
      {
        key: 'DateObserved',
        header: 'Date Observed',
        type: 'date',
        width: '100px',
        noWrap: true
      }
    ];

    // Add User column only if screen is wide enough
    if (screenWidth > BREAKPOINT_HIDE_USER) {
      baseColumns.push({
        key: 'User',
        header: 'User',
        width: '100px',
        noWrap: true
      });
    }

    // Add Treatment column only if screen is wide enough
    if (screenWidth > BREAKPOINT_HIDE_TREATMENT) {
      baseColumns.push({
        key: 'TreatmentMedicine',
        header: 'Treatment',
        autoWidth: true,
        maxWidth: '300px'
      });
    }

    return baseColumns;
  };

  const issuesColumns = getIssuesColumns();

  // Sort issues: serious first, then by date
  const sortedIssues = [...issuesData].sort((a, b) => {
    if (a.IsSerious && !b.IsSerious) return -1;
    if (!a.IsSerious && b.IsSerious) return 1;
    return new Date(b.DateObserved) - new Date(a.DateObserved);
  });

  // Prepare treatment data with expanded rows
  const prepareTreatmentData = () => {
    let data = [];
    
    treatmentsData.forEach(med => {
      const isExpanded = expandedMedicines.has(med.Medicine);
      
      if (isExpanded && med.hasMultiple) {
        med.allRecords.forEach((record, index) => {
          data.push({
            Medicine: med.Medicine,
            Dose: record.Dose,
            DateApplied: record.DateApplied,
            IsImmunization: record.IsImmunization,
            isExpanded: true,
            showButton: index === 0,
            hasMultiple: med.hasMultiple,
            medicineKey: med.Medicine
          });
        });
      } else {
        data.push({
          Medicine: med.Medicine,
          Dose: med.Dose,
          DateApplied: med.DateApplied,
          IsImmunization: med.IsImmunization,
          isExpanded: false,
          showButton: true,
          hasMultiple: med.hasMultiple,
          medicineKey: med.Medicine
        });
      }
    });
    
    return data;
  };

  const treatmentColumns = [
    {
      key: 'Medicine',
      header: 'Medicine, Method',
      width: 'auto',
      customRender: (value, row, rowIndex, styling) => (
        <div style={{
          backgroundColor: styling.backgroundColor,
          color: styling.textColor,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          minHeight: '30px',
          padding: '8px',
          boxSizing: 'border-box'
        }}>
          {row.showButton && row.hasMultiple && (
            <button
              onClick={() => toggleMedicineExpansion(row.medicineKey)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                marginRight: '8px',
                fontSize: '12px',
                color: '#007bff'
              }}
            >
              {expandedMedicines.has(row.medicineKey) ? '−' : '+'}
            </button>
          )}
          {!row.showButton && row.hasMultiple && (
            <span style={{ marginRight: '16px' }}></span>
          )}
          <span>
            {value && `${value}`}{row.Dose && (!value ? row.Dose : `, ${row.Dose}`)}
          </span>
          {row.IsImmunization === 1 && (
            <span style={{
              marginLeft: '8px',
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              Vaccine
            </span>
          )}
        </div>
      )
    },
    {
      key: 'DateApplied',
      header: 'Date Applied',
      width: '120px',
      type: 'date'
    }
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading medical records...
      </div>
    );
  }

  return (
    <div className="multibubble-page">
      {/* Section 1: Issues & Injuries */}
      <div className="bubble-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: '0' }}>Issues & Injuries</h3>
          <button
            onClick={handleCreateNewIssue}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + New Issue
          </button>
        </div>
        
        {/* Responsive ColorTable with dynamic column filtering */}
        <ColorTable
          data={sortedIssues}
          columns={issuesColumns}
          showActionColumn={true}
          actionButtonText="View Details"
          actionButtonColor="#007bff"
          onActionClick={(row) => handleViewDetails(row)}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f4f4f4"
          emptyMessage={cowTag ? "No issues or injuries on record" : "Select a cow to view medical issues"}
          maxWidth="1000px"
          ShortenDate={true}
          // Conditional coloring - Description gets darker red, others get lighter red
          conditionalColors={{
            'Description': {
              condition: (row) => row.IsSerious,
              trueColor: '#ba1419',  // Darker red for Description column
              trueTextColor: 'white',
              falseColor: 'inherit',
              falseTextColor: 'black'
            },
            'DateObserved': {
              condition: (row) => row.IsSerious,
              trueColor: '#cf7b79',  // Lighter red for other columns
              trueTextColor: 'white',
              falseColor: 'inherit'
            },
            'User': {
              condition: (row) => row.IsSerious,
              trueColor: '#cf7b79',
              trueTextColor: 'white',
              falseColor: 'inherit'
            },
            'TreatmentMedicine': {  
                condition: (row) => row.IsSerious,
                trueColor: '#cf7b79',
                trueTextColor: 'white',
                falseColor: 'inherit'
            }
          }}
          headerColors={{
            'Description': '#bbc1cd'
          }}
        />
      </div>

      {/* Section 2: All Treatments (Immunizations & Maintenance) */}
      <div className="bubble-container" style={{maxWidth:"600px"}}>
        <h3 style={{ margin: '0 0 15px 0' }}>Treatments & Immunizations</h3>
        <ColorTable
          data={prepareTreatmentData()}
          columns={treatmentColumns}
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f4f4f4"
          ShortenDate={true}
          emptyMessage={cowTag ? "No treatment records found" : "Select a cow to view treatment history"}
          // Proper coloring for treatment table - expanded vs non-expanded
          conditionalColors={{
            'Medicine': {
              condition: (row) => row.isExpanded,
              trueColor: 'rgb(238, 220, 209)',  // Expanded shade
              falseColor: '#fbe5d6'  // Non-expanded shade
            }
          }}
          headerColors={{
            'Medicine': '#f8cbad'
          }}
        />
      </div>

      {/* Section 3: Medicine Database */}
      <div className="bubble-container" style={{maxWidth:"1000px"}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: '0' }}>Medicine Database</h3>
          <button
            onClick={handleOpenMedicationViewer}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            View All Medicines
          </button>
        </div>
        <div style={{ 
          padding: '15px',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
          border: '1px solid #b8daff',
          fontSize: '14px',
          color: '#004085'
        }}>
          Click "View All Medicines" to see the complete medicine database and add or edit medications.
        </div>
      </div>

      {/* Issue Details Popup */}
      <Popup
        isOpen={showIssueDetails}
        onClose={handleCloseIssueDetails}
        title={isCreatingNew ? "New Issue" : "Issue Details"}
        fullscreen={true}
      >
        <IssueSubform 
          issue={selectedIssue}
          cowTag={cowTag}
          currentUser={currentUser}
          isCreatingNew={isCreatingNew}
          onClose={handleCloseIssueDetails}
          onSave={saveMedicalRecord}
          onUpdate={updateMedicalRecord}
          onResolve={resolveIssue}
          medicines={medicines}
          medicinesLoading={medicinesLoading}
          onAddMedicine={addNewMedicine}
          onOpenMedicationViewer={handleOpenMedicationViewer}
        />
      </Popup>

      {/* Medication Viewer Popup */}
      <Popup
        isOpen={showMedicationViewer}
        onClose={handleCloseMedicationViewer}
        title="Medicine Database"
        fullscreen={true}
      >
        <MedicationViewer
          medicines={medicines}
          onClose={handleCloseMedicationViewer}
          onAddMedicine={addNewMedicine}
          onUpdateMedicine={updateMedicine}
          medicinesLoading={medicinesLoading}
        />
      </Popup>
    </div>
  );
}

export default Medical;