import React, { useState, useMemo, useEffect, useRef } from 'react';
import Table from './table';
import { useUser } from '../UserContext';
import { toLocalDisplay } from '../utils/dateUtils';

/**
 * Generic notes component. Works for any entity type.
 *
 * @param {string} entityId   — the primary key of the entity (e.g. cowTag, equipment ID)
 * @param {string} entityType — the logical entity type sent to the API (e.g. 'CowTable', 'Equipment')
 *
 * Replaces the old (cowTag, currentUser) interface.
 * Existing CowTable callers: <Notes entityType="CowTable" entityId={cowTag} />
 */
function Notes({ entityId, entityType }) {
    const { user } = useUser();
    const currentUser = user?.Username ?? user?.username ?? '';

    const [isExpanded,     setIsExpanded]     = useState(false);
    const [newObservation, setNewObservation] = useState('');
    const [isSaving,       setIsSaving]       = useState(false);
    const [localNotes,     setLocalNotes]     = useState([]);
    const [editingNoteId,  setEditingNoteId]  = useState(null);
    const [editingText,    setEditingText]    = useState('');
    const [showArchived,   setShowArchived]   = useState(false);
    const [isLoading,      setIsLoading]      = useState(false);

    const newNoteDateRef = useRef(new Date().toISOString());

    const tableStyle = {
        showActionColumn: false,
        alternatingRows:  true,
        evenRowColor:     '#fff',
        oddRowColor:      '#f9f9f9',
        maxHeight:        '400px',
        style:            { margin: 0 }
    };

    const formatNoteData = (note) => ({
        NoteID:           note.NoteID,
        DateOfEntry:      note.DateOfEntry,
        DateOfLastUpdate: note.DateOfLastUpdate || note.DateOfEntry,
        Username:         note.Username || 'Unknown',
        Note:             note.Note,
        Archive:          note.Archive,
        isNewRow:         false
    });

    // ── Fetch ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchNotes = async () => {
            if (!entityId || !entityType) {
                setLocalNotes([]);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(
                    `/api/notes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
                    { method: 'GET', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, credentials: 'include' }
                );

                if (!response.ok) {
                    if (response.status === 401) { window.location.href = '/login'; return; }
                    throw new Error('Failed to fetch notes');
                }

                const data = await response.json();
                setLocalNotes(data);
            } catch (error) {
                console.error('Error fetching notes:', error);
                setLocalNotes([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotes();
    }, [entityId, entityType]);

    // ── Add ──────────────────────────────────────────────────────────────────
    const handleAddObservation = async () => {
        if (!newObservation.trim() || !entityId) return;

        const dateOfNote = new Date().toISOString();
        const noteText   = newObservation.trim();

        setNewObservation('');
        setIsSaving(true);

        const tempNoteId     = `temp-${Date.now()}`;
        const optimisticNote = {
            NoteID:           tempNoteId,
            Note:             noteText,
            DateOfEntry:      dateOfNote,
            DateOfLastUpdate: dateOfNote,
            Username:         currentUser || 'Unknown',
            EntityType:       entityType,
            EntityID:         entityId,
            Archive:          false
        };

        setLocalNotes(prev => [optimisticNote, ...prev]);

        try {
            const response = await fetch('/api/add-note', {
                method:  'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    note:        noteText,
                    dateOfEntry: dateOfNote,
                    entityType:  entityType,
                    entityId:    entityId,
                    username:    currentUser
                })
            });

            if (!response.ok) {
                if (response.status === 401) { window.location.href = '/login'; return; }
                throw new Error('Failed to add observation');
            }

            const responseData = await response.json();

            if (responseData.success && responseData.noteId) {
                setLocalNotes(prev => prev.map(note =>
                    note.NoteID === tempNoteId
                        ? { ...note, NoteID: responseData.noteId }
                        : note
                ));
                newNoteDateRef.current = new Date().toISOString();
            } else {
                setLocalNotes(prev => prev.filter(note => note.NoteID !== tempNoteId));
                alert('Error adding observation');
            }
        } catch (error) {
            console.error('Error submitting observation:', error);
            setLocalNotes(prev => prev.filter(note => note.NoteID !== tempNoteId));
            alert('Error adding observation');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Update ───────────────────────────────────────────────────────────────
    const handleUpdateNote = async (noteId, noteText) => {
        if (!noteText.trim()) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/update-note', {
                method:  'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ noteId, note: noteText })
            });

            if (!response.ok) {
                if (response.status === 401) { window.location.href = '/login'; return; }
                throw new Error('Failed to update note');
            }

            const responseData = await response.json();

            if (responseData.success) {
                setLocalNotes(prev => prev.map(note =>
                    note.NoteID === noteId
                        ? { ...note, Note: noteText, DateOfLastUpdate: new Date().toISOString() }
                        : note
                ));
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

    // ── Archive ──────────────────────────────────────────────────────────────
    const handleArchiveNote = async (noteId, archive) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/update-note', {
                method:  'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ noteId, archive })
            });

            if (!response.ok) {
                if (response.status === 401) { window.location.href = '/login'; return; }
                throw new Error('Failed to archive note');
            }

            const responseData = await response.json();
            if (responseData.success) {
                setLocalNotes(prev => prev.map(note =>
                    note.NoteID === noteId ? { ...note, Archive: archive } : note
                ));
            }
        } catch (error) {
            console.error('Error archiving note:', error);
            alert('Error archiving note');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Delete ───────────────────────────────────────────────────────────────
    const handleDeleteNote = async (noteId) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/delete-note', {
                method:  'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ noteId })
            });

            if (!response.ok) {
                if (response.status === 401) { window.location.href = '/login'; return; }
                throw new Error('Failed to delete note');
            }

            const responseData = await response.json();
            if (responseData.success) {
                setLocalNotes(prev => prev.filter(note => note.NoteID !== noteId));
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

    // ── Interaction handlers ─────────────────────────────────────────────────
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

    const handleBlur = (isNewNote, noteId = null) => {
        if (isNewNote) {
            if (newObservation.trim()) handleAddObservation();
        } else if (noteId) {
            if (editingText.trim()) {
                handleUpdateNote(noteId, editingText);
            } else {
                handleDeleteNote(noteId);
            }
        }
    };

    const handleFocus     = () => {};
    const handleEditClick = (note) => { setEditingNoteId(note.NoteID); setEditingText(note.Note); };

    // ── Table data ───────────────────────────────────────────────────────────
    const tableData = useMemo(() => {
        const data = [];

        if (isExpanded && entityId) {
            data.push({
                NoteID:           'new-note-row',
                DateOfEntry:      newNoteDateRef.current,
                DateOfLastUpdate: newNoteDateRef.current,
                Username:         currentUser,
                Note:             '',
                Archive:          false,
                isNewRow:         true
            });
        }

        data.push(...localNotes
            .filter(note => !note.Archive)
            .map(formatNoteData)
        );

        return data;
    }, [isExpanded, entityId, localNotes, currentUser]);

    const archivedTableData = useMemo(() => (
        localNotes.filter(note => note.Archive).map(formatNoteData)
    ), [localNotes]);

    // ── Column builder ───────────────────────────────────────────────────────
    const createNotesColumns = (isArchived) => {
        const columnLayout = getComputedStyle(document.documentElement)
            .getPropertyValue('--note-table-columns').trim();

        let dateColumns = [];

        if (columnLayout === '3') {
            dateColumns = [{
                key: 'DateOfEntry', header: 'Info', type: 'custom', width: '110px', align: 'left',
                customRender: (value, row) => (
                    <div style={{ fontSize: '13px' }}>
                        <div><b>Created</b></div>
                        <div>{toLocalDisplay(row.DateOfEntry)}</div>
                        <div><b>Modified</b></div>
                        <div>{toLocalDisplay(row.DateOfLastUpdate)}</div>
                        <br />
                        <div><b>User</b></div>
                        <div>{row.Username}</div>
                    </div>
                )
            }];
        } else if (columnLayout === '4') {
            dateColumns = [
                {
                    key: 'DateOfEntry', header: 'Modified', type: 'custom', width: '80px', align: 'left',
                    customRender: (value, row) => (
                        <div style={{ fontSize: '13px' }}>
                            <div><b>Created</b></div>
                            <div>{toLocalDisplay(row.DateOfEntry)}</div>
                            <div><b>Modified</b></div>
                            <div>{toLocalDisplay(row.DateOfLastUpdate)}</div>
                        </div>
                    )
                },
                { key: 'Username', header: 'User', type: 'text', width: '80px', align: 'left' }
            ];
        } else if (columnLayout === '5') {
            dateColumns = [
                {
                    key: 'DateOfEntry', header: 'Created', type: 'custom', width: '80px', align: 'left',
                    customRender: (value, row) => <div style={{ fontSize: '13px' }}>{toLocalDisplay(row.DateOfEntry)}</div>
                },
                {
                    key: 'DateOfLastUpdate', header: 'Modified', type: 'custom', width: '80px', align: 'left',
                    customRender: (value, row) => <div style={{ fontSize: '13px' }}>{toLocalDisplay(row.DateOfLastUpdate)}</div>
                },
                { key: 'Username', header: 'User', type: 'text', width: '80px', align: 'left' }
            ];
        } else {
            dateColumns = [{
                key: 'DateOfEntry', header: 'Info', type: 'custom', width: '80px', align: 'left',
                customRender: (value, row) => (
                    <div style={{ fontSize: '13px' }}>
                        <div><b>Created</b></div>
                        <div>{toLocalDisplay(row.DateOfEntry)}</div>
                        <div><b>Modified</b></div>
                        <div>{toLocalDisplay(row.DateOfLastUpdate)}</div>
                        <br />
                        <div><b>User</b></div>
                        <div>{row.Username}</div>
                    </div>
                )
            }];
        }

        return [
            ...dateColumns,
            {
                key: 'Note', header: 'Note', type: 'text', align: 'left',
                customRender: !isArchived ? (value, row) => {
                    if (row.isNewRow) {
                        return (
                            <textarea
                                key="new-note-textarea"
                                value={newObservation}
                                onChange={e => setNewObservation(e.target.value)}
                                onKeyPress={e => handleKeyPress(e, true)}
                                onFocus={handleFocus}
                                onBlur={() => handleBlur(true)}
                                placeholder="Enter new note... Press 'Enter' or click out to save!"
                                style={{
                                    width: 'calc(100% - 12px)', minHeight: '60px',
                                    padding: '6px', border: 'none', resize: 'vertical',
                                    fontSize: '14px', backgroundColor: '#f8f9fa', boxSizing: 'border-box'
                                }}
                            />
                        );
                    }

                    if (editingNoteId === row.NoteID) {
                        return (
                            <textarea
                                key={`edit-note-${row.NoteID}`}
                                value={editingText}
                                onChange={e => setEditingText(e.target.value)}
                                onKeyPress={e => handleKeyPress(e, false, row.NoteID)}
                                onFocus={handleFocus}
                                onBlur={() => handleBlur(false, row.NoteID)}
                                style={{
                                    width: 'calc(100% - 12px)', minHeight: '60px',
                                    padding: '6px', border: '1px solid #ccc', resize: 'vertical',
                                    fontSize: '14px', backgroundColor: '#fff', boxSizing: 'border-box'
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
                                    style={{ padding: '4px 8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Edit note"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#666' }}>edit</span>
                                </button>
                            )}
                        </div>
                    );
                } : undefined
            },
            {
                key: 'Archive', header: isArchived ? 'Unarchive' : 'Archive',
                type: 'custom', width: '80px', align: 'center',
                customRender: (value, row) => {
                    if (!isArchived && row.isNewRow) return null;
                    return (
                        <button
                            onClick={() => handleArchiveNote(row.NoteID, !isArchived)}
                            style={{ backgroundColor: isArchived ? '#28a745' : '#dc3545' }}
                        >
                            {isArchived ? 'Unhide' : 'Archive'}
                        </button>
                    );
                }
            }
        ];
    };

    const notesColumns         = useMemo(() => createNotesColumns(false), [newObservation, editingNoteId, editingText, isExpanded]);
    const archivedNotesColumns = useMemo(() => createNotesColumns(true),  []);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Notes</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {(isSaving || isLoading) && (
                        <>
                            <span style={{ fontSize: '14px', color: '#666' }}>{isLoading ? 'Loading' : 'Saving'}</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>progress_activity</span>
                        </>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                    >
                        {isExpanded ? 'Close and Save' : 'Add or Edit'}
                    </button>
                </div>
            </div>

            {!entityId ? (
                <Table data={[]} columns={notesColumns} emptyMessage="Select a record to view and edit notes" {...tableStyle} />
            ) : tableData.length === 0 ? (
                <Table data={[]} columns={notesColumns} emptyMessage="No notes recorded yet" {...tableStyle} />
            ) : (
                <Table
                    data={tableData}
                    columns={notesColumns}
                    {...tableStyle}
                    customRowStyle={(row, index) => ({
                        backgroundColor: row.isNewRow ? '#f8f9fa' : (index % 2 === 0 ? '#fff' : '#f9f9f9'),
                        fontStyle:       row.isNewRow ? 'italic' : 'normal',
                        color:           row.isNewRow ? '#666'   : 'inherit'
                    })}
                />
            )}

            {archivedTableData.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <div
                        onClick={() => setShowArchived(!showArchived)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px', color: '#666', fontSize: '14px' }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {showArchived ? 'expand_less' : 'expand_more'}
                        </span>
                        <span>{showArchived ? 'Hide archived notes' : 'Show archived notes'}</span>
                    </div>

                    {showArchived && (
                        <Table data={archivedTableData} columns={archivedNotesColumns} {...tableStyle} />
                    )}
                </div>
            )}
        </div>
    );
}

export default Notes;