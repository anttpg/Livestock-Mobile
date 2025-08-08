import React from 'react';
import Table from './table';

function MultiCowTable({ 
  data = [], 
  columns = [], 
  onViewClick, 
  title = "Animals",
  emptyMessage = "No animals found"
}) {

  // Navigation function that always goes to /general?search=COWTAG
  const navigateToCow = (row) => {
    const cowTag = row.CowTag || row.CalfTag; // Handle both CowTag and CalfTag
    if (cowTag) {
      window.location.href = `/general?search=${encodeURIComponent(cowTag)}`;
    }
  };

  // Enhance columns to add clickable functionality for CowTag and CalfTag
  const enhancedColumns = columns.map(column => ({
    ...column,
    clickable: column.key === 'CowTag' || column.key === 'CalfTag',
    onClick: (column.key === 'CowTag' || column.key === 'CalfTag') ? navigateToCow : undefined
  }));

  return (
    <Table style={{ width: '100%', borderCollapse: 'collapse'}}
      data={data}
      columns={enhancedColumns}
      title={title}
      emptyMessage={emptyMessage}
      onActionClick={navigateToCow}
      actionButtonText="VIEW"
      actionButtonColor="#28a745"
      showActionColumn={true}
      maxRows={10} // Reasonable default for cow tables
      maxHeight="400px"
      margin='0px' 
    />
  );
}

export default MultiCowTable;