/**
 * Date utilities for Mongolian timezone (Asia/Ulaanbaatar, UTC+8).
 * Use these when timestamps or date parts should follow Mongolian local time.
 */

const MONGOLIA_TZ = 'Asia/Ulaanbaatar';

/**
 * Get current date parts (year, month, day) in Mongolian timezone.
 * Use for order ID prefix and any date that should be "today" in Mongolia.
 * @returns {{ year: string, month: string, day: string }}
 */
function getMongoliaDateParts() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: MONGOLIA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type).value;
    return {
        year: get('year'),
        month: get('month'),
        day: get('day')
    };
}

/**
 * Get current timestamp as ISO-like string in Mongolian time (UTC+8).
 * Use for logs and display so timestamps match Mongolian timeline.
 * @returns {string} e.g. "2026-01-30T17:01:50+08:00"
 */
function getMongoliaTimestampISO() {
    return formatInMongoliaTime(new Date());
}

/**
 * Format a date in Mongolian timezone (ISO-like string with +08:00).
 * @param {Date|string|number} [date=new Date()] - Date to format
 * @returns {string} e.g. "2026-01-30T17:01:50+08:00"
 */
function formatInMongoliaTime(date = new Date()) {
    if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
    }
    const str = date.toLocaleString('sv-SE', { timeZone: MONGOLIA_TZ });
    return str.replace(' ', 'T') + '+08:00';
}

module.exports = {
    MONGOLIA_TZ,
    getMongoliaDateParts,
    getMongoliaTimestampISO,
    formatInMongoliaTime
};
