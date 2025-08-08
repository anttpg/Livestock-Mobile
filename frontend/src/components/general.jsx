import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';
import Notes from './notes';
import Minimap from './minimap';
import MultiCowTable from './multiCowTable';
import PhotoViewer from './photoViewer';

function General() {
  const [cowTag, setCowTag] = useState('');
  const [cowData, setCowData] = useState(null);
  const [allHerds, setAllHerds] = useState([]);
  const [currentUser, setCurrentUser] = useState('');

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

  // MODIFIED: Check for search parameter in URL when component mounts, or use default cow
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    
    if (searchParam) {
      // If there's a search parameter, use it
      handleSearch(searchParam);
    } else if (enableDefaultCow) {
      // If no search parameter but default cow is enabled, navigate to default cow
      handleSearch(defaultCowTag);
    }
  }, [enableDefaultCow, defaultCowTag]); // Added dependencies

  const handleSearch = async (searchTag) => {
    // Don't search if searchTag is empty, null, or undefined
    if (!searchTag || searchTag.trim() === '') {
      return;
    }
    
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
      console.log('Received cow data:', data); // Debug log
      
      if (data.cowData && data.cowData.length > 0) {
        setCowData(data);
        // Set available herds if included in response
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
    if (cowTag) {
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
    // Use the search bar's navigation function
    const searchBarElement = document.getElementById('search-bar');
    if (searchBarElement && searchBarElement.navigate) {
      searchBarElement.navigate(calfData.CalfTag);
    } else {
      // Fallback to direct search
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1>Cow Data</h1>

      <div id="search-container">
        <SearchBar onSearch={handleSearch} value={cowTag} />
      </div>

      {/* SECTION 1: Images and Basic Info */}
      <div className="bubble-container" style={{display: 'flex', minHeight: '420px'}}>
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
              onChange={(e) => handleHerdChange(e.target.value)}
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
        <h3 style = {{ margin: '0px', paddingBottom: '10px'}}>Calves:</h3>
        <MultiCowTable
          data={cowData?.calves || []}
          columns={calfColumns}
          onViewClick={handleCalfView}
          title="Current Calves"
          emptyMessage="No calves on record for selected cow"
        />
      </div>
    </div>
  );
}

export default General;