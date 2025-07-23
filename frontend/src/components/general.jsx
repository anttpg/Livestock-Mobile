import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './searchBar';
import Notes from './notes';
import Minimap from './minimap'; // Assuming this component exists

function General() {
  const [cowTag, setCowTag] = useState('');
  const [cowData, setCowData] = useState(null);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleSearch = async (searchTag) => {
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
      } else {
        alert(`Cow ${searchTag} not found`);
      }
    } catch (error) {
      console.error('Error fetching cow data:', error);
      alert('Error fetching cow data');
    }
  };

  const handleCalfView = (calfTag) => {
    // Store current cow for back navigation
    sessionStorage.setItem('previousCow', cowTag);
    handleSearch(calfTag);
  };

  // Check if we should show back navigation
  const previousCow = sessionStorage.getItem('previousCow');

  const cow = cowData?.cowData?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1>Cow Data</h1>

      <div id="search-container">
        <SearchBar onSearch={handleSearch} />
        {previousCow && (
          <button 
            onClick={() => handleSearch(previousCow)}
            style={{ marginLeft: '10px', padding: '5px 10px' }}
          >
            ← Back to {previousCow}
          </button>
        )}
      </div>

      {/* SECTION 1: Images and Basic Info */}
      <div style={{ 
        display: 'flex', 
        gap: '20px',
        border: '1px solid #ccc',
        padding: '15px',
        borderRadius: '5px',
        minHeight: '420px'
      }}>
        {/* Left side - Images (expand with page growth) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          flex: 1,
          minWidth: '200px',
          aspectRatio: '2 / 3', // Maintain square per image (2 images stacked = 1:2 ratio)
          maxWidth: '100%'
        }}>
          <div style={{ 
            flex: 1,
            overflow: 'hidden',
            borderRadius: '5px',
            position: 'relative',
            width: '100%'
          }}>
            <img 
              src={cow?.HeadshotPath || '/images/cow-headshot.jpg'} 
              alt="cow headshot"
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                minWidth: '100%',
                minHeight: '100%'
              }}
            />
          </div>
          <div style={{ 
            flex: 1,
            overflow: 'hidden',
            borderRadius: '5px',
            position: 'relative',
            width: '100%'
          }}>
            <img 
              src={cow?.BodyPath || '/images/example-cow.jpg'} 
              alt="cow body"
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                minWidth: '100%',
                minHeight: '100%'
              }}
            />
          </div>
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
            borderRadius: '5px' 
          }}>
            <Minimap cowTag={cowTag} />
          </div>
          
          {/* Basic Info */}
          <div>
            <h3>Date of Birth:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow ? formatDate(cow.DateOfBirth) : 'YYYY-MM-DD'}
            </span>
            
            <h3>Last Weight:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow ? cow.CurrentWeight : 'Weight of Cow.'}
            </span>
            
            <h3>Temperament:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow ? cow.Temperament : 'Temperament of cow'}
            </span>
            
            <h3>Other Descriptors:</h3>
            <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
              {cow ? cow.Description : 'Description of Cow\'s attributes.'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Notes */}
      <div style={{ 
        border: '1px solid #ccc',
        padding: '15px',
        borderRadius: '5px'
      }}>
        <Notes cowTag={cowTag} cowData={cowData} />
      </div>

      {/* SECTION 3: Current Calves */}
      <div style={{ 
        border: '1px solid #ccc',
        padding: '15px',
        borderRadius: '5px'
      }}>
        <h3>Current Calves:</h3>
        <div style={{ marginTop: '10px' }}>
          {cowData?.calves && cowData.calves.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '2px double black', padding: '8px' }}>Calf Tag</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>DOB</th>
                  <th style={{ border: '2px double black', padding: '8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cowData.calves.map((calf, index) => (
                  <tr key={index}>
                    <td style={{ border: '2px double black', padding: '8px' }}>{calf.CalfTag}</td>
                    <td style={{ border: '2px double black', padding: '8px' }}>{formatDate(calf.DOB)}</td>
                    <td style={{ border: '2px double black', padding: '8px' }}>
                      <button 
                        onClick={() => handleCalfView(calf.CalfTag)}
                        style={{ 
                          padding: '5px 15px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))}
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
              No calves on record or no cow selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default General;