/**
 * Delivery time slots - data from DB via constants service (in-memory cache).
 * Ensure loadConstants() has been called at app startup.
 */

const constantsService = require('../services/constantsService');

function getData() {
    return constantsService.getDeliveryTimeSlots();
}

/**
 * Validate if a delivery time slot is valid
 * @param {string} timeSlot - Time slot to validate
 * @returns {boolean} - True if valid
 */
function isValidDeliveryTimeSlot(timeSlot) {
    if (!timeSlot) return false;
    return getData().validSlots.includes(timeSlot);
}

/**
 * Format delivery time slot for display
 * @param {string} timeSlot - Time slot (e.g., "10-14")
 * @returns {string} - Formatted time slot (e.g., "10:00 - 14:00")
 */
function formatDeliveryTimeSlot(timeSlot) {
    if (!timeSlot || !isValidDeliveryTimeSlot(timeSlot)) {
        return timeSlot || '';
    }
    const [start, end] = timeSlot.split('-');
    return `${start}:00 - ${end}:00`;
}

module.exports = {
    get DELIVERY_TIME_SLOTS() {
        return getData().slots;
    },
    get VALID_DELIVERY_TIME_SLOTS() {
        return getData().validSlots;
    },
    isValidDeliveryTimeSlot,
    formatDeliveryTimeSlot
};
