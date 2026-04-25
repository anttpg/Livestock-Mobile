import { useState } from 'react';
import React from 'react';
import PopupNotify from './popupNotify';

const defaultRowKey = r => r.ID ?? r.CowTag;

/**
 * Manages the edit lifecycle for a TableViewer's records.
 *
 * @param {Array}    records
 * @param {Function} setRecords
 * @param {Object}   options
 * @param {Function} [options.rowKey]  fn(row) => unique key. Defaults to r.ID ?? r.CowTag
 * @param {string}   [options.label]  field name used in the error message. Defaults to 'CowTag'
 *
 * Returns:
 *   editTarget    — the row currently being edited (null when closed)
 *   setEditTarget — pass directly as onEdit={setEditTarget} to TableViewer
 *   handleSuccess — call from your confirm/form handler:
 *                     handleSuccess(updatedRow) — replaces the row in the list
 *                     handleSuccess(null)        — removes the row (delete case)
 *   handleError   — call with an error message string to show the notify popup
 *   errorNotify   — <PopupNotify /> JSX; render this somewhere in your component
 */
export function useTableEdit(records, setRecords, { rowKey = defaultRowKey, label = 'CowTag' } = {}) {
    const [editTarget, setEditTarget] = useState(null);
    const [editError,  setEditError]  = useState(null); // { row, message }

    const handleSuccess = (updatedRow) => {
        const target = editTarget;
        setEditTarget(null);
        setRecords(prev => {
            if (updatedRow === null) {
                return prev.filter(r => rowKey(r) !== rowKey(target));
            }
            return prev.map(r => rowKey(r) === rowKey(updatedRow) ? updatedRow : r);
        });
    };

    const handleError = (message) => {
        setEditError({ row: editTarget, message });
    };

    const errorNotify = (
        <PopupNotify
            isOpen={editError !== null}
            onClose={() => setEditError(null)}
            title="Update Failed"
            message={
                editError
                    ? `Could not update record${editError.row?.[label] ? ` for ${editError.row[label]}` : ''}: ${editError.message}`
                    : ''
            }
        />
    );

    return { editTarget, setEditTarget, handleSuccess, handleError, errorNotify };
}


export default useTableEdit;