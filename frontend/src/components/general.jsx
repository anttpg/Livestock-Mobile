import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';
import Notes from './notes';
import Minimap from './minimap';
import MultiCowTable from './multiCowTable';
import PhotoViewer from './photoViewer';
import HerdSplitter from './herdSplitter';

function General({
  cowTag: propCowTag,
  cowData: propCowData,
  allCows: propAllCows,
  currentUser: propCurrentUser,
  onRefresh: propOnRefresh,
  hideSearchBar = false,
  onNavigate,
  // ... existing props
}) {

  const [cowTag, setCowTag] = useState(propCowTag || '');
  const [cowData, setCowData] = useState(propCowData || null);
  const [allCows, setAllCows] = useState(propAllCows || []);
  const [currentUser, setCurrentUser] = useState(propCurrentUser || '');
  const [allHerds, setAllHerds] = useState([]);
  const [showHerdSplitter, setShowHerdSplitter] = useState(false);

  // TOGGLE: Set this to true to enable default cow navigation, false to disable
  const enableDefaultCow = true;
  const defaultCowTag = '46';

  const formatDate = (dateString) => {
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

    if (data.cowData && data.cowData.length > 0) {
      setCowData(data);
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
        handleSearch(cowTag);
      } else {
        const errorData = await response.json();
        alert(`Failed to update herd: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating herd:', error);
      alert('Error updating herd');
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

  const cow = cowData?.cowData?.[0];
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
          maxWidth: '400px', // Prevent images from getting too large
          aspectRatio: '1 / 1', // Square container when at minimum width
          width: '100%'
        }}>
          <PhotoViewer
            cowTag={cowTag}
            imageType="headshot"
            style={{
              flex: 1,
              borderRadius: '5px',
              minHeight: '0', // Allow flex shrinking
              width: '100%'
            }}
          />
          <PhotoViewer
            cowTag={cowTag}
            imageType="body"
            style={{
              flex: 1,
              borderRadius: '5px',
              minHeight: '0', // Allow flex shrinking
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

            {/* Current Herd with dropdown */}
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

            <h3>Date of Birth:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow ? formatDate(cow.DateOfBirth) : 'YYYY-MM-DD'}
            </span>

            <h3>Last Weight:</h3>
            <span style={{ marginLeft: '10px', fontStyle: (currentWeight || cow?.CurrentWeight) ? 'normal' : 'italic' }}>
              {currentWeight ?
                `${currentWeight.Weight} lbs (${formatDate(currentWeight.WeightDate)})` :
                cow?.CurrentWeight ?
                  `${cow.CurrentWeight} lbs` :
                  'No weight recorded'
              }
            </span>

            <h3>Temperament:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow?.Temperament || 'Not recorded'}
            </span>

            <h3>Other Descriptors:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow?.Description || 'No description available'}
            </span>
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
                handleRefresh(); // Refresh to show updated herd
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default General;