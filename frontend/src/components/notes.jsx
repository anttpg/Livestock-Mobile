import React, { useState, useMemo, useEffect, useRef } from 'react';
import Table from './table';

function Notes({ cowTag, cowData, onRefresh, currentUser }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newObservation, setNewObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localNotes, setLocalNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Use ref to store a stable date for the new note row
  const newNoteDateRef = useRef(new Date().toISOString());

  // Initialize and update localNotes when cowData changes
  useEffect(() => {
    setLocalNotes(cowData?.notes || []);
  }, [cowData]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleAddObservation = async () => {
    if (!newObservation.trim() || !cowTag) return;

    const dateOfNote = new Date().toISOString();
    setIsSaving(true);

    try {
      const response = await fetch('/api/add-note', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          note: newObservation,
          dateOfEntry: dateOfNote,
          cowTag: cowTag
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to add observation');
      }

      const responseData = await response.json();

      if (responseData.success && responseData.noteId) {
        // Add the new note to local state
        const newNote = {
          NoteID: responseData.noteId,
          Note: newObservation,
          DateOfEntry: dateOfNote,
          DateOfLastUpdate: dateOfNote,
          Username: currentUser || 'Unknown',
          CowTag: cowTag,
          Archive: false
        };

        setLocalNotes(prevNotes => [newNote, ...prevNotes]);
        setNewObservation('');
        // Reset the date for next note
        newNoteDateRef.current = new Date().toISOString();
      }
    } catch (error) {
      console.error('Error submitting observation:', error);
      alert('Error adding observation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async (noteId, noteText) => {
    if (!noteText.trim()) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/update-note', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          noteId: noteId,
          note: noteText
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to update note');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Update the note in local state
        setLocalNotes(prevNotes =>
          prevNotes.map(note =>
            note.NoteID === noteId
              ? { ...note, Note: noteText, DateOfLastUpdate: new Date().toISOString() }
              : note
          )
        );
        setEditingNoteId(null);
        setEditingText('');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Error updating note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveNote = async (noteId, archive) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/update-note', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          noteId: noteId,
          archive: archive
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to archive note');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Update the note in local state
        setLocalNotes(prevNotes =>
          prevNotes.map(note =>
            note.NoteID === noteId
              ? { ...note, Archive: archive }
              : note
          )
        );
      }
    } catch (error) {
      console.error('Error archiving note:', error);
      alert('Error archiving note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e, isNewNote, noteId = null) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isNewNote) {
        handleAddObservation();
      } else if (noteId) {
        handleUpdateNote(noteId, editingText);
      }
    }
  };

  const handleDeleteNote = async (noteId) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/delete-note', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          noteId: noteId
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to delete note');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Remove the note from local state
        setLocalNotes(prevNotes =>
          prevNotes.filter(note => note.NoteID !== noteId)
        );
        setEditingNoteId(null);
        setEditingText('');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = (isNewNote, noteId = null) => {
    //console.log('Textarea blurred');
    if (isNewNote) {
      if (newObservation.trim()) {
        handleAddObservation();
      }
    } else if (noteId) {
      if (editingText.trim()) {
        handleUpdateNote(noteId, editingText);
      } else {
        // If text is empty, delete the note
        handleDeleteNote(noteId);
      }
    }
  };

  const handleFocus = () => {
    //console.log('Textarea focused');
  };

  const handleEditClick = (note) => {
    setEditingNoteId(note.NoteID);
    setEditingText(note.Note);
  };

  // Create table data with stable values for the new row
  const tableData = useMemo(() => {
    const data = [];

    // Add new observation row when expanded - with STABLE values
    if (isExpanded && cowTag) {
      data.push({
        NoteID: 'new-note-row',  // Stable ID so React knows it's the same row
        DateOfEntry: newNoteDateRef.current,  // Stable date reference
        DateOfLastUpdate: newNoteDateRef.current,
        Username: currentUser || 'Current User',
        Note: '',
        Archive: false,
        isNewRow: true
      });
    }

    // Add existing notes from local state (non-archived)
    data.push(...localNotes
      .filter(note => !note.Archive)
      .map(note => ({
        NoteID: note.NoteID,
        DateOfEntry: note.DateOfEntry,
        DateOfLastUpdate: note.DateOfLastUpdate,
        Username: note.Username || currentUser || 'Unknown',
        Note: note.Note,
        Archive: note.Archive,
        isNewRow: false
      }))
    );

    return data;
  }, [isExpanded, cowTag, localNotes, currentUser]);

  // Archived notes table data
  const archivedTableData = useMemo(() => {
    return localNotes
      .filter(note => note.Archive)
      .map(note => ({
        NoteID: note.NoteID,
        DateOfEntry: note.DateOfEntry,
        DateOfLastUpdate: note.DateOfLastUpdate,
        Username: note.Username || currentUser || 'Unknown',
        Note: note.Note,
        Archive: note.Archive,
        isNewRow: false
      }));
  }, [localNotes, currentUser]);

  // Define columns - memoized with stable reference
  const notesColumns = useMemo(() => [
    {
      key: 'DateOfEntry',
      header: 'Modified',
      type: 'custom',
      width: '150px',
      align: 'left',
      customRender: (value, row) => {
        return (
          <div style={{ fontSize: '13px' }}>
            <div>Created: {formatDate(row.DateOfEntry)}</div>
            <div>Modified: {formatDate(row.DateOfLastUpdate)}</div>
          </div>
        );
      }
    },
    {
      key: 'Username',
      header: 'User',
      type: 'text',
      width: '120px',
      align: 'left'
    },
    {
      key: 'Note',
      header: 'Note',
      type: 'text',
      align: 'left',
      customRender: (value, row) => {
        if (row.isNewRow) {
          return (
            <textarea
              key="new-note-textarea"
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, true)}
              onFocus={handleFocus}
              onBlur={() => handleBlur(true)}
              placeholder="Enter new note... Press 'Enter' or click out to save!"
              style={{
                width: 'calc(100% - 12px)',
                minHeight: '60px',
                padding: '6px',
                border: 'none',
                resize: 'vertical',
                fontSize: '14px',
                backgroundColor: '#f8f9fa',
                boxSizing: 'border-box'
              }}
            />
          );
        }

        if (editingNoteId === row.NoteID) {
          return (
            <textarea
              key={`edit-note-${row.NoteID}`}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, false, row.NoteID)}
              onFocus={handleFocus}
              onBlur={() => handleBlur(false, row.NoteID)}
              style={{
                width: 'calc(100% - 12px)',
                minHeight: '60px',
                padding: '6px',
                border: '1px solid #ccc',
                resize: 'vertical',
                fontSize: '14px',
                backgroundColor: '#fff',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1 }}>{value}</span>
            {isExpanded && (
              <button
                onClick={() => handleEditClick(row)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Edit note"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#666' }}>
                  edit
                </span>
              </button>
            )}
          </div>
        );
      }
    },
    {
      key: 'Archive',
      header: 'Archive',
      type: 'custom',
      width: '80px',
      align: 'center',
      customRender: (value, row) => {
        if (row.isNewRow) return null;

        return (
          <button
            onClick={() => handleArchiveNote(row.NoteID, true)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Archive
          </button>
        );
      }
    }
  ], [newObservation, editingNoteId, editingText, isExpanded]);

  // Archived notes columns (similar but with Unarchive button)
  const archivedNotesColumns = useMemo(() => [
    {
      key: 'DateOfEntry',
      header: 'Modified',
      type: 'custom',
      width: '150px',
      align: 'left',
      customRender: (value, row) => {
        return (
          <div style={{ fontSize: '13px' }}>
            <div>Created: {formatDate(row.DateOfEntry)}</div>
            <div>Modified: {formatDate(row.DateOfLastUpdate)}</div>
          </div>
        );
      }
    },
    {
      key: 'Username',
      header: 'User',
      type: 'text',
      width: '120px',
      align: 'left'
    },
    {
      key: 'Note',
      header: 'Note',
      type: 'text',
      align: 'left'
    },
    {
      key: 'Archive',
      header: 'Unarchive',
      type: 'custom',
      width: '80px',
      align: 'center',
      customRender: (value, row) => {
        return (
          <button
            onClick={() => handleArchiveNote(row.NoteID, false)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Unhide
          </button>
        );
      }
    }
  ], []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Notes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isSaving && (
            <>
              <span style={{ fontSize: '14px', color: '#666' }}>Saving</span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>
                progress_activity
              </span>
            </>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isExpanded ? 'Close and Save' : 'Add or Edit'}
          </button>
        </div>
      </div>

      {!cowTag ? (
        <Table
          data={[]}
          columns={notesColumns}
          emptyMessage="Select a cow to view and edit observations"
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
        />
      ) : tableData.length === 0 ? (
        <Table
          data={[]}
          columns={notesColumns}
          emptyMessage="No observations recorded yet"
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
        />
      ) : (
        <Table
          data={tableData}
          columns={notesColumns}
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f9f9f9"
          maxHeight="400px"
          style={{ margin: 0 }}
          customRowStyle={(row, index) => ({
            backgroundColor: row.isNewRow ? '#f8f9fa' : (index % 2 === 0 ? '#fff' : '#f9f9f9'),
            fontStyle: row.isNewRow ? 'italic' : 'normal',
            color: row.isNewRow ? '#666' : 'inherit'
          })}
        />
      )}

      {/* Archived Notes Section */}
      {archivedTableData.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div
            onClick={() => setShowArchived(!showArchived)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: '10px',
              color: '#666',
              fontSize: '14px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {showArchived ? 'expand_less' : 'expand_more'}
            </span>
            <span>{showArchived ? 'Hide archived notes' : 'Show archived notes'}</span>
          </div>

          {showArchived && (
            <Table
              data={archivedTableData}
              columns={archivedNotesColumns}
              showActionColumn={false}
              alternatingRows={true}
              evenRowColor="#fff"
              oddRowColor="#f9f9f9"
              maxHeight="400px"
              style={{ margin: 0 }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Notes;