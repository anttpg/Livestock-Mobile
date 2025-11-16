import React, { useState } from 'react';
import Table from './table'; // Add this import

function Notes({ cowTag, cowData, onRefresh, currentUser }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newObservation, setNewObservation] = useState('');

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleAddObservation = async () => {
    if (!newObservation.trim() || !cowTag) return;
    
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
        // Call parent refresh function instead of page reload
        if (onRefresh) {
          onRefresh();
        }
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

  // Get notes data and prepare for table
  const notes = cowData?.notes || [];
  
  // Create table data - include new observation row when expanded
  const tableData = [];
  
  // Add new observation row when expanded
  if (isExpanded && cowTag) {
    tableData.push({
      DateOfEntry: new Date().toISOString(),
      User: currentUser || 'Current User',
      Note: '', // This will be handled specially
      isNewRow: true // Flag to identify this as the new row
    });
  }
  
  // Add existing notes
  tableData.push(...notes.map(note => ({
    DateOfEntry: note.DateOfEntry,
    User: note.User || currentUser || 'Unknown',
    Note: note.Note,
    isNewRow: false
  })));

  // Define columns for the notes table
  const notesColumns = [
    {
      key: 'DateOfEntry',
      header: 'Last Modified',
      type: 'date',
      width: '150px',
      align: 'left'
    },
    {
      key: 'User',
      header: 'User',
      type: 'text',
      width: '120px',
      align: 'left'
    },
    {
      key: 'Note',
      header: 'Note',
      type: 'text',
      align: 'left',
      customRender: (value, row) => {
        if (row.isNewRow) {
          return (
            <textarea
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter new observation..."
              style={{
                width: 'calc(100% - 12px)',
                minHeight: '60px',
                padding: '6px',
                border: 'none',
                resize: 'vertical',
                fontSize: '14px',
                backgroundColor: '#f8f9fa',
                boxSizing: 'border-box'
              }}
            />
          );
        }
        return value;
      }
    }
  ];

  // Custom Table component that handles the special new row rendering
  const NotesTable = () => {
    if (!cowTag) {
      return (
        <Table
          data={[]}
          columns={notesColumns}
          emptyMessage="Select a cow to view and edit observations"
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
        />
      );
    }

    if (tableData.length === 0) {
      return (
        <Table
          data={[]}
          columns={notesColumns}
          emptyMessage="No observations recorded yet"
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
        />
      );
    }

    return (
      <div style={{ marginTop: '10px' }}>
        <Table
          data={tableData}
          columns={notesColumns}
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
          // Custom row styling for new row
          customRowStyle={(row, index) => ({
            backgroundColor: row.isNewRow ? '#f8f9fa' : (index % 2 === 0 ? '#fff' : '#f9f9f9'),
            fontStyle: row.isNewRow ? 'italic' : 'normal',
            color: row.isNewRow ? '#666' : 'inherit'
          })}
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Recent Observations:</h3>
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

      <NotesTable />

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