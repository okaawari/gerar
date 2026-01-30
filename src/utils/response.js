/**
 * Response utility functions for consistent API responses
 */
const { formatInMongoliaTime } = require('./dateUtils');

/**
 * Format a date to ISO 8601 format in Mongolian timezone (UTC+8)
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO 8601 formatted date string e.g. "2026-01-30T17:01:50+08:00"
 */
const formatTimestamp = (date = new Date()) => {
    return formatInMongoliaTime(date);
};

/**
 * Create pagination metadata object
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata object
 */
const createPaginationMeta = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    return {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
};

/**
 * Send a successful response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Operation successful', statusCode = 200) => {
    const response = {
        success: true,
        message,
        timestamp: formatTimestamp()
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send a successful response with pagination
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccessWithPagination = (res, data, pagination, message = 'Operation successful', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        pagination,
        message,
        timestamp: formatTimestamp()
    });
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details
 */
const sendError = (res, code, message, statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: {
            code,
            message
        },
        timestamp: formatTimestamp()
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
};

/**
 * Create a custom error object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 */
const createError = (message, statusCode = 500, code = 'INTERNAL_ERROR') => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

/**
 * Sanitize user object to remove sensitive information
 * @param {Object} user - User object to sanitize
 * @returns {Object} Sanitized user object without sensitive fields
 */
const sanitizeUser = (user) => {
    if (!user || typeof user !== 'object') {
        return user;
    }

    const sanitized = { ...user };
    // Remove sensitive fields
    delete sanitized.pin;
    delete sanitized.password;
    delete sanitized.passwordHash;
    
    return sanitized;
};

module.exports = {
    formatTimestamp,
    createPaginationMeta,
    sendSuccess,
    sendSuccessWithPagination,
    sendError,
    createError,
    sanitizeUser
};