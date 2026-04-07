import React from 'react';
import AutoCombobox from './autoCombobox';

export const STATUS_COLORS = {
    'Current':            { bg: '#d4edda', color: '#155724' },
    'Target Sale':        { bg: '#fff3cd', color: '#636e1f' },
    'CULL LIST, Current': { bg: '#f8d7da', color: '#590e60' },
    'Missing':            { bg: '#f8d7da', color: '#721c24' },
    'Sold':               { bg: '#c89807', color: '#fdfdfd' },
    'Dead':               { bg: '#343a40', color: '#ffffff' },
    'Undefined':          { bg: '#e2e3e5', color: '#383d41' },
};``

export function StatusBadge({ status }) {
    if (!status) return null;
    const colors = STATUS_COLORS[status] || { bg: '#e2e3e5', color: '#383d41' };
    return (
        <span style={{
            display:         'inline-block',
            padding:         '2px 8px',
            borderRadius:    '999px',
            fontSize:        '10px',
            fontWeight:      '600',
            backgroundColor: colors.bg,
            color:           colors.color,
            whiteSpace:      'nowrap',
        }}>
            {status}
        </span>
    );
}

function AnimalCombobox({ options, ...rest }) {
    return (
        <AutoCombobox
            options={options}
            renderOptionRight={(option) => <StatusBadge status={option.status} />}
            {...rest}
        />
    );
}

export default AnimalCombobox;