const DELIVERY_TIME_SLOTS = {
  MORNING: "10-14",
  AFTERNOON: "14-18",
  EVENING: "18-21",
  NIGHT: "21-00"
};

const VALID_DELIVERY_TIME_SLOTS = Object.values(DELIVERY_TIME_SLOTS);

/**
 * Validate if a delivery time slot is valid
 * @param {string} timeSlot - Time slot to validate
 * @returns {boolean} - True if valid
 */
const isValidDeliveryTimeSlot = (timeSlot) => {
  if (!timeSlot) return false;
  return VALID_DELIVERY_TIME_SLOTS.includes(timeSlot);
};

/**
 * Format delivery time slot for display
 * @param {string} timeSlot - Time slot (e.g., "10-14")
 * @returns {string} - Formatted time slot (e.g., "10:00 - 14:00")
 */
const formatDeliveryTimeSlot = (timeSlot) => {
  if (!timeSlot || !isValidDeliveryTimeSlot(timeSlot)) {
    return timeSlot || '';
  }
  const [start, end] = timeSlot.split('-');
  return `${start}:00 - ${end}:00`;
};

module.exports = {
  DELIVERY_TIME_SLOTS,
  VALID_DELIVERY_TIME_SLOTS,
  isValidDeliveryTimeSlot,
  formatDeliveryTimeSlot
};
