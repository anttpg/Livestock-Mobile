import React, { useState, useEffect } from 'react';
import Popup from './popup';


const ADD_NEW_SENTINEL = '__add_new__';

/**
 * Styled select with an optional "+ Add new..." item at the bottom of the list.
 * Selecting that item opens a Popup instead of setting the value.
 * On success the new option is inserted alphabetically and selected automatically.
 * Emits null (not '') when the placeholder / empty option is selected.
 *
 * @param {string|null} value
 * @param {Function}    onChange
 * @param {string[]}    options
 * @param {string}      [placeholder]
 * @param {string}      [error]
 * @param {boolean}     [disabled]
 * @param {boolean}     [editable]       - Adds the "+ Add new" item when true.
 * @param {string}      [table]          - Table name sent to the API. Required when editable.
 * @param {string}      [label]          - Used in the popup title.
 * @param {Function}    [onOptionAdded]  - Called with the new value after a successful add.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export function FormSelect({
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
        onChange(e.target.value === '' ? null : e.target.value);
    };

    const handleAdd = async () => {
        const trimmed = newValue.trim();
        if (!trimmed) { setAddError('Value cannot be empty.'); return; }
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
                value={value ?? ''}
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

            <Popup isOpen={popupOpen} onClose={() => setPopupOpen(false)} title={`Add ${displayLabel}`}>
                <div style={{ padding: '8px 0' }}>
                    <div className="form-field">
                        <label className="form-label">{displayLabel}</label>
                        <input
                            className={`form-input${addError ? ' form-input--error' : ''}`}
                            value={newValue}
                            onChange={e => { setNewValue(e.target.value); setAddError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder={`New ${displayLabel.toLowerCase()}...`}
                            autoFocus
                        />
                        {addError && <div className="form-error">{addError}</div>}
                    </div>
                    <div className="form-actions" style={{ borderTop: 'none', paddingBottom: 0 }}>
                        <button type="button" className="button button--secondary"
                            onClick={() => setPopupOpen(false)} disabled={submitting}>Cancel</button>
                        <button type="button" className="button"
                            onClick={handleAdd} disabled={submitting}>
                            {submitting ? 'Adding...' : 'Add'}
                        </button>
                    </div>
                </div>
            </Popup>
        </>
    );
}


/**
 * Plain styled select with no add-new behaviour.
 * Emits null (not '') when the placeholder / empty option is selected.
 * Use this for any select whose options are not user-extensible.
 *
 * @param {string|null} value
 * @param {Function}    onChange
 * @param {string[]}    options       - Flat string array, or { id, name }[] — see objectKey.
 * @param {string}      [objectKey]   - If options are objects, the key used as both value and label
 *                                      unless labelKey is also provided.
 * @param {string}      [labelKey]    - If options are objects with separate value/label keys.
 * @param {string}      [placeholder]
 * @param {string}      [error]
 * @param {boolean}     [disabled]
 */
export function FormSelectBasic({
    value,
    onChange,
    options = [],
    objectKey,
    labelKey,
    placeholder,
    error,
    disabled,
    ...rest
}) {
    const handleChange = (e) => {
        onChange(e.target.value === '' ? null : e.target.value);
    };
 
    const renderOptions = () => {
        if (!options.length) return null;
        if (typeof options[0] === 'object') {
            const valKey = objectKey || 'id';
            const lblKey = labelKey || objectKey || 'name';
            return options.map((o, i) => (
                <option key={i} value={o[valKey]}>{o[lblKey]}</option>
            ));
        }
        return options.map((o, i) => <option key={i} value={o}>{o}</option>);
    };
 
    return (
        <select
            className={`form-select${error ? ' form-select--error' : ''}`}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            {...rest}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {renderOptions()}
        </select>
    );
}



/**
 * A paired number input + unit selector on one line.
 * Unit options come from dropdownData — pass the relevant array directly.
 * Emits null (not '') when unit is cleared.
 *
 * @param {string|number} value            - The numeric value.
 * @param {Function}      onValueChange    - Called with the new numeric string.
 * @param {string|null}   unit             - The selected unit.
 * @param {Function}      onUnitChange     - Called with the new unit string or null.
 * @param {string[]}      unitOptions      - Flat string array of unit options.
 * @param {string}        [valuePlaceholder]
 * @param {string}        [unitPlaceholder]
 * @param {string}        [step]           - Input step, defaults to '0.01'.
 * @param {boolean}       [disabled]
 * @param {string}        [error]          - Applied to the value input.
 * @param {boolean}       [editable]       - Passed through to unit FormSelect.
 * @param {string}        [table]          - Passed through to unit FormSelect.
 * @param {string}        [unitLabel]      - Passed through to unit FormSelect popup title.
 */
export function FormValueUnit({
    value,
    onValueChange,
    unit,
    onUnitChange,
    unitOptions,
    valuePlaceholder = '0',
    unitPlaceholder  = 'Unit',
    step             = '0.01',
    disabled,
    error,
    editable,
    table,
    unitLabel,
}) {
    return (
        <div className="form-inline">
            <input
                type="number"
                step={step}
                className={`form-input${error ? ' form-input--error' : ''}`}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                placeholder={valuePlaceholder}
                disabled={disabled}
            />
            <FormSelect
                value={unit}
                onChange={onUnitChange}
                options={unitOptions}
                placeholder={unitPlaceholder}
                disabled={disabled}
                editable={editable}
                table={table}
                label={unitLabel}
                className="form-select--unit"
            />
        </div>
    );
}

// ─── FormEAVRow ───────────────────────────────────────────────────────────────

/**
 * A managed list of key-value attribute pairs for EAV custom fields.
 * Renders an add button and a row per attribute with remove capability.
 * Calls onChange with the full updated array on every change.
 *
 * @param {Array<{ key: string, value: string }>} attributes  - Current list.
 * @param {Function}                              onChange     - Called with updated array.
 * @param {boolean}                               [disabled]
 */
export function FormEAVRow({ attributes, onChange, disabled }) {
    const add = () => {
        onChange([...attributes, { key: '', value: '' }]);
    };

    const remove = (index) => {
        onChange(attributes.filter((_, i) => i !== index));
    };

    const setAttr = (index, field, val) => {
        onChange(attributes.map((attr, i) =>
            i !== index ? attr : { ...attr, [field]: val }
        ));
    };

    return (
        <div>
            {attributes.map((attr, i) => (
                <div key={i} className="form-inline" style={{ marginBottom: '8px' }}>
                    <input
                        className="form-input"
                        value={attr.key}
                        onChange={e => setAttr(i, 'key', e.target.value)}
                        placeholder="Attribute name"
                        disabled={disabled}
                    />
                    <input
                        className="form-input"
                        value={attr.value}
                        onChange={e => setAttr(i, 'value', e.target.value)}
                        placeholder="Value"
                        disabled={disabled}
                    />
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            style={{
                                flexShrink: 0,
                                background: 'none',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                padding: '0 10px',
                                fontSize: '16px',
                                color: '#888',
                                lineHeight: '34px',
                            }}
                            aria-label="Remove attribute"
                        >
                            ×
                        </button>
                    )}
                </div>
            ))}
            {!disabled && (
                <button
                    type="button"
                    onClick={add}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px 2px 0',
                        fontSize: '12px',
                        color: '#0d6efd',
                        cursor: 'pointer',
                        display: 'block',
                    }}
                >
                    + Add attribute
                </button>
            )}
        </div>
    );
}