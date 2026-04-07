import React, { useState, useEffect } from 'react';
import Timeline from './timeline';

function HerdLog({ 
  herdName,
  herdID,
  maxEvents = 5,
  showAddEvent = true,
  currentUser = 'Unknown'
}) {
  const [herdEvents, setHerdEvents] = useState([]);
  const [loading, setLoading] = useState(true);

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

        const movements = (data.movement || []).map(item => ({
          ...item,
          eventType: 'movement',
          date: item.dateRecorded
        }));

        const notes = (data.herdNotes || []).map(item => ({
          ...item,
          eventType: 'note',
          date: item.DateOfEntry,
          description: item.Username ? `Note by ${item.Username}` : 'Note'
        }));

        const combined = [...movements, ...notes].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        setHerdEvents(combined);
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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading herd events...
      </div>
    );
  }

  if (!herdName) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
        Select a herd to view its timeline
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Timeline: {herdName}</h3>
        {herdEvents.length > 0 && (
          <span style={{ color: '#666', fontSize: '14px' }}>
            {herdEvents.length} event{herdEvents.length !== 1 ? 's' : ''} recorded
          </span>
        )}
      </div>

      <Timeline
        data={herdEvents}
        maxEvents={maxEvents}
        onSeeAll={herdEvents.length > maxEvents ? () => {} : null}
        title={`${herdName} Events`}
        herdID={herdID}
        username={currentUser}
        onNotesChanged={fetchHerdEvents}
      />
    </div>
  );
}

export default HerdLog;