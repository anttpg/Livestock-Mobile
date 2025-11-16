
import React from 'react';
import Timeline from './timeline';
import Table from './table';

function Overview() {
    // Hardcoded data for recent events

    const recentEvents = [
        { date: '2025-07-31', name: 'Fly spray Herd 3' },
        { date: '2025-07-29', name: 'Put Kenny on Herd 2' },
        { date: '2025-07-16', name: 'Split Herd 2' },
        { date: '2025-07-15', name: 'Moved Herd 1 to North Pasture' },
        { date: '2025-07-14', name: 'Vaccinated calves in Herd 2' }
      ];
    
      // Hardcoded attention items
      const attentionItems = [
        { item: 'Fence down', location: 'South Pasture', date: '07/31/2025', reporter: 'Anthony' },
        { item: 'Fence down', location: 'North Pasture', date: '07/31/2025', reporter: 'Anthony' },
        { item: 'Water trough overflowing', location: 'North Pasture 3', date: '07/29/2025', reporter: 'Robert' },
        { item: 'Chicken coop needs remesh', location: '4 acre nursery', date: '07/11/2025', reporter: 'Anthony' }
      ];
  
      // Define columns for the attention items table
      const attentionColumns = [
        {
          key: 'item',
          header: 'Item',
          type: 'text',
          align: 'left'
        },
        {
          key: 'location',
          header: 'Location',
          type: 'text',
          align: 'left'
        },
        {
          key: 'date',
          header: 'Date',
          type: 'text', // Keep as text since your dates are already formatted
          align: 'left'
        },
        {
          key: 'reporter',
          header: 'Reporter',
          type: 'text',
          align: 'left'
        }
      ];
    
      const handleSeeAllEvents = () => {
        alert('Navigate to full events page');
      };
    
      const handleAttentionItemClick = (item) => {
        alert(`View details for: ${item.item} at ${item.location}`);
      };
  
    return (
      <div className="multibubble-column">
        {/* Page Title */}
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 20px 0' }}>
          Overview
        </h1>
  
        {/* Panel 1: 2025 Breeding Plan */}
        <div className="bubble-container">
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 15px 0' }}>
            2025 breeding plan
          </h2>
          <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '5px' }}>25 cows</div>
            <div style={{ marginBottom: '5px' }}>15 cows open</div>
            <div style={{ marginBottom: '5px' }}>10 pregnant, 5 in need of preg check</div>
            <div>6 calves</div>
          </div>
        </div>
  
        {/* Panel 2: Recent Events */}
        <div className="bubble-container">
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 15px 0' }}>
            Recent events
          </h2>
          <Timeline 
            data={recentEvents} 
            maxEvents={3} 
            onSeeAll={handleSeeAllEvents}
          />
        </div>
  
        {/* Panel 3: Items Requiring Attention */}
        <Table
          data={attentionItems}
          columns={attentionColumns}
          title={`${attentionItems.length} items require attention`}
          emptyMessage="No items requiring attention"
          onActionClick={handleAttentionItemClick}
          actionButtonText="VIEW"
          actionButtonColor="#dc3545"
          showActionColumn={true}
          maxRows={5} // Show only 5 items initially, rest in popup
          style={{
            // Override the default padding to match your panel style
            padding: '20px',
            fontSize: '24px',
          }}
          
        />
  
        {/* Panel 4: Herds Running Low */}
        <div className="bubble-container">
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 15px 0' }}>
            Herds may be running low on...
          </h2>
          <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px', color: '#333' }}>
              <span style={{ fontWeight: 'bold' }}>Herd 3:</span> licktub (3 days ago)
            </div>
            <div style={{ color: '#333' }}>
              <span style={{ fontWeight: 'bold' }}>Herd 2:</span> hay (2 days ago)
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export default Overview;