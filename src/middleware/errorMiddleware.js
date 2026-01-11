/**
 * Global error handling middleware
 * Catches all errors and formats them consistently
 */
const { formatTimestamp } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    // Log error for debugging - ALWAYS log full details for debugging
    console.error('='.repeat(80));
    console.error('ERROR HANDLED:', new Date().toISOString());
    console.error('Error Message:', err.message);
    console.error('Error Code:', err.code);
    console.error('Status Code:', err.statusCode);
    console.error('Error Name:', err.name);
    console.error('Request URL:', req.originalUrl);
    console.error('Request Method:', req.method);
    if (err.stack) {
        console.error('Stack Trace:', err.stack);
    }
    console.error('='.repeat(80));

    // Default error values
    let statusCode = err.statusCode || 500;
    let errorCode = err.code || 'INTERNAL_ERROR';
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    
    // Prisma errors
    if (err.code && err.code.startsWith('P')) {
        statusCode = 400;
        errorCode = 'DATABASE_ERROR';
        
        // Handle specific Prisma errors
        if (err.code === 'P2002') {
            statusCode = 409;
            errorCode = 'DUPLICATE_ENTRY';
            // Preserve original message if it's more specific
            if (!err.message || err.message.includes('Unique constraint')) {
                message = 'A record with this value already exists';
            }
        } else if (err.code === 'P2025') {
            statusCode = 404;
            errorCode = 'NOT_FOUND';
            if (!err.message || err.message.includes('Record to') || err.message.includes('An operation failed')) {
                message = 'Record not found';
            }
        } else {
            if (!err.message || err.message.includes('prisma') || err.message.includes('Prisma')) {
                message = 'Database operation failed';
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
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
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
