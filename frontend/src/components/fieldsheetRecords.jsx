import React, { useState, useEffect } from 'react';
import Sheet from './sheet';
import ConfirmPopup from './popupConfirm';
import SheetInstanceCreator from './sheetInstanceCreator';

function FieldsheetRecords() {
  const [instances, setInstances] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [filterSheet, setFilterSheet] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  // New instance creation state
  const [newInstanceSheet, setNewInstanceSheet] = useState(null);
  const [newInstanceHerd, setNewInstanceHerd] = useState('');
  const [newInstanceYear, setNewInstanceYear] = useState(new Date().getFullYear());
  const [herds, setHerds] = useState([]);



  // Fetch sheets and instances when component mounts
  useEffect(() => {
    fetchSheets();
    fetchInstances();
    fetchHerds();
  }, []);

  const fetchSheets = async () => {
    try {
      const response = await fetch('/api/sheets/all-sheets', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const sheetList = (data.sheets || []).map(sheet => ({
          id: sheet.ID,
          name: sheet.SheetName
        }));
        setSheets(sheetList);
      }
    } catch (error) {
      console.error('Error fetching sheets:', error);
    }
  };

  const fetchHerds = async () => {
    try {
      const response = await fetch('/api/herds', { credentials: 'include' });

      if (response.ok) {
        const herdsData = await response.json();
        setHerds((herdsData.herds || []).map(h => h.herdName));
      } else {
        console.error('Failed to fetch herds');
      }
    } catch (error) {
      console.error('Error fetching herds:', error);
    }
  };

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sheets/instances/all', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setInstances(data.instances || []);
      } else {
        console.error('Failed to fetch instances');
        setInstances([]);
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceSelect = (instance) => {
    setSelectedInstance(instance);
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  const handleCreateInstance = async () => {
    if (!newInstanceSheet || !newInstanceHerd || !newInstanceYear) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${newInstanceSheet}/instances/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          herdName: newInstanceHerd,
          breedingYear: newInstanceYear
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateDialog(false);
        setNewInstanceSheet(null);
        setNewInstanceHerd('');
        setNewInstanceYear(new Date().getFullYear());
        await fetchInstances();

        // Select the newly created instance
        const newInstance = instances.find(i => i.id === data.id);
        if (newInstance) {
          setSelectedInstance(newInstance);
        }
      } else {
        alert('Failed to create instance');
      }
    } catch (error) {
      console.error('Error creating instance:', error);
      alert('Error creating instance');
    }
  };

  const handleDelete = () => {
    if (selectedInstance) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = async () => {
    if (selectedInstance) {
      try {
        const response = await fetch(`/api/sheets/instances/${selectedInstance.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          setSelectedInstance(null);
          await fetchInstances();
          setShowDeleteConfirm(false);
        } else {
          alert('Failed to delete instance');
        }
      } catch (error) {
        console.error('Error deleting instance:', error);
        alert('Error deleting instance');
      }
    }
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const filteredInstances = filterSheet === 'all'
    ? instances
    : instances.filter(i => i.templateId === parseInt(filterSheet));

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
        Loading instances...
      </div>
    );
  }

  return (
    <div className="multibubble-page" style={{ padding: '0px' }}>
      {/* Split div 50/50 */}
      <div className="multibubble-row" style={{ minHeight: '200px' }}>
        {/* Left side - Instance list */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Saved Records</h3>

          {/* Filter dropdown */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by Sheet:</label>
            <select
              value={filterSheet}
              onChange={(e) => setFilterSheet(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '3px',
                border: '1px solid #ddd'
              }}
            >
              <option value="all">All Sheets</option>
              {sheets.map(sheet => (
                <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {filteredInstances.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No records found
              </div>
            ) : (
              filteredInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => handleInstanceSelect(instance)}
                  style={{
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    backgroundColor: selectedInstance?.id === instance.id ? '#e3f2fd' : '#f9f9f9',
                    borderColor: selectedInstance?.id === instance.id ? '#2196f3' : '#ddd',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{instance.instanceName}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {instance.breedingYear}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    Created: {formatDate(instance.dateCreated)} by {instance.createdBy}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="bubble-container" style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              key="create-new"
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
              + Create New Instance
            </div>

            <button
              onClick={handleDelete}
              disabled={!selectedInstance}
              className="button"
              style={{
                padding: '12px 20px',
                backgroundColor: selectedInstance ? '#dc3545' : '#6c757d',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: selectedInstance ? 1 : 0.6,
                cursor: selectedInstance ? 'pointer' : 'not-allowed'
              }}
            >
              Delete Record
            </button>
          </div>

          {selectedInstance && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '3px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Record Details</h4>
              <div style={{ fontSize: '14px' }}>
                <div><strong>Sheet:</strong> {selectedInstance.templateName}</div>
                <div><strong>Herd:</strong> {selectedInstance.herdName}</div>
                <div><strong>Year:</strong> {selectedInstance.breedingYear}</div>
                <div><strong>Created:</strong> {formatDate(selectedInstance.dateCreated)}</div>
                <div><strong>By:</strong> {selectedInstance.createdBy}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Display/Edit block */}
      <div className="bubble-container" style={{ flex: 1, overflow: 'hidden', padding: '0px' }}>
        {selectedInstance ? (
          <Sheet
            key={selectedInstance.id}
            instanceId={selectedInstance.id}
          />
        ) : (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#666',
            fontSize: '18px',
            minHeight: '150px'
          }}>
            Select a record to view
          </div>
        )}
      </div>

      {/* Create Instance Dialog */}
      <SheetInstanceCreator
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={async (data) => {
          await fetchInstances();
          // data.instanceId comes back from the create endpoint
          const fresh = instances.find(i => i.id === data.instanceId);
          if (fresh) setSelectedInstance(fresh);
        }}
      />

      {/* Delete Confirmation Popup */}
      <ConfirmPopup
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message='Are you sure you want to delete this record?<br/><br/><span style="color:#dc3545;font-weight:bold">This action cannot be undone.</span>'
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default FieldsheetRecords;