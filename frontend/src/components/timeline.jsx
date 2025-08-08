import React from 'react';

function Timeline({ 
  data = [], 
  maxEvents = 5, 
  onSeeAll = null,
  title = "Timeline"
}) {
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Limit data to maxEvents, but keep track if there are more
  const displayData = data.slice(0, maxEvents);
  const hasMoreItems = data.length > maxEvents;

  return (
    <div style={{ width: '100%' }}>
      {displayData.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayData.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < displayData.length - 1 || hasMoreItems ? '1px solid #eee' : 'none',
                fontSize: '14px'
              }}
            >
              {/* Date */}
              <div style={{
                width: '100px',
                fontWeight: 'bold',
                color: '#666',
                flexShrink: 0
              }}>
                {formatDate(item.date)}
              </div>
              
              {/* Item Name/Description */}
              <div style={{
                flex: 1,
                paddingLeft: '15px',
                color: '#333'
              }}>
                {item.name || item.description || item.itemName}
              </div>
            </div>
          ))}
          
          {/* See All Button */}
          {hasMoreItems && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '10px'
            }}>
              <button
                onClick={onSeeAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                See all
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic'
        }}>
          No events to display
        </div>
      )}
    </div>
  );
}

export default Timeline;