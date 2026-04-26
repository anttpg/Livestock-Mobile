import React from 'react';
import Notes from './notes';

/**
 * Notes tab for the pasture folder.
 *
 * @param {string} pastureName
 */
function PastureNotes({ pastureName }) {
    return (
        <div className="bubble-container">
            <Notes
                entityType="Pasture"
                entityId={pastureName}
            />
        </div>
    );
}

export default PastureNotes;
