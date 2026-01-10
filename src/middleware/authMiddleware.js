const { verifyToken } = require('../utils/jwtUtils');
const prisma = require('../lib/prisma');

/**
 * Middleware to authenticate requests using JWT
 */
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = verifyToken(token);

            // Optionally verify user still exists in DB
            // This adds a DB call but increases security
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, phoneNumber: true, name: true, role: true }
            });

            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 401;
                throw error;
            }

            req.user = user;
            next();
        } catch (err) {
            const error = new Error('Invalid or expired token');
            error.statusCode = 401;
            throw error;
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to optionally authenticate requests using JWT
 * If token is present and valid, sets req.user
 * If token is missing or invalid, continues without setting req.user (no error)
 */
const optionallyAuthenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided, continue without authentication
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = verifyToken(token);

            // Optionally verify user still exists in DB
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, phoneNumber: true, name: true, role: true }
            });

            if (user) {
                req.user = user;
            }
            // If user not found, continue without req.user (no error)
            next();
        } catch (err) {
            // Invalid token, continue without authentication (no error)
            next();
        }
    } catch (error) {
        // Any other error, continue without authentication (no error)
        next();
    }
};

/**
 * Middleware to authorize admin only routes
 */
const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        const error = new Error('Access denied. Admin privileges required.');
        error.statusCode = 403;
        next(error);
    }
};

module.exports = {
    authenticateUser,
    optionallyAuthenticateUser,
    authorizeAdmin
};
