import React, { useState, useEffect } from 'react';
import Popup from './popup';
import AutoCombobox from './autoCombobox';

// SheetEditor Component
function SheetEditor({ isOpen, onClose, sheetId, sheetName: initialSheetName }) {
  const [sheetName, setSheetName] = useState(initialSheetName || '');
  const [dataColumns, setDataColumns] = useState([]);
  const [fillableColumns, setFillableColumns] = useState([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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
    setLoading(true);
    try {
      const endpoint = sheetId ? `/api/sheets/update/${sheetId}` : '/api/sheets/create';
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
            padding: '10px'
          }}
        >
          {/* Top row: drag handle and delete button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <img 
              src="/images/movable.png" 
              alt="Move" 
              style={{ width: '16px', height: '16px', cursor: 'grab' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
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

          {/* Responsive input layout */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            {/* Name input */}
            <div style={{ 
              flex: '1 1 200px', // Grow, shrink, basis 200px
              minWidth: '100px'   // Reduced from 120px to 80px
            }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                color: '#555'
              }}>
                Column Name
              </label>
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
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                color: '#555'
              }}>
                Data Path
              </label>
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
          </div>
        </div>
      ))}
      
      <button
        onClick={listType === 'data' ? addDataColumn : addFillableColumn}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
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
        title={sheetId ? 'Edit Sheet' : 'Create New Sheet'}
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
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !sheetName.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (loading || !sheetName.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !sheetName.trim()) ? 0.6 : 1
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Popup>

      {/* Discard Changes Confirmation */}
      <Popup
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Changes"
        width="400px"
        height="200px"
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '20px' }}>
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '0px' }}>
            <button
              onClick={() => setShowDiscardConfirm(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Keep Editing
            </button>
            <button
              onClick={confirmDiscard}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Discard Changes
            </button>
          </div>
        </div>
      </Popup>
    </>
  );
}

export default SheetEditor;

