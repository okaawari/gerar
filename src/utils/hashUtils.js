const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hashes a PIN using bcrypt
 * @param {string} pin - The 4-digit PIN to hash
 * @returns {Promise<string>} The hashed PIN
 */
const hashPin = async (pin) => {
    return await bcrypt.hash(pin, SALT_ROUNDS);
};

/**
 * Compares a plain text PIN with a hash
 * @param {string} pin - The plain text PIN
 * @param {string} hash - The hashed PIN
 * @returns {Promise<boolean>} True if match, false otherwise
 */
const comparePin = async (pin, hash) => {
    return await bcrypt.compare(pin, hash);
};

/**
 * Validates PIN format (must be 4 digits)
 * @param {string} pin - The PIN to validate
 * @returns {boolean} True if valid
 */
const validatePin = (pin) => {
    return /^\d{4}$/.test(pin);
};

/**
 * Validates phone number format (must be 8 digits)
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} True if valid
 */
const validatePhoneNumber = (phoneNumber) => {
    return /^\d{8}$/.test(phoneNumber);
};

module.exports = {
    hashPin,
    comparePin,
    validatePin,
    validatePhoneNumber
};
