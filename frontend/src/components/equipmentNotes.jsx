import React from 'react';
import Notes from './notes';

/**
 * Notes tab for the equipment folder.
 *
 * @param {number} equipmentId
 */
function EquipmentNotes({ equipmentId }) {
    return (
        <div className="bubble-container">
            <Notes
                entityType="Equipment"
                entityId={String(equipmentId)}
            />
        </div>
    );
}

export default EquipmentNotes;
