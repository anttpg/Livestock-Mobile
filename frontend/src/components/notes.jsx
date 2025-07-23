import React, { useState } from 'react';

function Notes({ cowTag, cowData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newObservation, setNewObservation] = useState('');

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleAddObservation = async () => {
    if (!newObservation.trim()) return;
    
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
        setNewObservation('');
        alert('Observation added successfully');
        // Note: In a real app, you'd want to refresh the data here
        window.location.reload(); // Temporary solution
      }
    } catch (error) {
      console.error('Error submitting observation:', error);
      alert('Error adding observation');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.target === document.activeElement) {
      e.preventDefault();
      handleAddObservation();
    }
  };

  // Get notes data - assume API will provide user information
  const notes = cowData?.notes || [];

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
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
          {isExpanded ? 'CLOSE EDIT' : 'EDIT NOTES'}
        </button>
      </div>

      <h3>Recent Observations:</h3>
      
      <div style={{ marginTop: '10px' }}>
        {cowTag ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '2px double black', padding: '8px', width: '150px' }}>Last Modified</th>
                <th style={{ border: '2px double black', padding: '8px', width: '120px' }}>User</th>
                <th style={{ border: '2px double black', padding: '8px' }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {/* Add new observation row - always first, slightly darker */}
              {isExpanded && (
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ border: '2px double black', padding: '8px', fontStyle: 'italic', color: '#666' }}>
                    {formatDate(new Date().toISOString())}
                  </td>
                  <td style={{ border: '2px double black', padding: '8px', fontStyle: 'italic', color: '#666' }}>
                    Current User
                  </td>
                  <td style={{ border: '2px double black', padding: '2px' }}>
                    <textarea
                      value={newObservation}
                      onChange={(e) => setNewObservation(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter new observation..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '6px',
                        border: 'none',
                        resize: 'vertical',
                        fontSize: '14px',
                        backgroundColor: '#f8f9fa'
                      }}
                    />
                  </td>
                </tr>
              )}
              
              {/* Existing notes */}
              {notes.length > 0 ? (
                notes.map((note, index) => (
                  <tr key={index}>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {formatDate(note.DateOfEntry)}
                    </td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {note.User || 'Unknown'} {/* Assuming API will provide user info */}
                    </td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      {note.Note}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan="3" 
                    style={{ 
                      border: '2px double black', 
                      padding: '20px', 
                      textAlign: 'center',
                      fontStyle: 'italic',
                      color: '#666'
                    }}
                  >
                    No observations recorded yet
                  </td>
                </tr>
              )}
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
            Select a cow to view and edit observations
          </div>
        )}
      </div>

      {/* Hidden submit button - kept for future use */}
      <button 
        onClick={handleAddObservation}
        style={{ display: 'none' }}
        id="hidden-submit-button"
      >
        Submit Note
      </button>
    </div>
  );
}

export default Notes;