/**
 * Districts (provinceOrDistrict) and their corresponding khoroo counts
 * Each district has a specific number of khoroo options
 */
const DISTRICTS = {
  'Багануур дүүрэг': 5,
  'Баганхангай дүүрэг': 2,
  'Баянгол дүүрэг': 25,
  'Баянзүрх дүүрэг': 25,
  'Налайх дүүрэг': 7,
  'Сонгинохайрхан дүүрэг': 43,
  'Сүхбаатар дүүрэг': 20,
  'Хан-Уул дүүрэг': 21,
  'Чингэлтэй дүүрэг': 19
};

/**
 * Get list of all districts
 * @returns {Array<string>} - Array of district names
 */
const getDistricts = () => {
  return Object.keys(DISTRICTS);
};

/**
 * Get number of khoroo for a specific district
 * @param {string} district - District name
 * @returns {number|null} - Number of khoroo or null if district not found
 */
const getKhorooCount = (district) => {
  return DISTRICTS[district] || null;
};

/**
 * Check if a district is valid
 * @param {string} district - District name to validate
 * @returns {boolean} - True if valid
 */
const isValidDistrict = (district) => {
  return district && DISTRICTS.hasOwnProperty(district);
};

/**
 * Generate khoroo options for a district
 * @param {string} district - District name
 * @returns {Array<string>} - Array of khoroo options (e.g., ["1-р хороо", "2-р хороо", ...])
 */
const getKhorooOptions = (district) => {
  if (!isValidDistrict(district)) {
    return [];
  }

  const count = DISTRICTS[district];
  const options = [];

  for (let i = 1; i <= count; i++) {
    options.push(`${i}-р хороо`);
  }

  return options;
};

/**
 * Check if a khoroo is valid for a specific district
 * @param {string} district - District name
 * @param {string} khoroo - Khoroo value (e.g., "1-р хороо")
 * @returns {boolean} - True if valid
 */
const isValidKhorooForDistrict = (district, khoroo) => {
  if (!isValidDistrict(district) || !khoroo) {
    return false;
  }

  // Extract number from khoroo string (e.g., "1-р хороо" -> 1)
  const match = khoroo.match(/^(\d+)-р хороо$/);
  if (!match) {
    return false;
  }

  const khorooNumber = parseInt(match[1], 10);
  const maxKhoroo = DISTRICTS[district];

  return khorooNumber >= 1 && khorooNumber <= maxKhoroo;
};

module.exports = {
  DISTRICTS,
  getDistricts,
  getKhorooCount,
  isValidDistrict,
  getKhorooOptions,
  isValidKhorooForDistrict
};
