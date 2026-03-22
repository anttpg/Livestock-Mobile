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
  customEventTypes = {},
  herdID = null,
  username = 'Unknown',
  onNotesChanged = null  // Called after add/update/delete so parent can refresh
}) {
  const [showingNewNoteInput, setShowingNewNoteInput] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [visibleCount, setVisibleCount] = useState(maxEvents);
  const [editingNoteID, setEditingNoteID] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteID, setSavingNoteID] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const iconStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    width: '100%',
    height: '100%',
  };

  // Default event types
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
    },
    movement: {
      iconStyle: { background: 'rgb(30, 100, 200)', color: '#fff' },
      contentStyle: { background: 'rgb(220, 234, 255)', color: '#000' },
      icon: <span className="material-symbols-outlined" style={iconStyle}>footprint</span>
    },
    note: {
      iconStyle: { background: 'rgb(149, 97, 189)', color: '#fff' },
      contentStyle: { background: 'rgb(242, 234, 254)', color: '#000' },
      icon: <span className="material-symbols-outlined" style={iconStyle}>assignment</span>
    }
  };

  const allEventTypes = { ...defaultEventTypes, ...customEventTypes };

  Object.keys(allEventTypes).forEach(key => {
    const eventType = allEventTypes[key];
    if (typeof eventType.icon === 'string') {
      eventType.icon = <span className="material-symbols-outlined" style={iconStyle}>{eventType.icon}</span>;
    }
  });

  const getEventTypeConfig = (eventType) => {
    return allEventTypes[eventType] || allEventTypes.regular;
  };

  const defaultContentStyle = { background: 'rgb(245, 245, 245)', color: '#000' };

  // --- API calls ---

  const handleAddNote = async () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) return;

    try {
      const response = await fetch('/api/herds/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ herdID, username, note: trimmed })
      });
      if (!response.ok) {
        const err = await response.json();
        console.error('Failed to add note:', err);
        return;
      }
      setNewNoteText('');
      setShowingNewNoteInput(false);
      if (onNotesChanged) onNotesChanged();
    } catch (error) {
      console.error('Error adding herd note:', error);
    }
  };

  const handleSaveNote = async (noteID, text) => {
    if (savingNoteID === noteID) return;
    setSavingNoteID(noteID);

    try {
      const trimmed = (text ?? '').trim();

      if (!trimmed) {
        // Delete if empty
        const response = await fetch(`/api/herds/notes/${noteID}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) {
          const err = await response.json();
          console.error('Failed to delete note:', err);
        }
      } else {
        const response = await fetch(`/api/herds/notes/${noteID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ note: trimmed })
        });
        if (!response.ok) {
          const err = await response.json();
          console.error('Failed to update note:', err);
        }
      }

      if (onNotesChanged) onNotesChanged();
    } catch (error) {
      console.error('Error saving herd note:', error);
    } finally {
      setSavingNoteID(null);
      setEditingNoteID(null);
      setEditingNoteText('');
    }
  };

  const handleEditClick = (item) => {
    const noteID = item.ID;
    if (editingNoteID === noteID) {
      // Second click — save
      handleSaveNote(noteID, editingNoteText);
    } else {
      // First click — enter edit mode
      setEditingNoteID(noteID);
      setEditingNoteText(item.Note ?? item.notes ?? '');
    }
  };

  const handleNoteBlur = (noteID) => {
    if (editingNoteID === noteID) {
      handleSaveNote(noteID, editingNoteText);
    }
  };

  // --- Load more ---

  const handleLoadMore = () => {
    if (onSeeAll) onSeeAll();
    setVisibleCount(prev => prev + maxEvents);
  };

  const eventsToShow = data.slice(0, visibleCount);
  const remaining = data.length - visibleCount;
  const hasMoreItems = remaining > 0;

  return (
    <div className="timeline-wrapper" style={{ width: '100%' }}>
      <VerticalTimeline 
        animate={animate}
        layout={layout}
        lineColor="var(--timeline-color)"
      >
        {/* Add Herd Note Button / Input */}
        {onNewEvent !== null || herdID !== null ? (
          <VerticalTimelineElement
            className="vertical-timeline-element--new-note"
            iconStyle={{ background: 'rgb(76, 175, 80)', color: '#fff' }}
            icon={
              showingNewNoteInput
                ? <span className="material-symbols-outlined" style={iconStyle}>edit</span>
                : <span className="material-symbols-outlined" style={iconStyle}>add</span>
            }
            iconOnClick={() => setShowingNewNoteInput(!showingNewNoteInput)}
            position="right"
          >
            {showingNewNoteInput ? (
              <div>
                <h3 className="vertical-timeline-element-title" style={{ fontWeight: 'bold' }}>
                  Add Herd Note
                </h3>
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Enter note..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim()}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: newNoteText.trim() ? 'pointer' : 'not-allowed',
                        opacity: newNoteText.trim() ? 1 : 0.6
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowingNewNoteInput(false);
                        setNewNoteText('');
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
                <h3
                  className="vertical-timeline-element-title"
                  style={{ fontWeight: 'bold', cursor: 'pointer' }}
                  onClick={() => setShowingNewNoteInput(true)}
                >
                  Add Herd Note
                </h3>
                <p style={{ cursor: 'pointer' }} onClick={() => setShowingNewNoteInput(true)}>
                  Click to add a new note
                </p>
              </div>
            )}
          </VerticalTimelineElement>
        ) : null}

        {/* Timeline events */}
        {eventsToShow.length > 0 ? (
          eventsToShow.map((item, index) => {
            const eventType = item.eventType || 'regular';
            const config = getEventTypeConfig(eventType);
            const eventDate = formatDate(item.date || item.dateCompleted || item.dateRecorded || item.DateOfEntry);
            const isNote = eventType === 'note';
            const noteID = item.ID;
            const isEditing = isNote && editingNoteID === noteID;
            const noteText = item.Note ?? item.notes ?? '';

            return (
              <VerticalTimelineElement
                key={index}
                className={`vertical-timeline-element--${eventType}`}
                date={eventDate}
                iconStyle={config.iconStyle}
                contentStyle={config.contentStyle || defaultContentStyle}
                contentArrowStyle={{
                  borderRight: `7px solid ${config.iconStyle.background}`
                }}
                icon={config.icon}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="vertical-timeline-element-title">
                      {item.name || item.description || item.itemName || (isNote ? 'Note' : 'Event')}
                    </h3>
                    {item.details && (
                      <h4 className="vertical-timeline-element-subtitle">
                        {item.details}
                      </h4>
                    )}
                    {isNote ? (
                      isEditing ? (
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onBlur={() => handleNoteBlur(noteID)}
                          rows={3}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: '1px solid #9561bd',
                            borderRadius: '4px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            marginTop: '4px',
                            fontSize: '14px'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveNote(noteID, editingNoteText);
                            }
                            if (e.key === 'Escape') {
                              setEditingNoteID(null);
                              setEditingNoteText('');
                            }
                          }}
                        />
                      ) : (
                        noteText ? <p style={{ marginTop: '4px' }}>{noteText}</p> : null
                      )
                    ) : (
                      noteText ? <p style={{ marginTop: '4px' }}>{noteText}</p> : null
                    )}
                    {item.username && (
                      <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                        By: {item.username || item.Username}
                      </p>
                    )}
                  </div>

                  {/* Edit button — notes only */}
                  {isNote && (
                    <button
                      onClick={() => handleEditClick(item)}
                      disabled={savingNoteID === noteID}
                      title={isEditing ? 'Save note' : 'Edit note'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: savingNoteID === noteID ? 'not-allowed' : 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: savingNoteID === noteID ? 0.4 : 0.6,
                        flexShrink: 0,
                        alignSelf: 'center'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#221e1e'}}>
                        {isEditing ? 'save' : 'edit'}
                      </span>
                    </button>
                  )}
                </div>
              </VerticalTimelineElement>
            );
          })
        ) : (
          !onNewEvent && herdID === null && (
            <VerticalTimelineElement
              iconStyle={{ background: 'rgb(158, 158, 158)', color: '#fff' }}
              icon={<span className="material-symbols-outlined" style={iconStyle}>event</span>}
            >
              <h3 className="vertical-timeline-element-title">No events to display</h3>
            </VerticalTimelineElement>
          )
        )}

        {/* Load More Button */}
        {hasMoreItems && (
          <VerticalTimelineElement
            className="vertical-timeline-element--load-more"
            iconStyle={{ background: 'rgb(96, 125, 139)', color: '#fff' }}
            icon={<span className="material-symbols-outlined" style={iconStyle}>expand_more</span>}
            iconOnClick={handleLoadMore}
          >
            <h3 className="vertical-timeline-element-title" style={{ cursor: 'pointer' }} onClick={handleLoadMore}>
              Load more events
            </h3>
            <p style={{ cursor: 'pointer' }} onClick={handleLoadMore}>
              Showing {visibleCount} of {data.length}, click to load {Math.min(maxEvents, remaining)} more
            </p>
          </VerticalTimelineElement>
        )}
      </VerticalTimeline>
    </div>
  );
}

export default Timeline;