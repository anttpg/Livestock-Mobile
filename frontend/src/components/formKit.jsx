import React from 'react';
import { useState, useRef } from 'react';

/**
 * Handles the repetitive submit lifecycle shared across all forms:
 * validation, scroll-to-first-error, submitting state, and API error surfacing.
 *
 * The caller owns formData state and provides two closures:
 *   - validate()  — returns an errors object; empty object means valid.
 *   - submit()    — async fn that performs the fetch(es). Should throw with a
 *                   meaningful message on failure; the hook catches and alerts.
 *
 * @param {Object}           options
 * @param {() => Object}     options.validate   - Returns { fieldName: 'message', ... }
 * @param {() => Promise}    options.submit     - Performs the actual API call(s)
 * @param {() => void}       [options.onSuccess]
 *
 * @returns {{
 *   handleSubmit: (e: Event) => Promise<void>,
 *   errors:       Object,
 *   setErrors:    Function,
 *   submitting:   boolean,
 *   topRef:       React.RefObject
 * }}
 */
export function useFormSubmit({ validate, submit, onSuccess }) {
    const topRef = useRef(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();

        const errs = validate();
        setErrors(errs);

        if (Object.keys(errs).length > 0) {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        setSubmitting(true);
        try {
            await submit();
            onSuccess?.();
        } catch (err) {
            alert(err.message || 'An unexpected error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    return { handleSubmit, errors, setErrors, submitting, topRef };
}



/**
 * Wraps any input with a consistent label, required marker, and error message.
 * CSS lives in ../styles/forms.css.
 *
 * @param {string}    label
 * @param {boolean}   [required]
 * @param {string}    [error]    - Shown in red below the input when non-empty.
 * @param {string}    [hint]     - Shown in grey below the input when no error.
 * @param {ReactNode} children   - The actual input element.
 */
export function FormField({ label, required, error, hint, children }) {
    return (
        <div className="form-field">
            <label className="form-label">
                {label}
                {required && <span className="form-required"> *</span>}
            </label>
            {children}
            {error && <div className="form-error">{error}</div>}
            {!error && hint && <div className="form-hint">{hint}</div>}
        </div>
    );
}
