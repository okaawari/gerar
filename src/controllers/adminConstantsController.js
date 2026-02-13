const { getOffDeliveryDatesConfig, setOffDeliveryDatesConfig } = require('../config/offDeliveryDates');
const constantsService = require('../services/constantsService');

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateString = (s) => {
    if (!YYYY_MM_DD_REGEX.test(s)) return false;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10) === s;
};

const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
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

const getDeliveryTimeSlots = (req, res) => {
    const { slots, validSlots } = constantsService.getDeliveryTimeSlots();
    res.status(200).json({
        success: true,
        data: {
            slots,
            validSlots
        }
    });
};

const updateDeliveryTimeSlots = async (req, res, next) => {
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

        const result = await constantsService.updateDeliveryTimeSlots(slots);

        res.status(200).json({
            success: true,
            message: 'Delivery time slots updated successfully.',
            data: {
                slots: result.slots,
                validSlots: result.validSlots
            }
        });
    } catch (error) {
        next(error);
    }
};

const getDistricts = (req, res) => {
    const districtsMap = constantsService.getDistricts();
    res.status(200).json({
        success: true,
        data: {
            districts: districtsMap
        }
    });
};

const updateDistricts = async (req, res, next) => {
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

        const result = await constantsService.updateDistricts(districtsPayload);

        res.status(200).json({
            success: true,
            message: 'Districts updated successfully.',
            data: {
                districts: result
            }
        });
    } catch (error) {
        next(error);
    }
};

const getOffDeliveryDates = (req, res) => {
    const { offWeekdays, offDates, offTimeSlots, offTimeSlotsByDate } = getOffDeliveryDatesConfig();
    res.status(200).json({
        success: true,
        data: {
            offWeekdays,
            offDates,
            offTimeSlots: offTimeSlots || [],
            offTimeSlotsByDate: offTimeSlotsByDate && typeof offTimeSlotsByDate === 'object' ? offTimeSlotsByDate : {}
        }
    });
};

const validateTimeSlotFormat = (value) => /^\d{1,2}-\d{1,2}$/.test(value);

const updateOffDeliveryDates = async (req, res, next) => {
    try {
        const { offWeekdays, offDates, offTimeSlots, offTimeSlotsByDate } = req.body;

        if (!Array.isArray(offWeekdays) || !Array.isArray(offDates)) {
            const error = new Error('Request body must include offWeekdays and offDates arrays.');
            error.statusCode = 400;
            throw error;
        }

        for (let i = 0; i < offWeekdays.length; i++) {
            const n = offWeekdays[i];
            if (!Number.isInteger(n) || n < 0 || n > 6) {
                const error = new Error(`offWeekdays[${i}] must be an integer between 0 and 6 (0=Sunday).`);
                error.statusCode = 400;
                throw error;
            }
        }

        for (let i = 0; i < offDates.length; i++) {
            const s = offDates[i];
            if (typeof s !== 'string' || !isValidDateString(s)) {
                const error = new Error(`offDates[${i}] must be a valid date string in YYYY-MM-DD format.`);
                error.statusCode = 400;
                throw error;
            }
        }

        const offTimeSlotsSanitized = Array.isArray(offTimeSlots) ? offTimeSlots : [];
        for (let i = 0; i < offTimeSlotsSanitized.length; i++) {
            const s = offTimeSlotsSanitized[i];
            if (typeof s !== 'string' || !validateTimeSlotFormat(s)) {
                const error = new Error(`offTimeSlots[${i}] must be a time slot string in "HH-HH" format (e.g. "10-14").`);
                error.statusCode = 400;
                throw error;
            }
        }

        let offTimeSlotsByDateSanitized = {};
        if (offTimeSlotsByDate != null && typeof offTimeSlotsByDate === 'object' && !Array.isArray(offTimeSlotsByDate)) {
            for (const [dateKey, slots] of Object.entries(offTimeSlotsByDate)) {
                if (!isValidDateString(dateKey)) {
                    const error = new Error(`offTimeSlotsByDate key "${dateKey}" must be a valid date in YYYY-MM-DD format.`);
                    error.statusCode = 400;
                    throw error;
                }
                if (!Array.isArray(slots)) {
                    const error = new Error(`offTimeSlotsByDate["${dateKey}"] must be an array of time slot strings.`);
                    error.statusCode = 400;
                    throw error;
                }
                const sanitized = slots.filter((s) => typeof s === 'string' && validateTimeSlotFormat(s));
                if (sanitized.length > 0) offTimeSlotsByDateSanitized[dateKey] = sanitized;
            }
        }

        await setOffDeliveryDatesConfig({
            offWeekdays,
            offDates,
            offTimeSlots: offTimeSlotsSanitized,
            offTimeSlotsByDate: offTimeSlotsByDateSanitized
        });

        res.status(200).json({
            success: true,
            data: {
                offWeekdays,
                offDates,
                offTimeSlots: offTimeSlotsSanitized,
                offTimeSlotsByDate: offTimeSlotsByDateSanitized
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
    updateDistricts,
    getOffDeliveryDates,
    updateOffDeliveryDates
};
