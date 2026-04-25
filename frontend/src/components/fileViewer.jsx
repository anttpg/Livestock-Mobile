import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import PopupConfirm from './popupConfirm';

/**
 * FileViewer — reusable file list, upload, open, download, and delete component.
 *
 * Props:
 *   domain    {string}      - File domain key, e.g. 'medicalUpload'
 *   recordId  {string|null} - Record ID. When null, files are queued locally
 *                             and uploaded once flushPending(newRecordId) is called.
 *
 * Ref methods (via useImperativeHandle):
 *   flushPending(newRecordId) — uploads all queued files to the newly created record.
 *                               Returns { uploaded, failed } counts.
 */
const FileViewer = forwardRef(function FileViewer({ domain, recordId }, ref) {
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // File objects queued before record exists
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const fileInputRef = useRef(null);

  const baseUrl = (id) => `/api/files/${domain}/${id}`;
  const fileUrl = (id, filename) => `${baseUrl(id)}/${encodeURIComponent(filename)}`;

  // ─── Imperative API ────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    async flushPending(newRecordId) {
      if (pendingFiles.length === 0) return { uploaded: 0, failed: 0 };

      let uploaded = 0;
      let failed = 0;

      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        try {
          const res = await fetch(baseUrl(newRecordId), {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          if (res.ok) uploaded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      setPendingFiles([]);
      return { uploaded, failed };
    }
  }), [pendingFiles]);

  // ─── Load files when recordId becomes available ────────────────────────────

  useEffect(() => {
    if (recordId) loadFiles();
  }, [recordId]);

  const loadFiles = async () => {
    if (!recordId) return;
    setFilesLoading(true);
    try {
      const res = await fetch(baseUrl(recordId), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error('FileViewer: error loading files:', e);
    } finally {
      setFilesLoading(false);
    }
  };

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    // No record yet — queue it
    if (!recordId) {
      setPendingFiles(prev => [...prev, file]);
      return;
    }

    const fd = new FormData();
    fd.append('file', file, file.name);
    setFileUploading(true);
    try {
      const res = await fetch(baseUrl(recordId), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (res.ok) {
        await loadFiles();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Upload failed');
      }
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setFileUploading(false);
    }
  };

  const removePending = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const requestDelete = (filename) => {
    setFileToDelete(filename);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!fileToDelete || !recordId) return;

    try {
      const res = await fetch(fileUrl(recordId, fileToDelete), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadFiles();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Delete failed');
      }
    } catch {
      alert('Delete failed. Please try again.');
    } finally {
      setFileToDelete(null);
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────────────

  const iconBtnStyle = {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '3px',
    textDecoration: 'none',
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalCount = files.length + pendingFiles.length;

  return (
    <>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontWeight: 'bold' }}>Related Files:</label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={fileUploading}
           style={{
               padding: '5px 12px',
               backgroundColor: fileUploading ? '#6c757d' : '#007bff',
               color: 'white',
               border: 'none',
               borderRadius: '4px',
               cursor: fileUploading ? 'not-allowed' : 'pointer',
               fontSize: '13px',
               display: 'flex',
               alignItems: 'center',
               gap: '4px',
           }}
          >
            {fileUploading ? 'Uploading...' : (
            <>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                {' Upload File'}
            </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {/* File list */}
        <div style={{
          minHeight: '60px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          fontSize: '14px',
        }}>
          {filesLoading && (
            <span style={{ color: '#6c757d' }}>Loading files...</span>
          )}

          {!filesLoading && totalCount === 0 && (
            <span style={{ color: '#6c757d' }}>No files uploaded yet.</span>
          )}

          {/* Uploaded files */}
          {!filesLoading && files.map(filename => (
            <div key={filename} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>

              {/* Download button */}
              <a
                href={fileUrl(recordId, filename)}
                download={filename}
                title="Download"
                style={{ ...iconBtnStyle, color: '#28a745' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9f7ef'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
              </a>

              {/* Open inline */}
              <a
                href={fileUrl(recordId, filename)}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, color: '#007bff', textDecoration: 'none', wordBreak: 'break-all' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}
              >
                {filename}
              </a>

              {/* Delete button */}
              <button
                onClick={() => requestDelete(filename)}
                title="Delete file"
                style={{ ...iconBtnStyle, color: '#dc3545' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>
          ))}

          {/* Pending files (queued before record exists) */}
          {pendingFiles.map((file, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px', opacity: 0.6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6c757d', flexShrink: 0 }}>schedule</span>
              <span style={{ flex: 1, wordBreak: 'break-all', color: '#6c757d', fontSize: '13px' }}>
                {file.name} <em>(pending save)</em>
              </span>
              <button
                onClick={() => removePending(index)}
                title="Remove"
                style={{ ...iconBtnStyle, color: '#dc3545' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fde8ea'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <PopupConfirm
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setFileToDelete(null); }}
        onConfirm={confirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${fileToDelete}"?<br/><br/><span style="color:#dc3545;font-weight:bold">This action cannot be undone.</span>`}
        confirmText="Delete"
        cancelText="Cancel"
        requireDelay={true}
        delaySeconds={2}
      />
    </>
  );
});

export default FileViewer;