import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';

function Medical() {
  const [cowTag, setCowTag] = useState('');
  const [cowData, setCowData] = useState(null);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleSearch = async (searchTag) => {
    setCowTag(searchTag);
    try {
      const response = await fetch(`/api/cow/${searchTag}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch cow data');
      }

      const data = await response.json();

      if (data.cowData && data.cowData.length > 0) {
        setCowData(data);
      } else {
        alert(`Cow ${searchTag} not found`);
      }
    } catch (error) {
      console.error('Error fetching cow data:', error);
      alert('Error fetching cow data');
    }
  };

  const addNewIssue = () => {
    // Placeholder function for adding new issue
    console.log('Add new issue functionality to be implemented');
    alert('Add new issue functionality coming soon!');
  };

  const cow = cowData?.cowData?.[0];

  return (
    <div>
      <h1>Medical Records</h1>

      <div id="containers-wrapper">
        <div id="main-container">
          <h3>Cow Tag:</h3>
          <span id="tag">{cow ? cow.CowTag : <i>00</i>}</span>
          
          <h3>Last Location:</h3>
          <span id="location">{cow?.CurrentHerd || <i>Ranch</i>}</span>

          <div id="issues-container">
            <h3>Current Issues</h3>
            <table id="issues-table">
              {cowData?.medicalRecords && cowData.medicalRecords.length > 0 && (
                <>
                  <thead>
                    <tr>
                      <th style={{border: '2px double black'}}>Current Issues</th>
                      <th style={{border: '2px double black'}}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowData.medicalRecords.map((record, index) => (
                      <tr key={index}>
                        <td style={{border: '2px double black'}}>{record.IssueDescription || ''}</td>
                        <td style={{border: '2px double black'}}>
                          {record.TreatmentDate ? formatDate(record.TreatmentDate) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
            <button onClick={addNewIssue} style={{ marginTop: '10px' }}>Add New Issue</button>
          </div>
        </div>

        <div id="allmedical-container">
          <div id="medications-container">
            <h3>Current Medications:</h3>
            <table id="medications-table">
              {cowData?.medicalRecords && cowData.medicalRecords.length > 0 && (
                <>
                  <thead>
                    <tr>
                      <th style={{border: '2px double black'}}>Medication</th>
                      <th style={{border: '2px double black'}}>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowData.medicalRecords.map((med, index) => (
                      <tr key={index}>
                        <td style={{border: '2px double black'}}>{med.TreatmentMedicine}</td>
                        <td style={{border: '2px double black'}}>{formatDate(med.TreatmentDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>

          <div id="past-history">
            <h3>Maintenance History</h3>
            <table id="past-table">
              <thead>
                <tr>
                  <th style={{border: '2px double black'}}>Treatment</th>
                  <th style={{border: '2px double black'}}>Date</th>
                  <th style={{border: '2px double black'}}>Response</th>
                </tr>
              </thead>
              <tbody>
                {cowData?.medicalRecords && cowData.medicalRecords
                  .filter(record => record.Treatment || record.TreatmentResponse)
                  .map((record, index) => (
                    <tr key={index}>
                      <td style={{border: '2px double black'}}>{record.Treatment || 'N/A'}</td>
                      <td style={{border: '2px double black'}}>
                        {record.TreatmentDate ? formatDate(record.TreatmentDate) : 'N/A'}
                      </td>
                      <td style={{border: '2px double black'}}>{record.TreatmentResponse || 'N/A'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="search-container">
        <SearchBar 
          onSearch={handleSearch} 
          placeholder="Medical Record Search: Cow Tag #"
        />
      </div>
    </div>
  );
}

export default Medical;