import React, { useState, useEffect } from 'react';
import Popup from './popup';

function Minimap({ pastureName, minimapSrc }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMapPopup, setShowMapPopup] = useState(false);
  const [preloadedMapData, setPreloadedMapData] = useState(null);

  // Preload full map data in background when pasture is available
  useEffect(() => {
    if (pastureName) {
      const preloadMapData = async () => {
        try {
          const response = await fetch(`/api/map?pasture=${encodeURIComponent(pastureName)}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            setPreloadedMapData(data);
          }
        } catch (error) {
          console.error('Error preloading map data:', error);
        }
      };

      preloadMapData();
    }
  }, [pastureName]);

  const handleMinimapClick = () => {
    setShowMapPopup(true);
  };

  // Determine minimap source with fallback logic
  const getMinimapSrc = () => {
    if (minimapSrc) return minimapSrc;
    if (pastureName) return `/api/minimap/${encodeURIComponent(pastureName)}`;
    return '/images/NoMinimap.png';
  };

  return (
    <>
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          cursor: 'pointer',
          filter: isHovered ? 'brightness(0.9)' : 'brightness(1)',
          transition: 'filter 0.2s ease'
        }}
        onClick={handleMinimapClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img 
          src={getMinimapSrc()}
          alt={pastureName ? `${pastureName} minimap` : 'No minimap available'}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            e.target.src = '/images/NoMinimap.png';
          }}
        />

        {/* Expand icon - always visible in bottom right */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '50%',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
        }}>
          <span 
            className="material-symbols-outlined" 
            style={{ 
              color: 'white', 
              fontSize: '18px' 
            }}
          >
            expand_content
          </span>
        </div>
      </div>

      {/* Map Popup */}
      <Popup
        isOpen={showMapPopup}
        onClose={() => setShowMapPopup(false)}
        title="Click the map to toggle Field outlines"
        width="800px"
        height="600px"
        maxWidth="95vw"
        maxHeight="95vh"
      >
        <MapViewer 
          pastureName={pastureName} 
          preloadedData={preloadedMapData}
        />
      </Popup>
    </>
  );
}

// MapViewer component for the popup content
function MapViewer({ pastureName, preloadedData }) {
  const [showFields, setShowFields] = useState(true);
  const [mapData, setMapData] = useState(preloadedData);
  const [loading, setLoading] = useState(!preloadedData);
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  useEffect(() => {
    // If we don't have preloaded data, fetch it now
    if (!preloadedData) {
      const fetchMapData = async () => {
        try {
          const response = await fetch(`/api/map?pasture=${encodeURIComponent(pastureName || '')}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            setMapData(data);
          }
        } catch (error) {
          console.error('Error fetching map data:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchMapData();
    } else {
      setMapData(preloadedData);
      setLoading(false);
    }
  }, [pastureName, preloadedData]);

  const handleMapClick = () => {
    setShowFields(!showFields);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        Loading map...
      </div>
    );
  }

  if (!mapData || !mapData.success) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        Map not available
      </div>
    );
  }

  // Get the appropriate map URL based on toggle state
  const mapType = showFields ? 'map' : 'MapCombined';
  const mapUrl = `/api/map?image=${mapType}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px' }}>
      {/* Map Image */}
      <img
        src={mapUrl}
        alt="Farm Map"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          cursor: 'pointer',
          borderRadius: '5px'
        }}
        onClick={handleMapClick}
      />

      {/* Pin showing cow location */}
      {mapData.coordinates && (
        <div
          style={{
            position: 'absolute',
            left: `${(mapData.coordinates.x+0.007) * 100}%`,
            top: `${(mapData.coordinates.y-0.07) * 100 }%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            fontSize: '64px',
            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
          }}
        >
          📍 
        </div>
      )}

      {/* Upload Button */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        right: '70px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '50%',
        padding: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onClick={(e) => {
        e.stopPropagation();
        setShowUploadPopup(true);
      }}
      >
        <span 
          className="material-symbols-outlined" 
          style={{ 
            fontSize: '28px',
            color: '#2196F3'
          }}
        >
          upload
        </span>
      </div>

      {/* Toggle Button */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        right: '15px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '50%',
        padding: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onClick={handleMapClick}
      >
        <span 
          className="material-symbols-outlined" 
          style={{ 
            fontSize: '28px',
            color: showFields ? '#4CAF50' : '#666',
            transition: 'color 0.3s ease'
          }}
        >
          {showFields ? 'toggle_on' : 'toggle_off'}
        </span>
      </div>

      {/* Current pasture label if available */}
      {pastureName && (
        <div style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          📍 {pastureName}
        </div>
      )}

      {/* Upload Popup */}
      <Popup
        isOpen={showUploadPopup}
        onClose={() => setShowUploadPopup(false)}
        title="Upload Map"
        width="500px"
        height="auto"
      >
        <UploadMapForm onClose={() => setShowUploadPopup(false)} />
      </Popup>
    </div>
  );
}

// Upload form component
function UploadMapForm({ onClose }) {
  const [mapType, setMapType] = useState('map');
  const [minimapName, setMinimapName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setMessage('Please select an image file');
      return;
    }

    if (mapType === 'minimap' && !minimapName.trim()) {
      setMessage('Please enter a minimap name');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      let endpoint;
      if (mapType === 'minimap') {
        endpoint = `/api/minimap/${encodeURIComponent(minimapName.trim())}`;
      } else {
        formData.append('mapType', mapType);
        endpoint = '/api/map';
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage('Upload successful!');
        setTimeout(() => {
          onClose();
          window.location.reload(); // Refresh to show new map
        }, 1500);
      } else {
        setMessage(result.message || 'Upload failed');
      }
    } catch (error) {
      setMessage('Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Map Type:
        </label>
        <select
          value={mapType}
          onChange={(e) => setMapType(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        >
          <option value="map">Map (with fields)</option>
          <option value="MapCombined">MapCombined (without fields)</option>
          <option value="minimap">Minimap (field-specific)</option>
        </select>
      </div>

      {mapType === 'minimap' && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Minimap Name:
          </label>
          <input
            type="text"
            value={minimapName}
            onChange={(e) => setMinimapName(e.target.value)}
            placeholder="Enter field/pasture name"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Select Image:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{
            width: '100%',
            padding: '8px'
          }}
        />
        {selectedFile && (
          <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
            Selected: {selectedFile.name}
          </div>
        )}
      </div>

      {message && (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: message.includes('success') ? '#d4edda' : '#f8d7da',
          color: message.includes('success') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('success') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={uploading}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: uploading ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}

export default Minimap;