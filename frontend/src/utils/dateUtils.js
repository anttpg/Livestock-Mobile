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
 * @param {string|null} dateStr
 * @returns {string}
 */
export const toLocalDisplayLong = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Add n days to a date string and return a value safe for <input type="date">.
 * @param {string|null} dateStr
 * @param {number} n
 * @returns {string}
 */
export const addDays = (dateStr, n) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toLocalInput(d.toISOString());
};

/**
 * Calculate age from a birthdate string as a human-readable string.
 * Returns years if >= 1 year, months if >= 60 days, otherwise days.
 * e.g. "2 years", "8 months", or "34 days"
 * @param {string|null} dateStr
 * @returns {string}
 */
export const toAge = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const days = Math.floor((now - d) / 86_400_000);
    if (days < 60) return `${days} day${days !== 1 ? 's' : ''}`;
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''}`;
};

/**
 * Format a date string as MM/YYYY.
 * e.g. "05/2024"
 * @param {string|null} dateStr
 * @returns {string}
 */
export const toLocalMonthYear = (dateStr) => {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};


/**
 * Format a date value as MM/DD/YYYY for use in table cells and read-only display.
 * Returns '' for null/undefined.
 * @param {string|Date|null} d
 * @returns {string}
 */
export function formatDateDisplay(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * Returns the age in whole months from a birthdate to today.
 * Returns null if empty.
 */
export function ageInMonths(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}