/**
 * Global error handling middleware
 * Catches all errors and formats them consistently
 */
const { formatTimestamp } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    // CRITICAL: Log to stderr (Passenger captures stderr)
    // Use multiple console.error calls to ensure all parts are logged
    process.stderr.write('\n');
    process.stderr.write('='.repeat(80) + '\n');
    process.stderr.write('ERROR HANDLED: ' + new Date().toISOString() + '\n');
    process.stderr.write('Error Message: ' + (err.message || 'No message') + '\n');
    process.stderr.write('Error Code: ' + (err.code || 'No code') + '\n');
    process.stderr.write('Status Code: ' + (err.statusCode || 500) + '\n');
    process.stderr.write('Error Name: ' + (err.name || 'Error') + '\n');
    process.stderr.write('Request URL: ' + (req.originalUrl || 'Unknown') + '\n');
    process.stderr.write('Request Method: ' + (req.method || 'Unknown') + '\n');
    if (err.stack) {
        process.stderr.write('Stack Trace:\n' + err.stack + '\n');
    }
    if (err.originalError && err.originalError.stack) {
        process.stderr.write('Original Error Stack:\n' + err.originalError.stack + '\n');
    }
    process.stderr.write('='.repeat(80) + '\n');
    process.stderr.write('\n');
    
    // Also use console.error as backup
    console.error('ERROR:', err);
    if (err.stack) {
        console.error('STACK:', err.stack);
    }

    // Default error values - ALWAYS preserve original message unless it's truly generic
    let statusCode = err.statusCode || 500;
    let errorCode = err.code || 'INTERNAL_ERROR';
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    
    // Prisma errors
    if (err.code && err.code.startsWith('P')) {
        // Don't override statusCode if it's already set (e.g., 409, 429, etc.)
        if (!err.statusCode) {
            statusCode = 400;
        }
        errorCode = err.code || 'DATABASE_ERROR';
        
        // Handle specific Prisma errors
        if (err.code === 'P2002') {
            statusCode = err.statusCode || 409;
            errorCode = 'DUPLICATE_ENTRY';
            // Preserve original message if it's more specific
            if (!err.message || err.message.includes('Unique constraint') || err.message.includes('already exists')) {
                // Keep generic message only if original is generic
                if (!err.message || err.message.includes('Unique constraint')) {
                    message = err.message || 'A record with this value already exists';
                } else {
                    message = err.message;
                }
            } else {
                message = err.message;
            }
        } else if (err.code === 'P2025') {
            statusCode = err.statusCode || 404;
            errorCode = 'NOT_FOUND';
            if (!err.message || err.message.includes('Record to') || err.message.includes('An operation failed')) {
                message = err.message || 'Record not found';
            } else {
                message = err.message;
            }
        } else {
            // Preserve ALL specific error messages - only replace truly generic ones
            if (!err.message || 
                (err.message.toLowerCase().includes('prisma') && 
                 !err.message.includes('Data too long') && 
                 !err.message.includes('value too long') &&
                 !err.message.includes('constraint') &&
                 err.message.length < 50)) {
                // Only replace very short generic messages
                message = 'Database operation failed';
            } else {
                // Always preserve specific error messages
                message = err.message;
            }
        }
    }

    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        statusCode = 400;
        errorCode = 'INVALID_JSON';
        message = 'Invalid JSON in request body';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorCode = 'INVALID_TOKEN';
        message = 'Invalid authentication token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorCode = 'TOKEN_EXPIRED';
        message = 'Authentication token has expired';
    }

    // Validation errors
    if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
        statusCode = err.statusCode || 400;
        errorCode = 'VALIDATION_ERROR';
        // Preserve original message, especially if it has details
        if (err.details && err.details.errors && Array.isArray(err.details.errors)) {
            // Use the first error message or the main message
            message = err.details.errors[0] || err.message || 'Validation failed';
        } else if (err.message && err.message !== 'Validation failed') {
            // Preserve specific validation messages
            message = err.message;
        }
    }

    // Build error response
    // Include both top-level message (for test compatibility) and nested error.message
    const errorResponse = {
        success: false,
        message: message, // Top-level message for test compatibility
        error: {
            code: errorCode,
            message: message
        },
        timestamp: formatTimestamp()
    };

    // Add additional details if available
    if (err.details) {
        errorResponse.error.details = err.details;
        // For validation errors, include the errors array in the main message if it's more helpful
        if (err.details.errors && Array.isArray(err.details.errors) && err.details.errors.length > 0) {
            // Keep the detailed errors in details, but ensure message is clear
            if (message === 'Validation failed' || !message) {
                message = err.details.errors.join('; ');
                errorResponse.message = message;
                errorResponse.error.message = message;
            }
        }
    }

    // Add stack trace in development mode (or always for debugging)
    if (err.stack && (process.env.NODE_ENV === 'development' || process.env.LOG_STACK_TRACES === 'true')) {
        errorResponse.error.stack = err.stack;
    }

    // Ensure response hasn't been sent already
    if (!res.headersSent) {
        res.status(statusCode).json(errorResponse);
    } else {
        // If headers already sent, log it
        console.error('⚠️ WARNING: Cannot send error response - headers already sent');
    }
};

/**
 * Handle 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route not found: ${req.originalUrl}`);
    error.statusCode = 404;
    error.code = 'ROUTE_NOT_FOUND';
    next(error);
};

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
