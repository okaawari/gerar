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
        const error = new Error('Хүсэлтийн бие дэх JSON буруу байна');
        error.statusCode = 400;
        error.code = 'INVALID_JSON';
        error.details = {
            message: err.message || 'Хүсэлтийн бие дэх JSON буруу форматтай байна',
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
 * Validate email format
 * @param {string} email - Email to validate
 */
const validateEmail = (email) => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate user registration data (requires OTP code)
 */
const validateUserRegistration = (req, res, next) => {
    const { phoneNumber, pin, name, email, otpCode } = req.body;
    const errors = [];

    // Check required fields
    if (!phoneNumber) errors.push('Утасны дугаар шаардлагатай');
    if (!pin) errors.push('Пин код шаардлагатай');
    if (!name) errors.push('Нэр шаардлагатай');
    if (!otpCode) errors.push('Нэг удаагийн код шаардлагатай');

    // Validate formats if fields are present
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
        errors.push('Утасны дугаар яг 8 оронтой байх ёстой');
    }

    if (pin && !validatePin(pin)) {
        errors.push('Пин код яг 4 оронтой байх ёстой');
    }

    if (name && (typeof name !== 'string' || name.trim().length === 0)) {
        errors.push('Нэр хоосон байж болохгүй');
    }
    
    // Validate name length (max 50 characters)
    if (name && typeof name === 'string' && name.trim().length > 50) {
        errors.push('Нэр 50 тэмдэгтээс их байж болохгүй');
    }

    // Validate OTP code format (4 digits for registration)
    if (otpCode && !/^\d{4}$/.test(otpCode)) {
        errors.push('Нэг удаагийн код яг 4 оронтой байх ёстой');
    }

    // Email is optional, but if provided, must be valid format
    if (email !== undefined && email !== null && email !== '') {
        if (typeof email !== 'string' || email.trim().length === 0) {
            errors.push('Имэйл хоосон байж болохгүй');
        } else if (!validateEmail(email)) {
            errors.push('Имэйлийн формат буруу байна');
        }
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
    if (!phoneNumber) errors.push('Утасны дугаар шаардлагатай');
    if (!pin) errors.push('Пин код шаардлагатай');

    // Validate formats if fields are present
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
        errors.push('Утасны дугаар яг 8 оронтой байх ёстой');
    }

    if (pin && !validatePin(pin)) {
        errors.push('Пин код яг 4 оронтой байх ёстой');
    }

    if (errors.length > 0) {
        const error = new Error('Баталгаажуулалт амжилтгүй боллоо');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        error.details = { errors };
        return next(error);
    }

    next();
};

/**
 * Validate profile update (name and/or email; at least one required)
 */
const validateProfileUpdate = (req, res, next) => {
    const { name, email } = req.body || {};
    const errors = [];

    const hasName = name !== undefined && name !== null;
    const hasEmail = email !== undefined && email !== null;

    if (!hasName && !hasEmail) {
        errors.push('At least one of name or email is required');
    }

    if (name !== undefined && name !== null) {
        const n = typeof name === 'string' ? name.trim() : '';
        if (n.length === 0) {
            errors.push('Name cannot be empty');
        } else if (n.length > 50) {
            errors.push('Name must be at most 50 characters');
        }
    }

    if (email !== undefined && email !== null && email !== '') {
        const e = typeof email === 'string' ? email.trim() : '';
        if (e.length > 0 && !validateEmail(e)) {
            errors.push('Invalid email format');
        }
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
 * Validate contact info for create order / finalize (fullName, phoneNumber, email)
 * @returns {Object} - { isValid, errors }
 */
const validateOrderContact = (body) => {
    const errors = [];
    const fullName = body?.fullName;
    const phoneNumber = body?.phoneNumber;
    const email = body?.email;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        errors.push('fullName is required and must be at least 2 characters');
    }
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        errors.push('phoneNumber is required');
    } else if (!/^\d{8}$/.test(phoneNumber.trim())) {
        errors.push('phoneNumber must be exactly 8 digits');
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
        errors.push('email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.push('email must be a valid email format');
    }

    return {
        isValid: errors.length === 0,
        errors,
        contact: errors.length === 0 ? {
            fullName: fullName?.trim(),
            phoneNumber: phoneNumber?.trim(),
            email: email?.trim()
        } : null
    };
};

/**
 * Validate deliveryDate (YYYY-MM-DD) and deliveryTimeSlot for create order
 */
const validateOrderDelivery = (body) => {
    const errors = [];
    const deliveryDate = body?.deliveryDate;
    const deliveryTimeSlot = body?.deliveryTimeSlot;
    const validSlots = ['10-14', '14-18', '18-21', '21-00'];

    if (!deliveryDate || typeof deliveryDate !== 'string' || !deliveryDate.trim()) {
        errors.push('deliveryDate is required (YYYY-MM-DD)');
    } else {
        const d = new Date(deliveryDate);
        if (isNaN(d.getTime())) {
            errors.push('deliveryDate must be a valid date (YYYY-MM-DD)');
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        if (d < today) {
            errors.push('deliveryDate must be today or in the future');
        }
    }
    if (!deliveryTimeSlot || typeof deliveryTimeSlot !== 'string') {
        errors.push('deliveryTimeSlot is required');
    } else if (!validSlots.includes(deliveryTimeSlot.trim())) {
        errors.push('deliveryTimeSlot must be one of: 10-14, 14-18, 18-21, 21-00');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    handleJsonErrors,
    validateRequiredFields,
    validatePhoneNumber,
    validatePin,
    validateEmail,
    validateUserRegistration,
    validateUserLogin,
    validateProfileUpdate,
    validateOrderContact,
    validateOrderDelivery
};