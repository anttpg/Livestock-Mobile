import React from 'react';
import Table from './table';

function MultiAnimalTable({
  cattle = [],
  goats = [],
  cattleColumns = null,
  goatColumns = null,
  title = "Animals",
  emptyMessage = "No animals found"
}) {

  const navigateTo = (tag) => {
    if (tag) window.location.href = `/animal?tab=general&search=${encodeURIComponent(tag)}`;
  };

  const defaultCattleColumns = [
    { key: 'CowTag',       header: 'Tag',  width: '120px', type: 'text', clickable: true, onClick: (row) => navigateTo(row.CowTag) },
    { key: 'DateOfBirth',  header: 'DOB',  type: 'date' },
  ];

  const defaultGoatColumns = [
    { key: 'GoatTag',      header: 'Tag',  width: '120px', type: 'text', clickable: true, onClick: (row) => navigateTo(row.GoatTag) },
    { key: 'DateOfBirth',  header: 'DOB',  type: 'date' },
  ];

  const resolvedCattleColumns  = cattleColumns  || defaultCattleColumns;
  const resolvedGoatColumns = goatColumns || defaultGoatColumns;

  const hasCattle  = cattle.length  > 0;
  const hasGoats = goats.length > 0;

  if (!hasCattle && !hasGoats) {
    return (
      <div style={{
        padding: '20px', textAlign: 'center',
        fontStyle: 'italic', color: '#666',
        border: '2px dashed #ccc', borderRadius: '5px'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {hasCattle && (
        <div style={{ marginBottom: hasGoats ? '24px' : '0' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
            Cattle ({cattle.length})
          </h4>
          <Table
            data={cattle}
            columns={resolvedCattleColumns}
            emptyMessage="No cattle in this herd"
            onActionClick={(row) => navigateTo(row.CowTag)}
            actionButtonText="VIEW"
            actionButtonColor="#28a745"
            showActionColumn={true}
          />
        </div>
      )}

      {hasGoats && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
            Goats ({goats.length})
          </h4>
          <Table
            data={goats}
            columns={resolvedGoatColumns}
            emptyMessage="No goats in this herd"
            onActionClick={(row) => navigateTo(row.GoatTag)}
            actionButtonText="VIEW"
            actionButtonColor="#28a745"
            showActionColumn={true}
          />
        </div>
      )}
    </div>
  );
}

export default MultiAnimalTable;