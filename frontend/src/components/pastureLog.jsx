import React, { useState, useEffect } from 'react';
import Timeline from './timeline';

function PastureLog({ 
  pastureName,
  maxEvents = 5,
  showAddEvent = true 
}) {
  const [maintenanceEvents, setMaintenanceEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pastureName) {
      fetchMaintenanceEvents();
    }
  }, [pastureName]);

  const fetchMaintenanceEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pastures/${encodeURIComponent(pastureName)}/maintenance`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setMaintenanceEvents(data.maintenanceRecords || []);
      } else {
        console.error('Failed to fetch pasture maintenance events');
        setMaintenanceEvents([]);
      }
    } catch (error) {
      console.error('Error fetching pasture maintenance events:', error);
      setMaintenanceEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMaintenanceEvent = (eventText) => {
    // TODO: Process the new maintenance event
    console.log('New maintenance event for pasture:', pastureName, 'Event:', eventText);
    // This would typically:
    // 1. Parse the eventText 
    // 2. Create a maintenance record
    // 3. Refresh the timeline
    // 4. Show success message
  };

  const handleSeeAllEvents = () => {
    // Custom behavior - could open a modal or navigate to a detailed view
    console.log('See all maintenance events for pasture:', pastureName);
    // Default Timeline behavior will expand the timeline if this returns undefined
  };

  // Define custom event types for pasture maintenance
  // Only need to specify icon name and colors - styling is handled by Timeline component
  const pastureEventTypes = {
    movement: {
      iconStyle: { background: 'rgb(255, 193, 7)', color: '#000' },
      contentStyle: { background: 'rgb(255, 193, 7)', color: '#000' },
      icon: 'move_location' // Just the icon name
    },
    infrastructure: {
      iconStyle: { background: 'rgb(156, 39, 176)', color: '#fff' },
      contentStyle: { background: 'rgb(156, 39, 176)', color: '#fff' },
      icon: 'construction'
    },
    water: {
      iconStyle: { background: 'rgb(33, 150, 243)', color: '#fff' },
      contentStyle: { background: 'rgb(33, 150, 243)', color: '#fff' },
      icon: 'water_drop'
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#666' 
      }}>
        Loading maintenance records...
      </div>
    );
  }

  if (!pastureName) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        fontStyle: 'italic',
        color: '#666' 
      }}>
        No pasture selected
      </div>
    );
  }

  // Transform maintenance events to timeline format
  const timelineEvents = maintenanceEvents.map(event => {
    // Determine event type based on maintenance target and needs
    let eventType = 'regular';
    const target = event.TargetOfMainenance?.toLowerCase() || '';
    
    if (event.NeedsFollowUp) {
      eventType = 'important';
    } else if (target.includes('fence') || target.includes('gate')) {
      eventType = 'infrastructure';
    } else if (target.includes('water') || target.includes('tank') || target.includes('trough')) {
      eventType = 'water';
    } else if (target.includes('move') || target.includes('pasture') || target.includes('location')) {
      eventType = 'movement';
    }

    return {
      date: event.DateCompleted,
      name: event.TargetOfMainenance || 'Maintenance',
      details: event.ActionPerformed ? `Action: ${event.ActionPerformed}` : undefined,
      notes: event.NeedsFollowUp ? 'Follow-up required' : 'Completed',
      username: event.Username,
      eventType: eventType // Use eventType instead of description for styling
    };
  });

  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px' 
      }}>
        <h3 style={{ margin: 0 }}>Pasture Maintenance: {pastureName}</h3>
        {maintenanceEvents.length > 0 && (
          <span style={{ color: '#666', fontSize: '14px' }}>
            {maintenanceEvents.length} record{maintenanceEvents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Show follow-up summary if any items need follow-up */}
      {maintenanceEvents.some(event => event.NeedsFollowUp) && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '5px',
          padding: '10px',
          marginBottom: '15px',
          color: '#856404'
        }}>
          <strong>Follow-up Required:</strong> {
            maintenanceEvents
              .filter(event => event.NeedsFollowUp)
              .map(event => event.TargetOfMainenance)
              .join(', ')
          }
        </div>
      )}

      <Timeline
        data={timelineEvents}
        maxEvents={maxEvents}
        onSeeAll={handleSeeAllEvents}
        onNewEvent={showAddEvent ? handleNewMaintenanceEvent : null}
        title={`${pastureName} Maintenance`}
        customEventTypes={pastureEventTypes}
      />
    </div>
  );
}

export default PastureLog;