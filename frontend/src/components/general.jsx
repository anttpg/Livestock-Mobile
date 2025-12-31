import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';
import Notes from './notes';
import Minimap from './minimap';
import MultiCowTable from './multiCowTable';
import PhotoViewer from './photoViewer';
import HerdSplitter from './herdSplitter';
import Popup from './popup';
import PopupConfirm from './popupConfirm';

function General({
  cowTag: propCowTag,
  cowData: propCowData,
  allCows: propAllCows,
  currentUser: propCurrentUser,
  onRefresh: propOnRefresh,
  hideSearchBar = false,
  onNavigate,
}) {

  const [cowTag, setCowTag] = useState(propCowTag || '');
  const [cowData, setCowData] = useState(propCowData || null);
  const [statuses, setStatuses] = useState([]);
  const [allCows, setAllCows] = useState(propAllCows || []);
  const [currentUser, setCurrentUser] = useState(propCurrentUser || '');
  const [allHerds, setAllHerds] = useState([]);
  const [showHerdSplitter, setShowHerdSplitter] = useState(false);
  const [temperaments, setTemperaments] = useState([]);
  const [showDeathPopup, setShowDeathPopup] = useState(false);
  const [deathData, setDeathData] = useState({ dateOfDeath: '', causeOfDeath: '' });
  const [showNewTemperamentPopup, setShowNewTemperamentPopup] = useState(false);
  const [newTemperament, setNewTemperament] = useState('');
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [editableDescription, setEditableDescription] = useState('');

  // TOGGLE: Set this to true to enable default cow navigation, false to disable
  const enableDefaultCow = true;
  const defaultCowTag = '46';

  const formatDate = (dateString) => {
    if (!dateString) return 'Not recorded';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Get current user when component mounts
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/check-auth', {
          credentials: 'include'
        });
        if (response.ok) {
          const authData = await response.json();
          if (authData.authenticated && authData.user) {
            setCurrentUser(authData.user.username || authData.user.name || 'Current User');
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch temperaments
  useEffect(() => {
    const fetchTemperaments = async () => {
      try {
        const response = await fetch('/api/form-dropdown-data', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setTemperaments(data.temperaments || []);
          setStatuses(data.statuses || [])
        }
      } catch (error) {
        console.error('Error fetching temperaments:', error);
      }
    };
    fetchTemperaments();
  }, []);

  // NEW: Fetch all cows for autocomplete
  useEffect(() => {
    const fetchAllCows = async () => {
      try {
        const response = await fetch('/api/cows/by-herd', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setAllCows(data.cows || []);
        }
      } catch (error) {
        console.error('Error fetching all cows:', error);
      }
    };
    fetchAllCows();
  }, []);

  // Sync allHerds from propCowData
  useEffect(() => {
    if (propCowData?.availableHerds) {
      setAllHerds(propCowData.availableHerds);
    }
  }, [propCowData]);

  // Debug logging
  useEffect(() => {
    if (cowData && cowTag) {
      console.log(`=== Data for cow ${cowTag} ===`);
      console.log('Full cowData:', cowData);
      console.log('Extracted cow:', cowData?.cowData);
      console.log('CurrentHerd:', cowData?.cowData?.CurrentHerd);
      console.log('Available herds:', allHerds);
    }
  }, [cowTag, cowData]);

  useEffect(() => {
    // Don't auto-fetch if we're being controlled by parent (folder system)
    if (propCowTag && propCowData) {
      return; // Skip auto-fetching when props are provided
    }

    // Don't auto-fetch if we have onNavigate prop (means we're controlled by animalFolder)
    if (onNavigate) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');

    if (searchParam) {
      handleSearch(searchParam);
    } else if (enableDefaultCow) {
      handleSearch(defaultCowTag);
    }
  }, [enableDefaultCow, defaultCowTag, propCowTag, propCowData, onNavigate]);

  useEffect(() => {
    if (propCowTag) {
      setCowTag(propCowTag);
    }
  }, [propCowTag]);
  
  useEffect(() => {
    if (propCowData) {
      setCowData(propCowData);
      setEditableDescription(propCowData?.cowData?.Description || '');
    }
  }, [propCowData]);

  const handleSearch = async (searchTag) => {
    // If we have onNavigate prop (controlled by animalFolder), use it
    if (onNavigate) {
      onNavigate(searchTag);
      return;
    }

    // Don't search if searchTag is empty, null, or undefined
    if (!searchTag || searchTag.trim() === '') {
      return;
    }

    // If we're being controlled by props AND this is a user-initiated search, delegate to parent
    if (propCowTag && propOnRefresh && searchTag !== propCowTag) {
      propOnRefresh();
      return;
    }

    // If we have props but the search tag matches what parent already has, just update local state
    if (propCowTag && propCowData && searchTag === propCowTag) {
      setCowTag(propCowTag);
      setCowData(propCowData);
      return;
    }

    // Only do actual fetching if we're in standalone mode (no props and no onNavigate)
    if (propCowTag || propCowData || onNavigate) {
      return; // Let parent handle all data fetching
    }

    // Original standalone fetching logic
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

      if (data.cowData) {
        setCowData(data);
        setEditableDescription(data.cowData?.Description || '');
        if (data.availableHerds) {
          setAllHerds(data.availableHerds);
        }
      } else {
        alert(`Cow ${searchTag} not found`);
        setCowData(null);
      }
    } catch (error) {
      console.error('Error fetching cow data:', error);
      alert('Error fetching cow data');
      setCowData(null);
    }
  };

  // Function to refresh cow data after adding observation
  const handleRefresh = () => {
    if (propOnRefresh) {
      propOnRefresh();
    } else if (cowTag) {
      handleSearch(cowTag);
    }
  };

  const handleHerdChange = async (newHerd) => {
    try {
      const response = await fetch('/api/set-herd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cowTag: cowTag,
          herdName: newHerd
        })
      });

      if (response.ok) {
        // Refresh cow data to show updated herd
        handleRefresh();
      } else {
        const errorData = await response.json();
        alert(`Failed to update herd: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating herd:', error);
      alert('Error updating herd');
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Dead') {
      setShowDeathPopup(true);
    } else if (newStatus === 'Sold') {
      alert('Selling functionality is not completed yet');
    } else {
      // For other statuses, update directly
      await updateCowData({ Status: newStatus });
    }
  };

  const handleDeathSubmit = async () => {
    if (!deathData.dateOfDeath || !deathData.causeOfDeath) {
      alert('Please provide both date of death and cause of death');
      return;
    }

    await updateCowData({
      Status: 'Dead',
      DateOfDeath: deathData.dateOfDeath,
      CauseOfDeath: deathData.causeOfDeath
    });

    setShowDeathPopup(false);
    setDeathData({ dateOfDeath: '', causeOfDeath: '' });
  };

  const handleTemperamentChange = async (newTemperament) => {
    if (newTemperament === '+ New Temperament') {
      setShowNewTemperamentPopup(true);
    } else {
      await updateCowData({ Temperament: newTemperament });
    }
  };

  const handleNewTemperamentSubmit = () => {
    if (!newTemperament.trim()) {
      alert('Please enter a temperament name');
      return;
    }
    setPendingUpdate({ type: 'newTemperament', value: newTemperament });
    setShowConfirmPopup(true);
  };

  const handleConfirmNewTemperament = async () => {
    try {
      // Add new temperament to dropdown
      const response = await fetch('/api/form-dropdown-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'Temperament',
          value: newTemperament
        })
      });

      if (response.ok) {
        // Refresh temperaments list
        const tempResponse = await fetch('/api/form-dropdown-data', {
          credentials: 'include'
        });
        if (tempResponse.ok) {
          const data = await tempResponse.json();
          setTemperaments(data.temperaments || []);
        }

        // Update cow with new temperament
        await updateCowData({ Temperament: newTemperament });

        setShowNewTemperamentPopup(false);
        setNewTemperament('');
      } else {
        alert('Failed to add new temperament');
      }
    } catch (error) {
      console.error('Error adding temperament:', error);
      alert('Error adding temperament');
    }
    setShowConfirmPopup(false);
    setPendingUpdate(null);
  };

  const handleDescriptionChange = async () => {
    if (editableDescription !== cow?.Description) {
      await updateCowData({ Description: editableDescription });
    }
  };

  const updateCowData = async (updates) => {
    try {
      const response = await fetch(`/api/cow/${cowTag}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        handleRefresh();
      } else {
        const errorData = await response.json();
        alert(`Failed to update: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating cow data:', error);
      alert('Error updating cow data');
    }
  };

  const handleCalfView = (calfData) => {
    if (!calfData?.CalfTag) return;
    
    // Use onNavigate if available (when controlled by animalFolder)
    if (onNavigate) {
      onNavigate(calfData.CalfTag);
    } else {
      // Fallback to handleSearch for standalone mode
      handleSearch(calfData.CalfTag);
    }
  };

  // Check if we should show back navigation
  const previousCow = sessionStorage.getItem('previousCow');

  const cow = cowData?.cowData; // FIXED: No longer using [0]
  const images = cowData?.images;
  const minimap = cowData?.minimap;
  const currentWeight = cowData?.currentWeight;

  // Define columns for the calf table
  const calfColumns = [
    {
      key: 'CalfTag',
      header: 'Calf Tag',
      width: '120px',
      type: 'text'
    },
    {
      key: 'DOB',
      header: 'DOB',
      type: 'date'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: -1 }}>
      {!hideSearchBar && <h1 style={{ marginTop: '0px' }}>Animal Records</h1>}

      {!hideSearchBar && (
        <div id="search-container">
          <SearchBar
            onSearch={handleSearch}
            value={cowTag}
            cowOptions={allCows}
          />
        </div>
      )}

      {/* Images and Basic Info */}
      <div className="bubble-container" style={{ display: 'flex', minHeight: '420px' }}>
        {/* Left side - Photo Viewers (responsive sizing) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flex: 1,
          minWidth: '200px',
          maxWidth: '400px',
          aspectRatio: '1 / 1',
          width: '100%'
        }}>
          <PhotoViewer
            cowTag={cowTag}
            imageType="headshot"
            style={{
              flex: 1,
              borderRadius: '5px',
              minHeight: '0',
              width: '100%'
            }}
          />
          <PhotoViewer
            cowTag={cowTag}
            imageType="body"
            style={{
              flex: 1,
              borderRadius: '5px',
              minHeight: '0',
              width: '100%'
            }}
          />
        </div>

        {/* Right side - Minimap and Info (fixed width) */}
        <div style={{
          width: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          flexShrink: 0
        }}>
          {/* Minimap Component */}
          <div style={{
            width: '200px',
            height: '200px',
            borderRadius: '5px',
            overflow: 'hidden'
          }}>
            <Minimap
              cowTag={cowTag}
              pastureName={cow?.PastureName}
              minimapSrc={minimap?.path}
            />
          </div>

          {/* Basic Info */}
          <div>
            {/* Location Information */}
            {cow?.PastureName && (
              <>
                <h3>Current Location:</h3>
                <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
                  {cow.PastureName}
                </span>
                <br /><br />
              </>
            )}

            {/* Current Herd with dropdown - Only show if animal is active */}
            {cow?.IsActive && (
              <>
                <h3>Current Herd:</h3>
                <select
                  value={cow?.CurrentHerd || ''}
                  onChange={(e) => {
                    if (e.target.value === '+ New Herd') {
                      setShowHerdSplitter(true);
                    } else {
                      handleHerdChange(e.target.value);
                    }
                  }}
                  style={{
                    marginLeft: '10px',
                    padding: '2px 5px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '3px'
                  }}
                >
                  <option value="">Select Herd</option>
                  {allHerds.map((herd, index) => (
                    <option key={index} value={herd}>
                      {herd}
                    </option>
                  ))}
                  <option value="+ New Herd">+ New Herd</option>
                </select>
                <br /><br />
              </>
            )}

            {/* Status selector */}
            <h3>Status:</h3>
            <select
              value={cow?.Status || ''}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                marginLeft: '10px',
                padding: '2px 5px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              <option value="">Select Status</option>
              {statuses.map((status, index) => (  // REPLACE THE HARDCODED OPTIONS
                <option key={index} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <br /><br />

            <h3>Date of Birth:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow?.DateOfBirth ? formatDate(cow.DateOfBirth) : 'Not recorded'}
            </span>
            <br /><br />

            <h3>Last Weight:</h3>
            <span style={{ marginLeft: '10px', fontStyle: currentWeight ? 'normal' : 'italic' }}>
              {currentWeight ?
                `${currentWeight.weight} lbs (${formatDate(currentWeight.date)})` :
                'No weight recorded'
              }
            </span>
            <br /><br />

            <h3>Temperament:</h3>
            <select
              value={cow?.Temperament || ''}
              onChange={(e) => handleTemperamentChange(e.target.value)}
              style={{
                marginLeft: '10px',
                padding: '2px 5px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              <option value="">Select Temperament</option>
              {temperaments.map((temp, index) => (
                <option key={index} value={temp}>
                  {temp}
                </option>
              ))}
              <option value="+ New Temperament">+ New Temperament</option>
            </select>
            <br /><br />

            <h3>Description:</h3>
            <textarea
              value={editableDescription}
              onChange={(e) => setEditableDescription(e.target.value)}
              onBlur={handleDescriptionChange}
              placeholder="Enter description..."
              style={{
                marginLeft: '10px',
                width: 'calc(100% - 20px)',
                minHeight: '60px',
                padding: '5px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Notes */}
      <div className="bubble-container">
        <Notes
          cowTag={cowTag}
          cowData={cowData}
          onRefresh={handleRefresh}
          currentUser={currentUser}
        />
      </div>

      {/* SECTION 3: Current Calves - Using MultiCowTable */}
      <div className="bubble-container">
        <h3 style={{ margin: '0px', paddingBottom: '10px' }}>Calves:</h3>
        <MultiCowTable
          data={cowData?.calves || []}
          columns={calfColumns}
          onViewClick={handleCalfView}
          title="Current Calves"
          emptyMessage="No calves on record for selected cow"
        />
      </div>

      {/* HerdSplitter Modal */}
      {showHerdSplitter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90vw',
            height: '90vh',
            maxWidth: '1200px'
          }}>
            <HerdSplitter
              isOpen={showHerdSplitter}
              onClose={() => setShowHerdSplitter(false)}
              onSave={() => {
                setShowHerdSplitter(false);
                handleRefresh();
              }}
            />
          </div>
        </div>
      )}

      {/* Death Popup */}
      <Popup
        isOpen={showDeathPopup}
        onClose={() => setShowDeathPopup(false)}
        title="Record Death"
        width="500px"
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Date of Death:
            </label>
            <input
              type="date"
              value={deathData.dateOfDeath}
              onChange={(e) => setDeathData({ ...deathData, dateOfDeath: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Cause of Death:
            </label>
            <textarea
              value={deathData.causeOfDeath}
              onChange={(e) => setDeathData({ ...deathData, causeOfDeath: e.target.value })}
              placeholder="Enter cause of death..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowDeathPopup(false)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeathSubmit}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#d32f2f',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </Popup>

      {/* New Temperament Popup */}
      <Popup
        isOpen={showNewTemperamentPopup}
        onClose={() => {
          setShowNewTemperamentPopup(false);
          setNewTemperament('');
        }}
        title="Add New Temperament"
        width="400px"
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Temperament Name:
            </label>
            <input
              type="text"
              value={newTemperament}
              onChange={(e) => setNewTemperament(e.target.value)}
              placeholder="Enter temperament name..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowNewTemperamentPopup(false);
                setNewTemperament('');
              }}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleNewTemperamentSubmit}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#4CAF50',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </Popup>

      {/* Confirmation Popup */}
      <PopupConfirm
        isOpen={showConfirmPopup}
        onClose={() => {
          setShowConfirmPopup(false);
          setPendingUpdate(null);
        }}
        onConfirm={handleConfirmNewTemperament}
        title="Confirm New Temperament"
        message={`Are you sure you want to add "${pendingUpdate?.value}" as a new temperament option?`}
        confirmText="Add Temperament"
        cancelText="Cancel"
      />
    </div>
  );
}

export default General;