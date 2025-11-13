import React, { useState, useCallback, useEffect } from 'react';
import ColorTable from './colorTable'; 
import Popup from './popup';
import IssueSubform from './issueSubform';

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

  const loadMedicines = async () => {
    setMedicinesLoading(true);
    try {
      const response = await fetch('/api/medical/medicines', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines || []);
        console.log('Loaded medicines:', data.medicines);
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

  // Transform database medical records (same as before)
  const transformIssuesData = () => {
    if (!cowData?.medicalRecords?.issues) return [];
    
    return cowData.medicalRecords.issues.map(issue => ({
      RecordID: issue.RecordID,
      Description: issue.IssueDescription || 'No description',
      DateObserved: issue.IssueObservationDate,
      User: issue.IssueObservedBy || 'Unknown',
      TreatmentMedicine: issue.TreatmentMedicine || 'None',
      IsSerious: issue.IssueSerious || false,
      IsResolved: issue.IssueResolved || false,
      // Include all original database fields for IssueSubform
      ...issue
    }));
  };

  const transformImmunizationData = () => {
    if (!cowData?.medicalRecords?.treatments) return [];
    
    // Group treatments by medicine name
    const grouped = {};
    cowData.medicalRecords.treatments.forEach(treatment => {
      if (!treatment.TreatmentIsImmunization) return;
      
      const key = treatment.TreatmentMedicine;
      if (!grouped[key]) {
        grouped[key] = {
          Medicine: key,
          Dose: treatment.TreatmentMethod || 'Unknown method',
          DateApplied: treatment.TreatmentDate,
          hasMultiple: false,
          allRecords: []
        };
      }
      
      grouped[key].allRecords.push({
        DateApplied: treatment.TreatmentDate,
        Dose: treatment.TreatmentMethod || 'Unknown method'
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
    const immunizationsData = transformImmunizationData();
  
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
  
    // Prepare immunization data with expanded rows (same logic as before)
    const prepareImmunizationData = () => {
      let data = [];
      
      immunizationsData.forEach(med => {
        const isExpanded = expandedMedicines.has(med.Medicine);
        
        if (isExpanded && med.hasMultiple) {
          med.allRecords.forEach((record, index) => {
            data.push({
              Medicine: med.Medicine,
              Dose: record.Dose,
              DateApplied: record.DateApplied,
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
            isExpanded: false,
            showButton: true,
            hasMultiple: med.hasMultiple,
            medicineKey: med.Medicine
          });
        }
      });
      
      return data;
    };
  
    const immunizationColumns = [
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
              {value && `${value}`}{row.Method && (!value ? row.Method : `, ${row.Method}`)}
            </span>
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
  
        {/* Section 2: Immunizations & Maintenance */}
        <div className="bubble-container" style={{maxWidth:"500px"}}>
          <h3 style={{ margin: '0 0 15px 0' }}>Immunizations & Maintenance</h3>
          <ColorTable
            data={prepareImmunizationData()}
            columns={immunizationColumns}
            showActionColumn={false}
            alternatingRows={true}
            evenRowColor="#fff"
            oddRowColor="#f4f4f4"
            ShortenDate={true}
            emptyMessage={cowTag ? "No immunization records found" : "Select a cow to view immunization history"}
            // Proper coloring for immunization table - expanded vs non-expanded
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
          />
        </Popup>
      </div>
    );
  }
  
  export default Medical;