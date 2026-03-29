import React, { useState } from 'react';

function AddWeightRecord({ cowTag: propCowTag, eventId: propEventId = null, onSuccess, onCancel }) {
    const [cowTag, setCowTag] = useState(propCowTag || '');
    const [weight, setWeight] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const cowTagLocked = propCowTag !== undefined && propCowTag !== null;

    const handleSubmit = async () => {
        if (!cowTag.trim()) {
            setError('Cow tag is required.');
            return;
        }
        if (!weight || isNaN(weight) || parseInt(weight) <= 0) {
            setError('A valid weight is required.');
            return;
        }

        setError('');
        setSubmitting(true);

        try {
            const response = await fetch('/api/cow/weight', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cowTag,
                    Weight:       parseInt(weight),
                    TimeRecorded: date,
                    EventID:      propEventId ?? null,
                    Notes:        notes.trim() || null
                })
            });

            if (response.ok) {
                onSuccess?.();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to create weight record.');
            }
        } catch (err) {
            console.error('Error creating weight record:', err);
            setError('An unexpected error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    const lockedStyle = {
        backgroundColor: '#f0f0f0',
        color: '#888',
        cursor: 'not-allowed',
        border: '1px solid #ddd'
    };

    const inputStyle = {
        width: '100%',
        padding: '7px 10px',
        fontSize: '14px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
        fontSize: '14px'
    };

    const fieldStyle = {
        marginBottom: '15px'
    };

    return (
        <div style={{ padding: '20px' }}>

            {/* Cow Tag */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    Cow Tag
                </label>
                <input
                    type="text"
                    value={cowTag}
                    onChange={(e) => !cowTagLocked && setCowTag(e.target.value)}
                    disabled={cowTagLocked}
                    placeholder="Enter cow tag..."
                    style={{ ...inputStyle, ...(cowTagLocked ? lockedStyle : {}) }}
                />
            </div>

            {/* Weight */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    Weight (lbs)
                </label>
                <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Enter weight..."
                    min="1"
                    style={inputStyle}
                />
            </div>

            {/* Date */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    Date
                </label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputStyle}
                />
            </div>

            {/* Notes */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    Notes
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter any notes... (optional)"
                    style={{
                        ...inputStyle,
                        minHeight: '70px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                    }}
                />
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    marginBottom: '15px',
                    color: '#c62828',
                    fontSize: '13px',
                    backgroundColor: '#ffebee',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ef9a9a'
                }}>
                    {error}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                    onClick={onCancel}
                    disabled={submitting}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        backgroundColor: '#b4b2b2',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: submitting ? '#aaa' : '#4CAF50',
                        color: 'white',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {submitting ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}

export default AddWeightRecord;