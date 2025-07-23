import React from 'react';

function Minimap({ cowTag }) {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderRadius: '3px'
    }}>
      {cowTag ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
            Farm Map
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Cow {cowTag} Location
          </div>
          {/* Placeholder for map visualization */}
          <div style={{
            width: '100px',
            height: '60px',
            backgroundColor: '#4CAF50',
            margin: '10px auto',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px'
          }}>
            📍 {cowTag}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '14px' }}>Minimap</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            Select a cow to view location
          </div>
        </div>
      )}
    </div>
  );
}

export default Minimap;