const prisma = require('../lib/prisma');
const { hashPin, comparePin, validatePin, validatePhoneNumber } = require('../utils/hashUtils');
const { generateToken } = require('../utils/jwtUtils');

class AuthService {
    /**
     * Register a new user
     * @param {Object} userData - { phoneNumber, pin, name }
     * @returns {Object} - { user, token }
     */
    async register({ phoneNumber, pin, name }) {
        // 1. Validation
        if (!phoneNumber || !pin || !name) {
            const error = new Error('Phone number, PIN, and name are required');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Invalid phone number format. Must be 8 digits.');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePin(pin)) {
            const error = new Error('Invalid PIN format. Must be 4 digits.');
            error.statusCode = 400;
            throw error;
        }

        // 2. Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (existingUser) {
            const error = new Error('User with this phone number already exists');
            error.statusCode = 409;
            throw error;
        }

        // 3. Hash PIN
        const hashedPin = await hashPin(pin);

        // 4. Create User
        const user = await prisma.user.create({
            data: {
                phoneNumber,
                pin: hashedPin,
                name,
                role: 'USER', // Default role
            },
        });

        // 5. Generate Token
        const token = generateToken(user);

        // Return user without PIN
        const { pin: _, ...userWithoutPin } = user;
        return { user: userWithoutPin, token };
    }

    /**
     * Login a user
     * @param {Object} credentials - { phoneNumber, pin }
     * @returns {Object} - { user, token }
     */
    async login({ phoneNumber, pin }) {
        // 1. Validation
        if (!phoneNumber || !pin) {
            const error = new Error('Phone number and PIN are required');
            error.statusCode = 400;
            throw error;
        }

        // 2. Find User
        const user = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (!user) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // 3. Check PIN
        const isPinValid = await comparePin(pin, user.pin);

        if (!isPinValid) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // 4. Generate Token
        const token = generateToken(user);

        // Return user without PIN
        const { pin: _, ...userWithoutPin } = user;
        return { user: userWithoutPin, token };
    }
}

module.exports = new AuthService();
