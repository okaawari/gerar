/**
 * Request validation middleware
 */

/**
 * Middleware to handle JSON parsing errors
 * This catches JSON parsing errors from express.json() middleware
 */
const handleJsonErrors = (err, req, res, next) => {
    // Check if this is a JSON parsing error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        const error = new Error('Invalid JSON in request body');
        error.statusCode = 400;
        error.code = 'INVALID_JSON';
        error.details = {
            message: err.message || 'Malformed JSON in request body',
            originalError: process.env.NODE_ENV === 'development' ? err.message : undefined
        };
        return next(error);
    }
    next(err);
};

/**
 * Validate required fields in request body
 * @param {Array} requiredFields - Array of required field names
 */
const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        // Ensure request body exists
        if (!req.body || typeof req.body !== 'object') {
            const error = new Error('Request body is required');
            error.statusCode = 400;
            error.code = 'MISSING_BODY';
            error.details = { message: 'Request body must be a valid JSON object' };
            return next(error);
        }

        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!req.body || req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
            error.statusCode = 400;
            error.code = 'MISSING_FIELDS';
            error.details = { missingFields };
            return next(error);
        }

        next();
    };
};

/**
 * Validate phone number format (8 digits)
 * @param {string} phoneNumber - Phone number to validate
 */
const validatePhoneNumber = (phoneNumber) => {
    const phoneRegex = /^\d{8}$/;
    return phoneRegex.test(phoneNumber);
};

/**
 * Validate PIN format (4 digits)
 * @param {string} pin - PIN to validate
 */
const validatePin = (pin) => {
    const pinRegex = /^\d{4}$/;
    return pinRegex.test(pin);
};

/**
 * Validate user registration data
 */
const validateUserRegistration = (req, res, next) => {
    const { phoneNumber, pin, name } = req.body;
    const errors = [];

    // Check required fields
    if (!phoneNumber) errors.push('phoneNumber is required');
    if (!pin) errors.push('pin is required');
    if (!name) errors.push('name is required');

    // Validate formats if fields are present
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
        errors.push('phoneNumber must be exactly 8 digits');
    }

    if (pin && !validatePin(pin)) {
        errors.push('pin must be exactly 4 digits');
    }

    if (name && (typeof name !== 'string' || name.trim().length === 0)) {
        errors.push('name must be a non-empty string');
    }

    if (errors.length > 0) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        error.details = { errors };
        return next(error);
    }

    next();
};

/**
 * Validate user login data
 */
const validateUserLogin = (req, res, next) => {
    const { phoneNumber, pin } = req.body;
    const errors = [];

    // Check required fields
    if (!phoneNumber) errors.push('phoneNumber is required');
    if (!pin) errors.push('pin is required');

    // Validate formats if fields are present
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
        errors.push('phoneNumber must be exactly 8 digits');
    }

    if (pin && !validatePin(pin)) {
        errors.push('pin must be exactly 4 digits');
    }

    if (errors.length > 0) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        error.details = { errors };
        return next(error);
    }

    next();
};

module.exports = {
    handleJsonErrors,
    validateRequiredFields,
    validatePhoneNumber,
    validatePin,
    validateUserRegistration,
    validateUserLogin
};