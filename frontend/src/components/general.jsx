import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';

function General() {
  const [cowTag, setCowTag] = useState('');
  const [cowData, setCowData] = useState(null);
  const [newObservation, setNewObservation] = useState('');

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

  const handleAddObservation = async (e) => {
    e.preventDefault();
    const dateOfNote = new Date().toISOString();

    try {
      const response = await fetch('/api/add-observation', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          note: newObservation, 
          dateOfEntry: dateOfNote, 
          cowTag: cowTag 
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to add observation');
      }

      const responseData = await response.json();
      
      if (responseData.success) {
        // Update local state to show new observation
        setCowData(prev => ({
          ...prev,
          notes: [...prev.notes, { Note: newObservation, DateOfEntry: dateOfNote }]
        }));
        
        setNewObservation('');
        alert('Observation added successfully');
      }
    } catch (error) {
      console.error('Error submitting observation:', error);
      alert('Error adding observation');
    }
  };

  const cow = cowData?.cowData?.[0];

  return (
    <div>
      <h1>Cow Data</h1>

      <div id="search-container">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div id="wrapper">
        <div id="image-container">
          <img 
            id="body-image" 
            src={cow?.BodyPath || '/images/example-cow.jpg'} 
            width="200" 
            height="200" 
            alt="cow body" 
          />
          <img 
            id="headshot-image" 
            src={cow?.HeadshotPath || '/images/cow-headshot.jpg'} 
            width="200" 
            height="200" 
            alt="cow headshot" 
          />
        </div>
        
        <div id="main-container">
          <div id="info-container">
            <h3>Date of Birth:</h3>
            <span id="dob">
              {cow ? formatDate(cow.DateOfBirth) : <i>YYYY-MM-DD</i>}
            </span>
            
            <h3>Current Weight:</h3>
            <span id="weight">
              {cow ? cow.CurrentWeight : <i>Weight of Cow.</i>}
            </span>
            
            <h3>Other Descriptors:</h3>
            <span id="cow-description">
              {cow ? cow.Description : <i>Description of Cow's attributes.</i>}
            </span>
            
            <div id="medications-container">
              <h3>Current Medications:</h3>
              <div id="medications-table">
                {cowData?.medicalRecords && cowData.medicalRecords.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th style={{border: '2px double black'}}>Medication</th>
                        <th style={{border: '2px double black'}}>Start Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cowData.medicalRecords.map((med, index) => (
                        <tr key={index}>
                          <td style={{border: '2px double black'}}>{med.MedicineApplied}</td>
                          <td style={{border: '2px double black'}}>{formatDate(med.TreatmentDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="containers-wrapper">
        <div id="calf-container">
          <div id="calf-data">
            <h3>Current Calves:</h3>
            <div id="calves-table">
              {cowData?.calves && cowData.calves.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th style={{border: '2px double black'}}>Calf Tag</th>
                      <th style={{border: '2px double black'}}>DOB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowData.calves.map((calf, index) => (
                      <tr key={index}>
                        <td style={{border: '2px double black'}}>{calf.CalfTag}</td>
                        <td style={{border: '2px double black'}}>{formatDate(calf.DOB)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div id="observations-container">
          <div id="recent-observations">
            <h3>Recent Observations:</h3>
            <div id="observations">
              {cowData?.notes && cowData.notes.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th style={{border: '2px double black'}}>Note</th>
                      <th style={{border: '2px double black'}}>Date Of Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowData.notes.map((note, index) => (
                      <tr key={index}>
                        <td style={{border: '2px double black'}}>{note.Note}</td>
                        <td style={{border: '2px double black'}}>{formatDate(note.DateOfEntry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div id="new-observations">
            <h3>New Observations:</h3>
            <form onSubmit={handleAddObservation}>
              <textarea
                style={{
                  width: '400px', 
                  height: '200px',
                  padding: '8px',
                  fontSize: '14px',
                  border: '2px solid #ccc',
                  borderRadius: '4px'
                }} 
                value={newObservation}
                onChange={(e) => setNewObservation(e.target.value)}
                placeholder="Enter observation..."
                required
              />
              <br />
              <button type="submit" style={{ marginTop: '10px' }}>Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default General;