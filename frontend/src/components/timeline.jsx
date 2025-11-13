import React, { useState } from 'react';
import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

function Timeline({ 
  data = [], 
  maxEvents = 5, 
  onSeeAll = null,
  onNewEvent = null,
  title = "Timeline",
  animate = true,
  layout = '1-column-left',
  customEventTypes = {} // New prop for custom event types
}) {
  const [showingNewEventInput, setShowingNewEventInput] = useState(false);
  const [newEventText, setNewEventText] = useState('');
  const [showAllEvents, setShowAllEvents] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Icon styling for Material Symbols
  const iconStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    width: '100%',
    height: '100%',
  };

  // Default event types (removed 'movement' as requested)
  const defaultEventTypes = {
    important: {
      iconStyle: { background: 'rgb(233, 30, 99)', color: '#fff' },
      contentStyle: { background: 'rgb(233, 30, 99)', color: '#fff' },
      icon: <span className="material-symbols-outlined" style={iconStyle}>priority_high</span>
    },
    regular: {
      iconStyle: { background: 'rgb(196, 229, 255)', color: '#000' },
      contentStyle: { background: 'rgb(196, 229, 255)', color: '#000' },
      icon: <span className="material-symbols-outlined" style={iconStyle}>event</span>
    }
  };

  // Merge custom event types with defaults and process icons
  const allEventTypes = { ...defaultEventTypes, ...customEventTypes };

  // Process event types to handle string icons vs JSX icons
  Object.keys(allEventTypes).forEach(key => {
    const eventType = allEventTypes[key];
    if (typeof eventType.icon === 'string') {
      // Convert string icon names to properly styled JSX
      eventType.icon = <span className="material-symbols-outlined" style={iconStyle}>{eventType.icon}</span>;
    }
  });

  // Get event type configuration
  const getEventTypeConfig = (eventType) => {
    return allEventTypes[eventType] || allEventTypes.regular;
  };

  // Default content style for when no contentStyle is provided in event type
  const defaultContentStyle = { background: 'rgb(245, 245, 245)', color: '#000' };

  // Handle new event submission
  const handleNewEventSubmit = () => {
    if (newEventText.trim() && onNewEvent) {
      onNewEvent(newEventText.trim());
      setNewEventText('');
      setShowingNewEventInput(false);
    }
  };

  // Handle see all events
  const handleSeeAllClick = () => {
    if (onSeeAll) {
      onSeeAll();
    }
    // Always expand timeline regardless of custom handler
    setShowAllEvents(true);
  };

  // Determine how many events to display
  const eventsToShow = showAllEvents ? data : data.slice(0, maxEvents);
  const hasMoreItems = data.length > maxEvents && !showAllEvents;

  return (
    <div className="timeline-wrapper" style={{ width: '100%' }}>
      <VerticalTimeline 
        animate={animate}
        layout={layout}
        lineColor="var(--timeline-color)"
      >
        {/* New Event Button/Input */}
        {onNewEvent && (
          <VerticalTimelineElement
            className="vertical-timeline-element--new-event"
            iconStyle={{ background: 'rgb(76, 175, 80)', color: '#fff' }}
            icon={
              showingNewEventInput ? 
              <span className="material-symbols-outlined" style={iconStyle}>edit</span> : 
              <span className="material-symbols-outlined" style={iconStyle}>add</span>
            }
            iconOnClick={() => setShowingNewEventInput(!showingNewEventInput)}
            position="right"
          >
            {showingNewEventInput ? (
              <div>
                <h3 className="vertical-timeline-element-title" style={{ fontWeight: 'bold' }}>
                  Add New Event
                </h3>
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    value={newEventText}
                    onChange={(e) => setNewEventText(e.target.value)}
                    placeholder="Enter event description..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleNewEventSubmit();
                      }
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={handleNewEventSubmit}
                      disabled={!newEventText.trim()}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: newEventText.trim() ? 'pointer' : 'not-allowed',
                        opacity: newEventText.trim() ? 1 : 0.6
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowingNewEventInput(false);
                        setNewEventText('');
                      }}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="vertical-timeline-element-title" style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                  <span onClick={() => setShowingNewEventInput(true)}>New Event</span>
                </h3>
                <p style={{ cursor: 'pointer' }} onClick={() => setShowingNewEventInput(true)}>
                  Click to add a new event
                </p>
              </div>
            )}
          </VerticalTimelineElement>
        )}

        {/* Display timeline events */}
        {eventsToShow.length > 0 ? (
          eventsToShow.map((item, index) => {
            const eventType = item.eventType || 'regular'; // Use eventType or default to 'regular'
            const config = getEventTypeConfig(eventType);
            const eventDate = formatDate(item.date || item.dateCompleted || item.dateRecorded);
            
            return (
              <VerticalTimelineElement
                key={index}
                className={`vertical-timeline-element--${eventType}`}
                date={eventDate} // Date displays on the side
                iconStyle={config.iconStyle}
                contentStyle={config.contentStyle || defaultContentStyle}
                contentArrowStyle={{ 
                  borderRight: `7px solid ${config.iconStyle.background}` 
                }}
                icon={config.icon}
              >
                <h3 className="vertical-timeline-element-title">
                  {item.name || item.description || item.itemName || 'Event'}
                </h3>
                {item.details && (
                  <h4 className="vertical-timeline-element-subtitle">
                    {item.details}
                  </h4>
                )}
                {item.notes && (
                  <p>{item.notes}</p>
                )}
                {item.username && (
                  <p style={{ fontSize: '12px', opacity: 0.8 }}>
                    By: {item.username}
                  </p>
                )}
              </VerticalTimelineElement>
            );
          })
        ) : (
          // Show empty state only if no new event button
          !onNewEvent && (
            <VerticalTimelineElement
              iconStyle={{ background: 'rgb(158, 158, 158)', color: '#fff' }}
              icon={<span className="material-symbols-outlined" style={iconStyle}>event</span>}
            >
              <h3 className="vertical-timeline-element-title">No events to display</h3>
            </VerticalTimelineElement>
          )
        )}

        {/* See All Button */}
        {hasMoreItems && (
          <VerticalTimelineElement
            className="vertical-timeline-element--see-all"
            iconStyle={{ background: 'rgb(96, 125, 139)', color: '#fff' }}
            icon={<span className="material-symbols-outlined" style={iconStyle}>more_horiz</span>}
            iconOnClick={handleSeeAllClick}
          >
            <h3 className="vertical-timeline-element-title" style={{ cursor: 'pointer' }}>
              <span onClick={handleSeeAllClick}>
                See all events ({data.length} total)
              </span>
            </h3>
          </VerticalTimelineElement>
        )}
      </VerticalTimeline>
    </div>
  );
}

export default Timeline;