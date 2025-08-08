import React, { useState, useEffect } from 'react';
import Sheet from './sheet';
import Popup from './popup';

function Fieldsheets() {
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch all sheets when component mounts
  useEffect(() => {
    fetchAllSheets();
  }, []);

  const fetchAllSheets = async () => {
    console.log(`Attempting to fetch sheets`);
    try {
      const response = await fetch('/api/sheets/all-sheets', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Fix: Map database structure to frontend expectations
        const mappedSheets = (data.sheets || []).map(sheet => ({
          id: sheet.ID,           // Map ID to id
          name: sheet.SheetName   // Map SheetName to name
        }));

        console.log(`Successfully fetched ${data.sheets.length} sheets`);
        setSheets(mappedSheets);
        
        // Select first sheet by default
        if (mappedSheets.length > 0) {
          setSelectedSheet(mappedSheets[0]);
          
        }
      } else {
        console.error('Failed to fetch sheets');
        setSheets([]);
      }
    } catch (error) {
      console.error('Error fetching sheets:', error);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelect = (sheet) => {
    setSelectedSheet(sheet);
  };

  const handleCreateNew = () => {
    setEditingSheet(null);
    setShowEditor(true);
  };

  const handleEdit = () => {
    if (selectedSheet) {
      setEditingSheet(selectedSheet);
      setShowEditor(true);
    }
  };

  const handleDelete = () => {
    if (selectedSheet) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = async () => {
    if (selectedSheet) {
      try {
        const response = await fetch(`/api/sheets/delete/${selectedSheet.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          await fetchAllSheets();
          setShowDeleteConfirm(false);
        } else {
          alert('Failed to delete sheet');
        }
      } catch (error) {
        console.error('Error deleting sheet:', error);
        alert('Error deleting sheet');
      }
    }
    setShowDeleteConfirm(false);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingSheet(null);
    // Refresh sheets and current selection
    fetchAllSheets();
  };

  const handleImport = () => {
    // TODO: Implement import functionality
    alert('Import functionality not yet implemented');
  };

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
        Loading sheets...
      </div>
    );
  }

  return (
  <div className="multibubble-page" style={{ height: '100vh' }}>
    <h1>Field Sheets</h1>

    {/* Split div 50/50 */}
    <div className="multibubble-row" style={{ minHeight: '200px' }}>
        {/* Left side - Sheet list */}
        <div className="bubble-container" style={{flex: 1}}>
          <h3 style={{ margin: '0 0 15px 0' }}>Available Sheets</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                onClick={() => handleSheetSelect(sheet)}
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  backgroundColor: selectedSheet?.id === sheet.id ? '#e3f2fd' : '#f9f9f9',
                  borderColor: selectedSheet?.id === sheet.id ? '#2196f3' : '#ddd',
                  transition: 'all 0.2s ease'
                }}
              >
                {sheet.name}
              </div>
            ))}
            <div
              onClick={handleCreateNew}
              style={{
                padding: '10px',
                border: '2px dashed #007bff',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: '#f8f9fa',
                color: '#007bff',
                textAlign: 'center',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
            >
              + Create New Sheet
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="bubble-container" style={{flex: 1}}>
          <h3 style={{ margin: '0 0 15px 0' }}>Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleImport}
              style={{
                padding: '12px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Import
            </button>
            
            <button
              onClick={handleEdit}
              disabled={!selectedSheet}
              style={{
                padding: '12px 20px',
                backgroundColor: selectedSheet ? '#ffc107' : '#6c757d',
                color: selectedSheet ? 'black' : 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: selectedSheet ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: selectedSheet ? 1 : 0.6
              }}
            >
              Edit
            </button>
            
            <button
              onClick={handleDelete}
              disabled={!selectedSheet}
              style={{
                padding: '12px 20px',
                backgroundColor: selectedSheet ? '#dc3545' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: selectedSheet ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: selectedSheet ? 1 : 0.6
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Display/Edit block */}
      <div className="bubble-container" style={{flex: 1, overflow: 'hidden', padding: '0px'}}>
        {selectedSheet ? (
          <Sheet 
            key={selectedSheet.id} 
            sheetId={selectedSheet.id} 
            sheetName={selectedSheet.name} 
          />
        ) : (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#666',
            fontSize: '18px'
          }}>
            Select a sheet to view
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      <Popup
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Deletion"
        width="400px"
        height="200px"
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '20px' }}>
            Are you sure you want to delete "{selectedSheet?.name}"?
          </p>
          <p style={{ marginBottom: '30px', color: '#dc3545', fontWeight: 'bold' }}>
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Popup>

      {/* Sheet Editor Popup */}
      {showEditor && (
        <Sheet 
          sheetId={editingSheet?.id || null}
          sheetName={editingSheet?.name || ''}
          isEditor={true}
          onEditorClose={handleEditorClose}
        />
      )}
    </div>
  );
}

export default Fieldsheets;