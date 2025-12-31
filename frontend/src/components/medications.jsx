import React from 'react';

function Medications({ cowTag, cowData, medicines = [] }) {
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Helper function to get medicine name from ID
  const getMedicineName = (medicineID) => {
    if (!medicineID) return 'Unknown';
    const medicine = medicines.find(m => m.ID === medicineID);
    if (!medicine) return medicineID; // Fallback to ID if not found
    // Prefer BrandName, then GenericName, then Shorthand
    return medicine.BrandName || medicine.GenericName || medicine.Shorthand || medicineID;
  };

  // Extract current medications from real medical records
  const getCurrentMedications = () => {
    if (!cowData?.medicalRecords?.treatments) return [];
    
    // Filter for active treatments only
    return cowData.medicalRecords.treatments
      .filter(treatment => treatment.TreatmentIsActive)
      .map(treatment => ({
        MedicineApplied: getMedicineName(treatment.TreatmentMedicine),
        TreatmentDate: treatment.TreatmentDate,
        Method: treatment.TreatmentMethod,
        Response: treatment.TreatmentResponse,
        IsImmunization: treatment.IsImmunization
      }))
      .sort((a, b) => new Date(b.TreatmentDate) - new Date(a.TreatmentDate));
  };

  const currentMedications = getCurrentMedications();

  return (
    <div style={{ 
      border: '1px solid #ccc',
      padding: '15px',
      borderRadius: '5px'
    }}>
      <h3>Current Medications:</h3>
      
      <div style={{ marginTop: '10px' }}>
        {cowTag ? (
          currentMedications.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '2px double black', padding: '8px' }}>Medication</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>Start Date</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>Method</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {currentMedications.map((med, index) => (
                  <tr key={index}>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {med.MedicineApplied}
                    </td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {formatDate(med.TreatmentDate)}
                    </td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {med.Method || 'Not specified'}
                    </td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      <span style={{
                        backgroundColor: med.IsImmunization ? '#d4edda' : '#fff3cd',
                        color: med.IsImmunization ? '#155724' : '#856404',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {med.IsImmunization ? 'Immunization' : 'Treatment'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              fontStyle: 'italic',
              color: '#666',
              border: '2px dashed #ccc',
              borderRadius: '5px'
            }}>
              No current medications on record
            </div>
          )
        ) : (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center',
            fontStyle: 'italic',
            color: '#666',
            border: '2px dashed #ccc',
            borderRadius: '5px'
          }}>
            Select a cow to view medication history
          </div>
        )}
      </div>
    </div>
  );
}

export default Medications;