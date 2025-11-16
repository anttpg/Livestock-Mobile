import React from 'react';
import Sheet from './sheet';
import '../cow-data.css';

function Form({ 
  title,
  headerContent = null,
  bodyContent = null,
  sheetId = null,
  sheetName = null,
  showImportButton = false,
  onTagClick = null,
  customData = null,
  customColumns = null,
  editLive = true,
  selectableRows = false,
  showActionColumn = false,
  onActionClick = null,
  breedingYear = null,
  breedingPlanId = null,
  actionButtonText = "VIEW",
  actionButtonColor = "#28a745",
  children
}) {
  
  // Header component to be passed to Sheet
  const headerComponent = (
    <div className="form-header">
      <div className="form-title-container">
        <h2 className="form-title">{title}</h2>
      </div>
      {headerContent && (
        <div className="form-header-content">
          {headerContent}
        </div>
      )}
    </div>
  );

  // Body component to be passed to Sheet
  const bodyComponent = bodyContent ? (
    <div className="form-body-content">
      {bodyContent}
    </div>
  ) : null;

  // If using custom data instead of sheet
  if (customData && customColumns) {
    return (
      <div className="bubble-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {headerComponent}
        {bodyComponent}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div>Custom table with provided data and columns</div>
        </div>
        {children}
      </div>
    );
  }

  // Use Sheet component for data display
  if (sheetId || sheetName) {
    return (
      <div className="bubble-container" style={{ height: '100%', padding: '1px' }}>
        <Sheet
          sheetId={sheetId}
          sheetName={sheetName}
          bodyComponent={
            <div>
              {headerComponent}
              {bodyComponent}
            </div>
          }
          showImportButton={showImportButton}
          onTagClick={onTagClick}
          editLive={editLive}
          selectableRows={selectableRows}
          showActionColumn={showActionColumn}
          onActionClick={onActionClick}
          actionButtonText={actionButtonText}
          actionButtonColor={actionButtonColor}
          breedingPlanId={breedingPlanId}    // Pass through breeding context
          breedingYear={breedingYear}
        />
        {children}
      </div>
    );
  }

  // Fallback for forms without sheet integration
  return (
    <div className="bubble-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {headerComponent}
      {bodyComponent}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export default Form;