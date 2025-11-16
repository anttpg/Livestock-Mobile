import React, { useState } from 'react';
import Form from './forms';
import '../cow-data.css';

function WeighIn({ onClose }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const headerContent = (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold' }}>Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontSize: '16px'
          }}
        />
      </div>
      
      {onClose && (
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={onClose}
            className="button"
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Form
        title="Weight Check"
        headerContent={headerContent}
        sheetName="WeightCheck"
        showImportButton={true}
        // Remove onTagClick prop - let Sheet use its default centralized behavior
      />

      {/* Animal Details Popup removed - centralized in Sheet.jsx */}
    </>
  );
}

export default WeighIn;