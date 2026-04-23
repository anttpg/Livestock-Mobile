import React, { useState, useEffect } from 'react';
import Popup from './popup';

const ADD_NEW_SENTINEL = '__add_new__';

/**
 * Styled select with an optional "+ Add new..." item at the bottom of the list.
 * Selecting that item opens a Popup instead of setting the value.
 * On success the new option is inserted alphabetically and selected automatically.
 *
 * @param {string}    value
 * @param {Function}  onChange
 * @param {string[]}  options
 * @param {string}    [placeholder]
 * @param {string}    [error]
 * @param {boolean}   [disabled]
 * @param {boolean}   [editable]       - Adds the "+ Add new" item when true.
 * @param {string}    [table]          - Table name sent to the API. Required when editable.
 * @param {string}    [label]          - Used in the popup title.
 * @param {Function}  [onOptionAdded]  - Called with the new value after a successful add.
 */
function FormSelect({
    value,
    onChange,
    options,
    placeholder,
    error,
    disabled,
    editable,
    table,
    label,
    onOptionAdded,
    ...rest
}) {
    const [localOptions, setLocalOptions] = useState(options);
    const [popupOpen,    setPopupOpen]    = useState(false);
    const [newValue,     setNewValue]     = useState('');
    const [submitting,   setSubmitting]   = useState(false);
    const [addError,     setAddError]     = useState('');

    useEffect(() => {
        setLocalOptions(options);
    }, [options]);

    const handleChange = (e) => {
        if (e.target.value === ADD_NEW_SENTINEL) {
            setNewValue('');
            setAddError('');
            setPopupOpen(true);
            return;
        }
        onChange(e.target.value);
    };

    const handleAdd = async () => {
        const trimmed = newValue.trim();
        if (!trimmed) {
            setAddError('Value cannot be empty.');
            return;
        }
        if (localOptions.map(o => o.toLowerCase()).includes(trimmed.toLowerCase())) {
            setAddError('That option already exists.');
            return;
        }

        setSubmitting(true);
        setAddError('');

        try {
            const res = await fetch('/api/form-dropdown-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ table, value: trimmed })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to add option');
            }

            const updated = [...localOptions, trimmed].sort((a, b) => a.localeCompare(b));
            setLocalOptions(updated);
            onChange(trimmed);
            onOptionAdded?.(trimmed);
            setPopupOpen(false);
        } catch (err) {
            setAddError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const displayLabel = label || table || 'option';

    return (
        <>
            <select
                className={`form-select${error ? ' form-select--error' : ''}`}
                value={value}
                onChange={handleChange}
                disabled={disabled}
                {...rest}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {localOptions.map((o, i) => (
                    <option key={i} value={o}>{o}</option>
                ))}
                {editable && table && !disabled && (
                    <option value={ADD_NEW_SENTINEL}>+ Add new {displayLabel.toLowerCase()}...</option>
                )}
            </select>

            <Popup
                isOpen={popupOpen}
                onClose={() => setPopupOpen(false)}
                title={`Add ${displayLabel}`}
            >
                <div style={{ padding: '8px 0' }}>
                    <div className="form-field">
                        <label className="form-label">{displayLabel}</label>
                        <input
                            className={`form-input${addError ? ' form-input--error' : ''}`}
                            value={newValue}
                            onChange={e => {
                                setNewValue(e.target.value);
                                setAddError('');
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder={`New ${displayLabel.toLowerCase()}...`}
                            autoFocus
                        />
                        {addError && <div className="form-error">{addError}</div>}
                    </div>

                    <div className="form-actions" style={{ borderTop: 'none', paddingBottom: 0 }}>
                        <button
                            type="button"
                            className="button button--secondary"
                            onClick={() => setPopupOpen(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="button"
                            onClick={handleAdd}
                            disabled={submitting}
                        >
                            {submitting ? 'Adding...' : 'Add'}
                        </button>
                    </div>
                </div>
            </Popup>
        </>
    );
}

export default FormSelect;