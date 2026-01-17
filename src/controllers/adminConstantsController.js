const fs = require('fs');
const path = require('path');

const deliveryTimeSlots = require('../constants/deliveryTimeSlots');
const districts = require('../constants/districts');

const DELIVERY_TIME_SLOTS_PATH = path.join(__dirname, '../constants/deliveryTimeSlots.js');
const DISTRICTS_PATH = path.join(__dirname, '../constants/districts.js');

const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isValidIdentifier = (value) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const escapeDoubleQuotedString = (value) => {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const escapeSingleQuotedString = (value) => {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
};

const validateTimeSlotValue = (value) => {
    if (typeof value !== 'string') {
        return 'Time slot values must be strings.';
    }

    const match = value.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!match) {
        return 'Time slot format must be "HH-HH" (e.g., "10-14").';
    }

    const start = Number(match[1]);
    const end = Number(match[2]);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return 'Time slot hours must be integers.';
    }

    if (start < 0 || start > 24 || end < 0 || end > 24) {
        return 'Time slot hours must be between 0 and 24.';
    }

    return null;
};

const buildDeliveryTimeSlotsFile = (slots) => {
    const lines = [];
    const entries = Object.entries(slots);

    entries.forEach(([key, value], index) => {
        const formattedKey = isValidIdentifier(key)
            ? key
            : `"${escapeDoubleQuotedString(key)}"`;
        const formattedValue = `"${escapeDoubleQuotedString(value)}"`;
        const suffix = index === entries.length - 1 ? '' : ',';
        lines.push(`  ${formattedKey}: ${formattedValue}${suffix}`);
    });

    return [
        'const DELIVERY_TIME_SLOTS = {',
        ...lines,
        '};',
        '',
        'const VALID_DELIVERY_TIME_SLOTS = Object.values(DELIVERY_TIME_SLOTS);',
        '',
        '/**',
        ' * Validate if a delivery time slot is valid',
        ' * @param {string} timeSlot - Time slot to validate',
        ' * @returns {boolean} - True if valid',
        ' */',
        'const isValidDeliveryTimeSlot = (timeSlot) => {',
        '  if (!timeSlot) return false;',
        '  return VALID_DELIVERY_TIME_SLOTS.includes(timeSlot);',
        '};',
        '',
        '/**',
        ' * Format delivery time slot for display',
        ' * @param {string} timeSlot - Time slot (e.g., "10-14")',
        ' * @returns {string} - Formatted time slot (e.g., "10:00 - 14:00")',
        ' */',
        'const formatDeliveryTimeSlot = (timeSlot) => {',
        '  if (!timeSlot || !isValidDeliveryTimeSlot(timeSlot)) {',
        '    return timeSlot || \'\';',
        '  }',
        '  const [start, end] = timeSlot.split(\'-\');',
        '  return `${start}:00 - ${end}:00`;',
        '};',
        '',
        'module.exports = {',
        '  DELIVERY_TIME_SLOTS,',
        '  VALID_DELIVERY_TIME_SLOTS,',
        '  isValidDeliveryTimeSlot,',
        '  formatDeliveryTimeSlot',
        '};',
        ''
    ].join('\n');
};

const buildDistrictsFile = (districtsMap) => {
    const lines = [];
    const entries = Object.entries(districtsMap);

    entries.forEach(([key, value], index) => {
        const formattedKey = `'${escapeSingleQuotedString(key)}'`;
        const formattedValue = Number(value);
        const suffix = index === entries.length - 1 ? '' : ',';
        lines.push(`  ${formattedKey}: ${formattedValue}${suffix}`);
    });

    return [
        '/**',
        ' * Districts (provinceOrDistrict) and their corresponding khoroo counts',
        ' * Each district has a specific number of khoroo options',
        ' */',
        'const DISTRICTS = {',
        ...lines,
        '};',
        '',
        '/**',
        ' * Get list of all districts',
        ' * @returns {Array<string>} - Array of district names',
        ' */',
        'const getDistricts = () => {',
        '  return Object.keys(DISTRICTS);',
        '};',
        '',
        '/**',
        ' * Get number of khoroo for a specific district',
        ' * @param {string} district - District name',
        ' * @returns {number|null} - Number of khoroo or null if district not found',
        ' */',
        'const getKhorooCount = (district) => {',
        '  return DISTRICTS[district] || null;',
        '};',
        '',
        '/**',
        ' * Check if a district is valid',
        ' * @param {string} district - District name to validate',
        ' * @returns {boolean} - True if valid',
        ' */',
        'const isValidDistrict = (district) => {',
        '  return district && DISTRICTS.hasOwnProperty(district);',
        '};',
        '',
        '/**',
        ' * Generate khoroo options for a district',
        ' * @param {string} district - District name',
        ' * @returns {Array<string>} - Array of khoroo options (e.g., ["1-р хороо", "2-р хороо", ...])',
        ' */',
        'const getKhorooOptions = (district) => {',
        '  if (!isValidDistrict(district)) {',
        '    return [];',
        '  }',
        '',
        '  const count = DISTRICTS[district];',
        '  const options = [];',
        '',
        '  for (let i = 1; i <= count; i++) {',
        '    options.push(`${i}-р хороо`);',
        '  }',
        '',
        '  return options;',
        '};',
        '',
        '/**',
        ' * Check if a khoroo is valid for a specific district',
        ' * @param {string} district - District name',
        ' * @param {string} khoroo - Khoroo value (e.g., "1-р хороо")',
        ' * @returns {boolean} - True if valid',
        ' */',
        'const isValidKhorooForDistrict = (district, khoroo) => {',
        '  if (!isValidDistrict(district) || !khoroo) {',
        '    return false;',
        '  }',
        '',
        '  // Extract number from khoroo string (e.g., "1-р хороо" -> 1)',
        '  const match = khoroo.match(/^(\\d+)-р хороо$/);',
        '  if (!match) {',
        '    return false;',
        '  }',
        '',
        '  const khorooNumber = parseInt(match[1], 10);',
        '  const maxKhoroo = DISTRICTS[district];',
        '',
        '  return khorooNumber >= 1 && khorooNumber <= maxKhoroo;',
        '};',
        '',
        'module.exports = {',
        '  DISTRICTS,',
        '  getDistricts,',
        '  getKhorooCount,',
        '  isValidDistrict,',
        '  getKhorooOptions,',
        '  isValidKhorooForDistrict',
        '};',
        ''
    ].join('\n');
};

const getDeliveryTimeSlots = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            slots: deliveryTimeSlots.DELIVERY_TIME_SLOTS,
            validSlots: deliveryTimeSlots.VALID_DELIVERY_TIME_SLOTS
        }
    });
};

const updateDeliveryTimeSlots = (req, res, next) => {
    try {
        const { slots } = req.body;

        if (!isPlainObject(slots)) {
            const error = new Error('Request body must include a slots object.');
            error.statusCode = 400;
            throw error;
        }

        const entries = Object.entries(slots);
        if (entries.length === 0) {
            const error = new Error('Slots object cannot be empty.');
            error.statusCode = 400;
            throw error;
        }

        for (const [key, value] of entries) {
            if (RESERVED_KEYS.has(key)) {
                const error = new Error(`Invalid slot key: ${key}`);
                error.statusCode = 400;
                throw error;
            }

            if (typeof key !== 'string' || !key.trim()) {
                const error = new Error('Slot keys must be non-empty strings.');
                error.statusCode = 400;
                throw error;
            }

            const validationError = validateTimeSlotValue(value);
            if (validationError) {
                const error = new Error(validationError);
                error.statusCode = 400;
                throw error;
            }
        }

        const currentSlots = deliveryTimeSlots.DELIVERY_TIME_SLOTS;
        Object.keys(currentSlots).forEach((slotKey) => {
            delete currentSlots[slotKey];
        });

        entries.forEach(([key, value]) => {
            currentSlots[key] = value;
        });

        const validSlots = deliveryTimeSlots.VALID_DELIVERY_TIME_SLOTS;
        validSlots.splice(0, validSlots.length, ...Object.values(currentSlots));

        const fileContent = buildDeliveryTimeSlotsFile(currentSlots);
        fs.writeFileSync(DELIVERY_TIME_SLOTS_PATH, fileContent, 'utf8');

        res.status(200).json({
            success: true,
            message: 'Delivery time slots updated successfully.',
            data: {
                slots: currentSlots,
                validSlots
            }
        });
    } catch (error) {
        next(error);
    }
};

const getDistricts = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            districts: districts.DISTRICTS
        }
    });
};

const updateDistricts = (req, res, next) => {
    try {
        const { districts: districtsPayload } = req.body;

        if (!isPlainObject(districtsPayload)) {
            const error = new Error('Request body must include a districts object.');
            error.statusCode = 400;
            throw error;
        }

        const entries = Object.entries(districtsPayload);
        if (entries.length === 0) {
            const error = new Error('Districts object cannot be empty.');
            error.statusCode = 400;
            throw error;
        }

        for (const [key, value] of entries) {
            if (RESERVED_KEYS.has(key)) {
                const error = new Error(`Invalid district key: ${key}`);
                error.statusCode = 400;
                throw error;
            }

            if (typeof key !== 'string' || !key.trim()) {
                const error = new Error('District names must be non-empty strings.');
                error.statusCode = 400;
                throw error;
            }

            if (!Number.isInteger(value) || value <= 0) {
                const error = new Error(`Khoroo count for "${key}" must be a positive integer.`);
                error.statusCode = 400;
                throw error;
            }
        }

        const currentDistricts = districts.DISTRICTS;
        Object.keys(currentDistricts).forEach((districtKey) => {
            delete currentDistricts[districtKey];
        });

        entries.forEach(([key, value]) => {
            currentDistricts[key] = value;
        });

        const fileContent = buildDistrictsFile(currentDistricts);
        fs.writeFileSync(DISTRICTS_PATH, fileContent, 'utf8');

        res.status(200).json({
            success: true,
            message: 'Districts updated successfully.',
            data: {
                districts: currentDistricts
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDeliveryTimeSlots,
    updateDeliveryTimeSlots,
    getDistricts,
    updateDistricts
};
