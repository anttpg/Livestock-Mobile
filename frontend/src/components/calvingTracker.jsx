import React, { useState } from 'react';
import Form from './forms';
import AddAnimal from './addAnimal';
import Popup from './popup';
import AnimalFolder from './animalFolder';
import '../screenSizing.css';

function CalvingTracker({ breedingPlanId, breedingYear }) {
  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [showAnimalPopup, setShowAnimalPopup] = useState(false);
  const [selectedMother, setSelectedMother] = useState(null);
  const [selectedFather, setSelectedFather] = useState(null);

  const handleAddCalf = (mother, father) => {
    setSelectedMother(mother);
    setSelectedFather(father);
    setShowAddAnimal(true);
  };

  const handleViewAnimal = (animalTag) => {
    setShowAnimalPopup(true);
  };

  const handleAddAnimalClose = () => {
    setShowAddAnimal(false);
    setSelectedMother(null);
    setSelectedFather(null);
  };

  const refresh = () => {
    handleAddAnimalClose();
    window.location.reload();
  }

  const handleCloseAnimalPopup = () => {
    setShowAnimalPopup(false);
  };

  // This function determines what happens when action button is clicked
  const handleActionClick = (row, rowIndex) => {
    const cowTag = row.CowTag;
    const calfTag = row.CalfTag || row.calf_tag; // Check both possible field names
    const bull = row.bull || row.primary_bull || '';

    if (calfTag && calfTag.trim() !== '') {
      // Cow has a calf - open animal records
      handleViewAnimal(calfTag);
    } else {
      // Cow has no calf - open add animal form
      handleAddCalf(cowTag, bull);
    }
  };

  // This function determines the action button text
  const getActionButtonText = (row) => {
    const calfTag = row.CalfTag || row.calf_tag;
    
    if (calfTag && calfTag.trim() !== '') {
      return `View ${calfTag}`;
    } else {
      return '+ Add Calf';
    }
  };

  // This function determines the action button color
  const getActionButtonColor = (row) => {
    const calfTag = row.CalfTag || row.calf_tag;
    
    if (calfTag && calfTag.trim() !== '') {
      return '#3bb558'; // Green for existing calves
    } else {
      return '#007bff'; // Default blue for add calf
    }
  };

    const headerContent = (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                Showing cows with breeding records for {breedingYear || 'current year'}
            </div>
            <div style={{ fontSize: '14px', color: '#28a745', fontWeight: 'bold' }}>
                Click "Add Calf" to register newborns or "View" to see existing calves
            </div>
        </div>
    );

    return (
        <>
            <Form
                title="Calving Tracker"
                headerContent={headerContent}
                sheetName="CalvingTracker"
                showImportButton={true}
                editLive={true}
                selectableRows={false}
                showActionColumn={true}
                onActionClick={handleActionClick}
                actionButtonText={getActionButtonText}
                actionButtonColor={getActionButtonColor}
                breedingPlanId={breedingPlanId}
                breedingYear={breedingYear}
            />

      {/* Add Animal Popup */}
      <Popup
        isOpen={showAddAnimal}
        onClose={handleAddAnimalClose}
        title="Add Calf"
        maxWidth="800px"
        maxHeight="100vh"
      >
        <AddAnimal
          motherTag={selectedMother}
          fatherTag={selectedFather}
          showTwinsOption={true}
          onClose={handleAddAnimalClose}
          onSuccess={refresh}
          createCalvingRecord={true}
          breedingYear={breedingYear}
        />
      </Popup>

      {/* Animal Details Popup */}
      <Popup
        isOpen={showAnimalPopup}
        onClose={handleCloseAnimalPopup}
        title={`Animal Details - TODO FIX`}
        fullscreen={true}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <AnimalFolder
            enableDefaultSearch={true}
            hideSearchBar={false}
          />
        </div>
      </Popup>
    </>
  );
}

export default CalvingTracker;