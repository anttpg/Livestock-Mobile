import React, { useState, useEffect } from 'react';
import Popup from './popup';
import AutoCombobox from './autoCombobox';
import ConfirmPopup from './confirmPopup';
import '../cow-data.css';

// SheetEditor Component
function SheetEditor({ isOpen, onClose, sheetId, sheetName: initialSheetName, locked = false }) {
  const [sheetName, setSheetName] = useState(initialSheetName || '');
  const [dataColumns, setDataColumns] = useState([]);
  const [fillableColumns, setFillableColumns] = useState([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveAsDerivative, setShowSaveAsDerivative] = useState(false);
  const [derivativeName, setDerivativeName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);

  // Initialize columns and fetch available columns
  useEffect(() => {
    if (isOpen) {
      fetchAvailableColumns();
      if (sheetId) {
        // Load existing sheet
        loadExistingSheet();
      } else {
        // New sheet - start with default CowTag column
        setDataColumns([{
          id: Date.now(),
          name: 'CowTag',
          dataPath: 'CowTable/CowTag'
        }]);
        setFillableColumns([]);
      }
      setHasChanges(false);
    }
  }, [isOpen, sheetId]);

  // Initialize derivative name when showing save as derivative popup
  useEffect(() => {
    if (showSaveAsDerivative) {
      setDerivativeName('');
    }
  }, [showSaveAsDerivative]);

  const fetchAvailableColumns = async () => {
    try {
      const response = await fetch('/api/sheets/available-columns', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableColumns(data.columns || []);
      } else {
        console.error('Failed to fetch available columns');
        setAvailableColumns([]);
      }
    } catch (error) {
      console.error('Error fetching available columns:', error);
      setAvailableColumns([]);
    }
  };

  const loadExistingSheet = async () => {
    try {
      const response = await fetch(`/api/sheets/structure/${sheetId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDataColumns(data.dataColumns || []);
        setFillableColumns(data.fillableColumns || []);
      }
    } catch (error) {
      console.error('Error loading sheet structure:', error);
    }
  };

  const handleDragStart = (e, index, listType) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, listType }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex, dropListType) => {
    e.preventDefault();
    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
    
    if (dragData.listType !== dropListType) return;

    const sourceList = dragData.listType === 'data' ? dataColumns : fillableColumns;
    const setSourceList = dragData.listType === 'data' ? setDataColumns : setFillableColumns;
    
    const newList = [...sourceList];
    const [draggedItem] = newList.splice(dragData.index, 1);
    newList.splice(dropIndex, 0, draggedItem);
    
    setSourceList(newList);
    setHasChanges(true);
  };

  const addDataColumn = () => {
    setDataColumns([...dataColumns, {
      id: Date.now(),
      name: 'New Column',
      dataPath: ''
    }]);
    setHasChanges(true);
  };

  const addFillableColumn = () => {
    setFillableColumns([...fillableColumns, {
      id: Date.now(),
      name: 'New Fillable Column',
      dataPath: ''
    }]);
    setHasChanges(true);
  };

  const deleteColumn = (index, listType) => {
    if (listType === 'data') {
      const newColumns = dataColumns.filter((_, i) => i !== index);
      setDataColumns(newColumns);
    } else {
      const newColumns = fillableColumns.filter((_, i) => i !== index);
      setFillableColumns(newColumns);
    }
    setHasChanges(true);
  };

  const updateColumn = (index, listType, field, value) => {
    if (listType === 'data') {
      const newColumns = [...dataColumns];
      newColumns[index][field] = value;
      setDataColumns(newColumns);
    } else {
      const newColumns = [...fillableColumns];
      newColumns[index][field] = value;
      setFillableColumns(newColumns);
    }
    setHasChanges(true);
  };

  const handleColumnSelect = (index, listType, selectedColumn) => {
    updateColumn(index, listType, 'name', selectedColumn.name);
    updateColumn(index, listType, 'dataPath', selectedColumn.path);
  };

  const handleSave = async () => {
    // If trying to save a locked sheet, ask user to save as derivative
    if (locked && sheetId) {
      setShowSaveAsDerivative(true);
      return;
    }

    setLoading(true);
    try {
      const endpoint = sheetId ? `/api/sheets/update-structure/${sheetId}` : '/api/sheets/create';
      const method = sheetId ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: sheetName,
          dataColumns: dataColumns,
          fillableColumns: fillableColumns
        })
      });

      if (response.ok) {
        setHasChanges(false);
        onClose();
      } else {
        alert('Failed to save sheet');
      }
    } catch (error) {
      console.error('Error saving sheet:', error);
      alert('Error saving sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsDerivative = async () => {
    if (!derivativeName.trim()) {
      alert('Please enter a name for the derivative sheet');
      return;
    }

    const fullDerivativeName = `${initialSheetName}/${derivativeName.trim()}`;

    setLoading(true);
    try {
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: fullDerivativeName,
          dataColumns: dataColumns,
          fillableColumns: fillableColumns,
          parentSheetId: sheetId
        })
      });

      if (response.ok) {
        setHasChanges(false);
        setShowSaveAsDerivative(false);
        alert(`Successfully created derivative sheet: ${fullDerivativeName}`);
        onClose();
      } else {
        alert('Failed to create derivative sheet');
      }
    } catch (error) {
      console.error('Error creating derivative sheet:', error);
      alert('Error creating derivative sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const confirmDiscard = () => {
    setShowDiscardConfirm(false);
    setHasChanges(false);
    onClose();
  };

  // Convert available columns to AutoCombobox format
  const getComboboxOptions = () => {
    return availableColumns.map(col => ({
      name: col.name,
      value: col.path
    }));
  };

  const renderColumnList = (columns, listType, title) => (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '5px',
      padding: '15px',
      backgroundColor: '#f9f9f9',
      minWidth: 0 // Allow shrinking
    }}>
      <h4 style={{ margin: '0 0 15px 0' }}>{title}</h4>
      
      {/* Locked Sheet Warning */}
      {locked && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '3px',
          padding: '8px',
          marginBottom: '15px',
          fontSize: '12px',
          color: '#856404'
        }}>
          <strong>Locked Sheet:</strong> Changes will be saved as a new derivative sheet.
        </div>
      )}
      
      {/* Path Validation Warning */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '3px',
        padding: '8px',
        marginBottom: '15px',
        fontSize: '12px',
        color: '#856404'
      }}>
        <strong>Note:</strong> Data paths are not currently validated. Future implementation will enforce proper record structure.
      </div>
      
      {columns.map((column, index) => (
        <div
          key={column.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index, listType)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index, listType)}
          style={{
            border: '1px solid #ccc',
            borderRadius: '3px',
            backgroundColor: 'white',
            marginBottom: '10px',
            cursor: 'move',
            padding: '7px',
            transition: 'all 0.3s ease',
            transform: 'translateY(0)'
          }}
        >
          {/* Row container div */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px'
          }}>

            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', cursor: 'grab', color: '#666' }}
            >
              drag_indicator
            </span>
            
            {/* Name input */}
            <div style={{ 
              flex: '1 1 200px', // Grow, shrink, basis 200px
              minWidth: '100px'   // Reduced from 120px to 80px
            }}> 
              <AutoCombobox
                options={getComboboxOptions()}
                value={column.name}
                onChange={(value) => {
                  const selectedColumn = availableColumns.find(col => col.path === value || col.name === value);
                  if (selectedColumn) {
                    handleColumnSelect(index, listType, selectedColumn);
                  } else {
                    updateColumn(index, listType, 'name', value);
                  }
                }}
                placeholder="Column Name"
                required={true}
                style={{ width: '100%' }}
              />
            </div>
          
            {/* Data path input */}
            <div style={{ 
              flex: '1 1 200px', // Grow, shrink, basis 200px
              minWidth: '100px'   // Reduced from 120px to 80px
            }}>
              <AutoCombobox
                options={getComboboxOptions()}
                value={column.dataPath}
                onChange={(value) => {
                  updateColumn(index, listType, 'dataPath', value);
                  const selectedColumn = availableColumns.find(col => col.path === value);
                  if (selectedColumn) {
                    updateColumn(index, listType, 'name', selectedColumn.name);
                  }
                }}
                placeholder="Data Path"
                required={true}
                style={{ width: '100%' }}
              />
            </div>

            <img 
              src="/images/delete.png" 
              alt="Delete" 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              onClick={() => deleteColumn(index, listType)}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      ))}
      
      <button
        onClick={listType === 'data' ? addDataColumn : addFillableColumn}
        className="button"
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          marginTop: '10px'
        }}
      >
        Add New {listType === 'data' ? 'Data' : 'Fillable'} Column
      </button>
    </div>
  );

  return (
    <>
      <Popup
        isOpen={isOpen}
        onClose={handleCancel}
        title={sheetId ? (locked ? `View Locked Sheet: ${initialSheetName}` : 'Edit Sheet') : 'Create New Sheet'}
        maxHeight="90vh"
        maxWidth="1500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sheet Name */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Sheet Name
            </label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => {
                setSheetName(e.target.value);
                setHasChanges(true);
              }}
              disabled={!!sheetId}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: sheetId ? '#f5f5f5' : 'white',
                cursor: sheetId ? 'not-allowed' : 'text'
              }}
            />
          </div>

          {/* Column Lists - Fixed responsive layout with proper wrapping */}
          <div style={{ 
            display: 'flex',
            flexWrap: 'wrap', // Allow wrapping to new line
            gap: '20px',
            minHeight: '300px'
          }}>
            <div style={{ 
              flex: '1 1 400px', // Grow, shrink, basis 400px (will wrap when less than 400px available)
              minWidth: '100px'    // Minimum before wrapping
            }}>
              {renderColumnList(dataColumns, 'data', 'Data Columns')}
            </div>
            <div style={{ 
              flex: '1 1 400px', // Grow, shrink, basis 400px
              minWidth: '250px'    // Minimum before wrapping
            }}>
              {renderColumnList(fillableColumns, 'fillable', 'Fillable Columns')}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="button"
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !sheetName.trim()}
              className="button"
              style={{
                padding: '10px 20px',
                opacity: (loading || !sheetName.trim()) ? 0.6 : 1,
                cursor: (loading || !sheetName.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Saving...' : (locked ? 'Save as Derivative' : 'Save')}
            </button>
          </div>
        </div>
      </Popup>

      {/* Save as Derivative Popup */}
      <Popup
        isOpen={showSaveAsDerivative}
        onClose={() => setShowSaveAsDerivative(false)}
        title="Save as Derivative Sheet"
        width="500px"
        height="300px"
      >
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
            This is a locked template sheet. Your changes will be saved as a new derivative sheet that you can modify freely.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Derivative Sheet Name:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#666', fontSize: '16px' }}>
                {initialSheetName}/
              </span>
              <input
                type="text"
                value={derivativeName}
                onChange={(e) => setDerivativeName(e.target.value)}
                placeholder="Enter name for your version"
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  fontSize: '16px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAsDerivative();
                  }
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowSaveAsDerivative(false)}
              disabled={loading}
              className="button"
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAsDerivative}
              disabled={loading || !derivativeName.trim()}
              className="button"
              style={{
                padding: '10px 20px',
                opacity: (loading || !derivativeName.trim()) ? 0.6 : 1,
                cursor: (loading || !derivativeName.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Derivative'}
            </button>
          </div>
        </div>
      </Popup>

      {/* Discard Changes Confirmation */}
      <ConfirmPopup
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={confirmDiscard}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        requireDelay={false}
        confirmText="Discard Changes"
        cancelText="Keep Editing"
      />
    </>
  );
}

export default SheetEditor;