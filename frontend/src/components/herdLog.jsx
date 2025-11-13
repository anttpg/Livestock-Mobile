import React, { useState, useEffect } from 'react';
import Timeline from './timeline';

function HerdLog({ 
  herdName,
  maxEvents = 5,
  showAddEvent = true 
}) {
  const [herdEvents, setHerdEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    if (herdName) {
      fetchHerdEvents();
    }
  }, [herdName]);

  const fetchHerdEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/herds/${encodeURIComponent(herdName)}/events`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setHerdEvents(data.events || []);
      } else {
        console.error('Failed to fetch herd events');
        setHerdEvents([]);
      }
    } catch (error) {
      console.error('Error fetching herd events:', error);
      setHerdEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewEvent = () => {
    // TODO: Open popup or modal for adding new herd event
    console.log('Add new event for herd:', herdName);
    // This would typically open a form popup to add various event types:
    // - Herd movement
    // - Animal additions/removals  
    // - General herd notes
    // - Health events
  };

  const handleSeeAllEvents = () => {
    setShowAllEvents(true);
    // TODO: Open popup showing all events in a table or expanded timeline
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#666' 
      }}>
        Loading herd events...
      </div>
    );
  }

  if (!herdName) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        fontStyle: 'italic',
        color: '#666' 
      }}>
        Select a herd to view its timeline
      </div>
    );
  }

  // Transform herd events to timeline format
  const timelineEvents = herdEvents.map(event => ({
    date: event.dateRecorded || event.dateJoined || event.eventDate,
    name: event.description || event.eventType || 'Herd Event',
    details: event.details || event.targetOfMaintenance,
    notes: event.notes || event.actionPerformed,
    username: event.username,
    // Add category hints for timeline styling
    description: event.eventType === 'movement' ? 'movement' : 
                event.eventType === 'urgent' ? 'important' : 'regular'
  }));

  return (
    <div style={{ width: '100%' }}>
      <div className="timeline-label" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
      }}>
        <h3>Timeline: {herdName}</h3>
        {herdEvents.length > 0 && (
          <span style={{ color: '#666', fontSize: '14px' }}>
            {herdEvents.length} event{herdEvents.length !== 1 ? 's' : ''} recorded
          </span>
        )}
      </div>

      <Timeline
        data={timelineEvents}
        maxEvents={maxEvents}
        onSeeAll={herdEvents.length > maxEvents ? handleSeeAllEvents : null}
        onNewEvent={showAddEvent ? handleNewEvent : null}
        title={`${herdName} Events`}

      />
    </div>
  );
}

export default HerdLog;