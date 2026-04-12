/**
 * Convert a local date string (YYYY-MM-DD) or Date object to a UTC ISO string
 * for submission to the API.
 * @param {string|Date|null} dateStr
 * @returns {string|null}
 */
export const toUTC = (dateStr) => {
    if (!dateStr) return null;
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return d.toISOString();
};

/**
 * Convert a UTC date string from the API to a localized display string.
 * Use for rendering dates in text, labels, or read-only fields.
 * @param {string|null} dateStr
 * @returns {string}
 */
export const toLocalDisplay = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : '';

/**
 * Convert a UTC date string from the API to a YYYY-MM-DD string
 * for use in <input type="date"> elements.
 * @param {string|null} dateStr
 * @returns {string}
 */
export const toLocalInput = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
};