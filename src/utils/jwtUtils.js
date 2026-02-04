const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production';
const JWT_EXPIRES_IN = '14d';

/**
 * Generates a JWT token for a user
 * @param {Object} user - The user object
 * @returns {string} The JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * Verifies a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Object} The decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

module.exports = {
    generateToken,
    verifyToken,
    JWT_SECRET
};
