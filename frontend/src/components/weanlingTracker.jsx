import React, { useState } from 'react';
import Form from './forms';
import WeighIn from './weighIn';
import Popup from './popup';
import '../screenSizing.css';

function WeanlingTracker({ breedingPlanId, breedingYear }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showWeighIn, setShowWeighIn] = useState(false);

  const handlePerformWeighIn = () => {
    setShowWeighIn(true);
  };

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
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handlePerformWeighIn}
          className="button"
          style={{
            padding: '8px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            fontSize: '14px'
          }}
        >
          Perform Weigh-in
        </button>
      </div>

      <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
        Showing calves born in current and previous year
      </div>
    </div>
  );

  return (
    <>
      <Form
                title="Weanling Tracker"
                headerContent={headerContent}
                sheetName="Weanlings"
                showImportButton={true}
                editLive={false}
                selectableRows={true}
                breedingPlanId={breedingPlanId}
                breedingYear={breedingYear}
        />

      {/* Weigh-in Popup */}
      <Popup
        isOpen={showWeighIn}
        onClose={() => setShowWeighIn(false)}
        title="Weigh Selected Animals"
        maxWidth="90vw"
        maxHeight="90vh"
      >
        <WeighIn
          onClose={() => setShowWeighIn(false)}
        />
      </Popup>
    </>
  );
}

export default WeanlingTracker;