import React, { useState } from 'react';
import { FormField } from './formKit';
import '../styles/forms.css';


function StylingForm({ onClose }) {
    const [fields, setFields] = useState({
        date:      '',
        select:    '',
        inputLine: '',
        textarea:  '',
        value:     '',
        unit:      '',
        eavKey:    '',
        eavValue:  '',
    });

    const [submitted, setSubmitted] = useState(false);

    const set = (field, value) => setFields(prev => ({ ...prev, [field]: value }));

    // Force error state on the first field to test red highlight
    const errors = submitted && !fields.inputLine
        ? { inputLine: 'This field is required' }
        : {};

    return (
        <form
            onSubmit={e => { e.preventDefault(); setSubmitted(true); }}
            noValidate
        >
            <div className="form-grid">
                <div className="form-col">
                    <div className="form-section-title">Input Types</div>

                    {/* Date selector */}
                    <FormField label="Date Selector" hint="type=date">
                        <input
                            type="date"
                            className="form-input"
                            value={fields.date}
                            onChange={e => set('date', e.target.value)}
                        />
                    </FormField>

                    {/* Select box */}
                    <FormField label="Select Box" hint="dropdown from options">
                        <select
                            className="form-select"
                            value={fields.select}
                            onChange={e => set('select', e.target.value)}
                        >
                            <option value="">Select an option...</option>
                            <option value="a">Option A</option>
                            <option value="b">Option B</option>
                            <option value="c">Option C</option>
                        </select>
                    </FormField>

                    {/* Input line */}
                    <FormField label="Input Line" required error={errors.inputLine} hint="single-line text">
                        <input
                            className={`form-input${errors.inputLine ? ' form-input--error' : ''}`}
                            value={fields.inputLine}
                            onChange={e => set('inputLine', e.target.value)}
                            placeholder="Single line input"
                        />
                    </FormField>

                    {/* Input large / textarea */}
                    <FormField label="Input Large" hint="multiline textarea">
                        <textarea
                            className="form-textarea"
                            rows={4}
                            value={fields.textarea}
                            onChange={e => set('textarea', e.target.value)}
                            placeholder="Multiline text..."
                        />
                    </FormField>
                </div>

                <div className="form-col">
                    <div className="form-section-title">Paired Inputs</div>

                    {/* Value + Unit on one line */}
                    <FormField label="Value + Unit" hint="inline pair">
                        <div className="form-inline">
                            <input
                                type="number"
                                className="form-input"
                                value={fields.value}
                                onChange={e => set('value', e.target.value)}
                                placeholder="0"
                            />
                            <select
                                className="form-select form-select--unit"
                                value={fields.unit}
                                onChange={e => set('unit', e.target.value)}
                            >
                                <option value="">Unit</option>
                                <option value="miles">Miles</option>
                                <option value="hours">Hours</option>
                                <option value="lbs">Lbs</option>
                            </select>
                        </div>
                    </FormField>

                    {/* Key + Value (EAV) on one line */}
                    <FormField label="Key + Value" hint="EAV attribute pair">
                        <div className="form-inline">
                            <input
                                className="form-input"
                                value={fields.eavKey}
                                onChange={e => set('eavKey', e.target.value)}
                                placeholder="Attribute name"
                            />
                            <input
                                className="form-input"
                                value={fields.eavValue}
                                onChange={e => set('eavValue', e.target.value)}
                                placeholder="Value"
                            />
                        </div>
                    </FormField>

                    <div className="form-section-title" style={{ marginTop: '20px' }}>States</div>

                    {/* Disabled */}
                    <FormField label="Disabled Input" hint="locked / read-only">
                        <input
                            className="form-input"
                            value="Cannot edit this"
                            disabled
                            readOnly
                        />
                    </FormField>

                    {/* Forced error state */}
                    <FormField label="Error State" error="Something is wrong with this field">
                        <input
                            className="form-input form-input--error"
                            defaultValue="Bad value"
                        />
                    </FormField>

                    {/* Warning state */}
                    <FormField label="Warning State" hint="e.g. unknown tag entered">
                        <input
                            className="form-input form-input--warning"
                            defaultValue="Unrecognized entry"
                        />
                    </FormField>
                </div>
            </div>

            <div className="form-actions">
                <button
                    type="button"
                    className="button button--secondary"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button type="submit" className="button">
                    Test Submit (triggers error state)
                </button>
            </div>
        </form>
    );
}

export default StylingForm;