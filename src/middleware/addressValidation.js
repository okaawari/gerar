const addressService = require('../services/addressService');

/**
 * Validate address creation data
 */
const validateAddressCreation = (req, res, next) => {
    const validation = addressService.validateAddress(req.body);
    
    if (!validation.isValid) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        error.details = { errors: validation.errors };
        return next(error);
    }
    
    next();
};

/**
 * Validate address update data
 */
const validateAddressUpdate = (req, res, next) => {
    // For updates, all fields are optional, but if provided, they must be valid
    const validation = addressService.validateAddress(req.body);
    
    if (!validation.isValid) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        error.details = { errors: validation.errors };
        return next(error);
    }
    
    next();
};

module.exports = {
    validateAddressCreation,
    validateAddressUpdate
};
