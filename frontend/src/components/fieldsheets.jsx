import React, { useState, useEffect } from 'react';
import Folder from './folder';
import FieldsheetTemplates from './fieldsheetTemplates';
import FieldsheetRecords from './fieldsheetRecords';

function Fieldsheets({ sheets: filterSheets = null }) {
  const [loading, setLoading] = useState(false);

  // Define tabs configuration
  const tabs = [
    { id: 'templates', label: 'Templates' },
    { id: 'records', label: 'All Records' }
  ];

  // No search needed for this folder
  const searchConfig = {
    enabled: false
  };

  // No data fetching needed - each tab manages its own data
  const handleDataFetch = async (searchTerm, tab) => {
    return null;
  };

  // Function to render tab content
  const renderTab = (tabConfig, data, searchTerm, helpers) => {
    if (!tabConfig) return null;

    switch (tabConfig.id) {
      case 'templates':
        return (
          <FieldsheetTemplates
            filterSheets={filterSheets}
            hideSearchBar={helpers.hideSearchBar}
          />
        );
      case 'records':
        return (
          <FieldsheetRecords
            hideSearchBar={helpers.hideSearchBar}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Folder
      title="Field Sheets"
      tabs={tabs}
      searchConfig={searchConfig}
      defaultTab="templates"
      enableDefaultSearch={false}
      onDataFetch={handleDataFetch}
      renderTab={renderTab}
    />
  );
}

export default Fieldsheets;