import React from 'react';
import { useState, useRef } from 'react';
import { useUser } from '../UserContext';
import { toUTC } from '../utils/dateUtils';


/**
 * Fetches a record for edit mode and owns the loading/error state.
 * Pass skip=true (or don't call it at all) in add mode.
 *
 * @param {() => Promise<Object>} fetchFn  - Async function that returns the record.
 * @param {boolean}               skip     - When true, does nothing. Use in add mode.
 *
 * @returns {{
 *   data:    Object|null,
 *   loading: boolean,
 *   error:   string|null,
 * }}
 *
 * Usage in a form:
 *   const { data, loading, error } = useFormLoad(
 *       () => fetch(`/api/equipment/${id}`, { credentials: 'include' })
 *                 .then(r => r.json())
 *                 .then(d => d.equipment ?? d),
 *       !isEditing   // skip when adding
 *   );
 *   if (loading) return <FormSkeleton />;
 *   if (error)   return <div className="form-error">{error}</div>;
 *   // proceed with data as initialData
 */
export function useFormLoad(fetchFn, skip = false) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(!skip);
    const [error,   setError]   = useState(null);
 
    useEffect(() => {
        if (skip) return;
        let cancelled = false;
 
        fetchFn()
            .then(result => { if (!cancelled) setData(result); })
            .catch(err   => { if (!cancelled) setError(err.message || 'Failed to load record.'); })
            .finally(()  => { if (!cancelled) setLoading(false); });
 
        return () => { cancelled = true; };
    }, []);
 
    return { data, loading, error };
}




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
            const result = await submit();
            onSuccess?.(result);
        } catch (err) {
            alert(err.message || 'An unexpected error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    return { handleSubmit, errors, setErrors, submitting, topRef };
}



/**
 * Returns record metadata pre-populated for the current user and date.
 * Spread recordMeta into your submit payload — no UI needed.
 *
 * @returns {{ recordMeta: { dateRecorded: string, recordedByUsername: string } }}
 */
export function useRecordMeta() {
    const { user } = useUser();

    const recordMeta = {
        dateRecorded:        toUTC(new Date().toISOString()),
        recordedByUsername:  user?.username ?? '',
    };

    return { recordMeta };
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

/**
 * Converts all empty string values in a flat object to null.
 * @param {Object} obj
 * @returns {Object}
 */
export function nullifyEmpty(obj) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])
    );
}
 