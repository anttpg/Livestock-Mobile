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

/**
 * Format a UTC date string for long-form display.
 * e.g. "May 1, 2026"
 */
export const toLocalDisplayLong = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Add n days to a date string and return a value safe for <input type="date">.
 */
export const addDays = (dateStr, n) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toLocalInput(d.toISOString());
};


/**
 * Calculate age from a birthdate string as a human-readable string.
 * Returns years if >= 1 year, otherwise months.
 * e.g. "2 years" or "8 months"
 */
export const toAge = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months >= 12) return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''}`;
    return `${months} month${months !== 1 ? 's' : ''}`;
};

/**
 * Format a date string as MM/YYYY.
 * e.g. "05/2024"
 */
export const toLocalMonthYear = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};