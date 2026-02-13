/**
 * Districts (provinceOrDistrict) and khoroo counts - data from DB via constants service (in-memory cache).
 * Ensure loadConstants() has been called at app startup.
 */

const constantsService = require('../services/constantsService');

function getDistrictsMap() {
    return constantsService.getDistricts();
}

/**
 * Get list of all districts
 * @returns {Array<string>} - Array of district names
 */
function getDistricts() {
    return Object.keys(getDistrictsMap());
}

/**
 * Get number of khoroo for a specific district
 * @param {string} district - District name
 * @returns {number|null} - Number of khoroo or null if district not found
 */
function getKhorooCount(district) {
    const map = getDistrictsMap();
    return map[district] ?? null;
}

/**
 * Check if a district is valid
 * @param {string} district - District name to validate
 * @returns {boolean} - True if valid
 */
function isValidDistrict(district) {
    return district != null && Object.prototype.hasOwnProperty.call(getDistrictsMap(), district);
}

/**
 * Generate khoroo options for a district
 * @param {string} district - District name
 * @returns {Array<string>} - Array of khoroo options (e.g., ["1-р хороо", "2-р хороо", ...])
 */
function getKhorooOptions(district) {
    if (!isValidDistrict(district)) return [];
    const count = getDistrictsMap()[district];
    const options = [];
    for (let i = 1; i <= count; i++) {
        options.push(`${i}-р хороо`);
    }
    return options;
}

/**
 * Check if a khoroo is valid for a specific district
 * @param {string} district - District name
 * @param {string} khoroo - Khoroo value (e.g., "1-р хороо")
 * @returns {boolean} - True if valid
 */
function isValidKhorooForDistrict(district, khoroo) {
    if (!isValidDistrict(district) || !khoroo) return false;
    const match = khoroo.match(/^(\d+)-р хороо$/);
    if (!match) return false;
    const khorooNumber = parseInt(match[1], 10);
    const maxKhoroo = getDistrictsMap()[district];
    return khorooNumber >= 1 && khorooNumber <= maxKhoroo;
}

module.exports = {
    get DISTRICTS() {
        return getDistrictsMap();
    },
    getDistricts,
    getKhorooCount,
    isValidDistrict,
    getKhorooOptions,
    isValidKhorooForDistrict
};
