import React from 'react';

function Medications({ cowTag, cowData }) {
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const medicalRecords = cowData?.medicalRecords || [];

  return (
    <div style={{ 
      border: '1px solid #ccc',
      padding: '15px',
      borderRadius: '5px'
    }}>
      <h3>Current Medications:</h3>
      
      <div style={{ marginTop: '10px' }}>
        {cowTag ? (
          medicalRecords.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '2px double black', padding: '8px' }}>Medication</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>Start Date</th>
                </tr>
              </thead>
              <tbody>
                {medicalRecords.map((med, index) => (
                  <tr key={index}>
                    <td style={{ border: '2px double black', padding: '8px' }}>{med.MedicineApplied}</td>
                    <td style={{ border: '2px double black', padding: '8px' }}>{formatDate(med.TreatmentDate)}</td>
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