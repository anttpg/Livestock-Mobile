import React, { useState, useEffect } from 'react';
import SheetTemplate from './sheetTemplate';
import SheetTemplateEditor from './sheetTemplateEditor';
import Popup from './popup';
import PopupConfirm from './popupConfirm';


function FieldsheetTemplates({ filterSheets = null }) {
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
    try {
      const response = await fetch('/api/sheets/all-sheets', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        let allSheets = (data.sheets || []).map(sheet => ({
          id: sheet.ID,
          name: sheet.SheetName,
          locked: sheet.Locked || false,
          parentSheet: sheet.ParentSheet || null
        }));

        // Apply filtering if filterSheets is provided
        if (filterSheets) {
          const filteredIds = new Set();
          
          // Add all sheets in filterSheets
          filterSheets.forEach(sheetName => {
            const sheet = allSheets.find(s => s.name === sheetName);
            if (sheet) {
              filteredIds.add(sheet.id);
              
              // If it's a child, add parent and siblings
              if (sheet.parentSheet) {
                const parent = allSheets.find(s => s.id === sheet.parentSheet);
                if (parent) {
                  filteredIds.add(parent.id);
                  // Add siblings
                  allSheets.filter(s => s.parentSheet === sheet.parentSheet)
                    .forEach(sibling => filteredIds.add(sibling.id));
                }
              }
              
              // Add children
              allSheets.filter(s => s.parentSheet === sheet.id)
                .forEach(child => filteredIds.add(child.id));
            }
          });
          
          allSheets = allSheets.filter(sheet => filteredIds.has(sheet.id));
        }

        // Sort and organize sheets: locked first, then unlocked, with children indented
        const organizedSheets = organizeSheets(allSheets);
        setSheets(organizedSheets);
        
        // Select first sheet by default
        if (organizedSheets.length > 0) {
          setSelectedSheet(organizedSheets[0]);
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

  const organizeSheets = (sheets) => {
    const parentSheets = sheets.filter(s => !s.parentSheet);
    const childSheets = sheets.filter(s => s.parentSheet);
    
    // Sort parents: locked first, then unlocked
    parentSheets.sort((a, b) => {
      if (a.locked !== b.locked) return b.locked - a.locked; // locked first
      return a.name.localeCompare(b.name);
    });
    
    const organized = [];
    
    parentSheets.forEach(parent => {
      organized.push({ ...parent, indent: 0 });
      
      // Add children immediately after parent
      const children = childSheets
        .filter(child => child.parentSheet === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      children.forEach(child => {
        organized.push({ ...child, indent: 1 });
      });
    });
    
    return organized;
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
    if (selectedSheet && !selectedSheet.locked) {
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
    fetchAllSheets();
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
    <div className="multibubble-page" style={{ padding: '0px' }}>
      {/* Split div 50/50 */}
      <div className="multibubble-row" style={{ minHeight: '200px' }}>
        {/* Left side - Sheet list */}
        <div className="bubble-container" style={{flex: 1}}>
          <h3 style={{ margin: '0 0 15px 0' }}>Existing Templates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                onClick={() => handleSheetSelect(sheet)}
                style={{
                  padding: '10px',
                  paddingLeft: `${10 + (sheet.indent * 20)}px`,
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  backgroundColor: selectedSheet?.id === sheet.id ? '#e3f2fd' : '#f9f9f9',
                  borderColor: selectedSheet?.id === sheet.id ? '#2196f3' : '#ddd',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {sheet.locked && (
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#666' }}>
                    lock
                  </span>
                )}
                {sheet.name}
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="bubble-container" style={{flex: 1}}>
          <h3 style={{ margin: '0 0 15px 0' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              + Create New Template
            </div>



            
            <button
              onClick={handleEdit}
              disabled={!selectedSheet}
              className="button"
              style={{
                padding: '12px 20px',
                backgroundColor: selectedSheet ? '#ffc107' : '#6c757d',
                color: selectedSheet ? 'black' : 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: selectedSheet ? 1 : 0.6,
                cursor: selectedSheet ? 'pointer' : 'not-allowed'
              }}
            >
              Edit
            </button>
            
            <button
              onClick={handleDelete}
              disabled={!selectedSheet || selectedSheet?.locked}
              className="button"
              style={{
                padding: '12px 20px',
                backgroundColor: (selectedSheet && !selectedSheet.locked) ? '#dc3545' : '#6c757d',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: (selectedSheet && !selectedSheet.locked) ? 1 : 0.6,
                cursor: (selectedSheet && !selectedSheet.locked) ? 'pointer' : 'not-allowed'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Display/Edit block */}
      <div className="bubble-container" style={{flex: 1, overflow: 'hidden', padding: '0px'}}>
        <h3 style={{ margin: '15px 0px 0px 15px' }}>Template Example</h3>
        {selectedSheet ? (
          <SheetTemplate key={selectedSheet.id} sheetId={selectedSheet.id} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666', fontSize: '18px' }}>
            Select a sheet to view
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      <PopupConfirm
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete "${selectedSheet?.name}"?<br/><br/><span style="color:#dc3545;font-weight:bold">This action cannot be undone.</span>`}
        confirmText="Delete"
        cancelText="Cancel"
      />


      {/* Sheet Editor Popup */}
      {showEditor && (
        <SheetTemplateEditor
          isOpen={true}
          sheetId={editingSheet?.id || null}
          sheetName={editingSheet?.name || ''}
          locked={editingSheet?.locked || false}
          onClose={handleEditorClose}
      />
      )}
    </div>
  );
}

export default FieldsheetTemplates;