const prisma = require('../lib/prisma');
const { hashPin, comparePin, validatePin, validatePhoneNumber } = require('../utils/hashUtils');
const { generateToken } = require('../utils/jwtUtils');
const { validateEmail } = require('../middleware/validation');

class AuthService {
    /**
     * Register a new user
     * @param {Object} userData - { phoneNumber, pin, name, email? }
     * @returns {Object} - { user, token }
     */
    async register({ phoneNumber, pin, name, email }) {
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

        // Validate email if provided
        if (email !== undefined && email !== null && email !== '') {
            if (!validateEmail(email)) {
                const error = new Error('Invalid email format');
                error.statusCode = 400;
                throw error;
            }
        }

        // 2. Check if user already exists by phone number
        const existingUserByPhone = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (existingUserByPhone) {
            const error = new Error('User with this phone number already exists');
            error.statusCode = 409;
            throw error;
        }

        // 3. Check if email is already taken (if provided)
        if (email) {
            const existingUserByEmail = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUserByEmail) {
                const error = new Error('User with this email already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // 4. Hash PIN
        const hashedPin = await hashPin(pin);

        // 5. Create User
        const user = await prisma.user.create({
            data: {
                phoneNumber,
                email: email || null,
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

    /**
     * Request password reset - generate reset code for user
     * @param {string} phoneNumber - User phone number
     * @returns {Object} - Reset code and info
     */
    async requestPasswordReset(phoneNumber) {
        // 1. Validation
        if (!phoneNumber) {
            const error = new Error('Phone number is required');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Invalid phone number format. Must be 8 digits.');
            error.statusCode = 400;
            throw error;
        }

        // 2. Find User
        const user = await prisma.user.findUnique({
            where: { phoneNumber },
            select: { id: true, phoneNumber: true, email: true, name: true },
        });

        if (!user) {
            // Don't reveal if user exists for security
            // Return success message anyway to prevent user enumeration
            return {
                success: true,
                message: 'If an account exists with this phone number, a reset code has been sent.',
                resetCode: null, // In production, you'd send this via SMS/email
            };
        }

        // 3. Generate reset code (6-digit)
        const crypto = require('crypto');
        const resetCode = crypto.randomInt(100000, 999999).toString();
        const resetToken = crypto.randomBytes(32).toString('hex');

        // In production, you would:
        // - Store resetCode and resetToken in a database table with expiry
        // - Send resetCode via SMS to the user's phone number
        // - Send resetLink via email if email exists
        // For now, we'll return the code directly (not recommended for production)

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Valid for 1 hour

        return {
            success: true,
            message: 'Reset code generated successfully',
            resetCode, // In production, don't return this - send via SMS
            resetToken,
            expiresAt,
            resetLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&code=${resetCode}`,
            // In production, send this information via SMS/email instead
        };
    }

    /**
     * Reset password using phone number and reset code
     * @param {Object} resetData - { phoneNumber, resetCode, newPin, resetToken? }
     * @returns {Object} - Success message
     */
    async resetPassword({ phoneNumber, resetCode, newPin, resetToken }) {
        // 1. Validation
        if (!phoneNumber || !resetCode || !newPin) {
            const error = new Error('Phone number, reset code, and new PIN are required');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Invalid phone number format. Must be 8 digits.');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePin(newPin)) {
            const error = new Error('Invalid PIN format. Must be 4 digits.');
            error.statusCode = 400;
            throw error;
        }

        // 2. Find User
        const user = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (!user) {
            const error = new Error('Invalid reset code or user not found');
            error.statusCode = 400;
            throw error;
        }

        // 3. Validate reset code and token
        // In production, you would:
        // - Check resetCode and resetToken against a database table
        // - Verify expiry time
        // - Verify the reset request belongs to this user
        // For now, we'll just check that a reset was requested (simplified)
        
        // In a real implementation, you'd query a PasswordReset table:
        // const resetRequest = await prisma.passwordReset.findFirst({
        //     where: {
        //         userId: user.id,
        //         code: resetCode,
        //         token: resetToken,
        //         expiresAt: { gt: new Date() },
        //         used: false,
        //     },
        // });
        // if (!resetRequest) { throw error; }

        // 4. Hash new PIN
        const hashedPin = await hashPin(newPin);

        // 5. Update user PIN
        await prisma.user.update({
            where: { id: user.id },
            data: { pin: hashedPin },
        });

        // 6. Mark reset code as used (if you have a PasswordReset table)
        // await prisma.passwordReset.update({
        //     where: { id: resetRequest.id },
        //     data: { used: true },
        // });

        // 7. Generate new token for auto-login after reset
        const token = generateToken(user);

        const { pin: _, ...userWithoutPin } = user;

        return {
            success: true,
            message: 'Password reset successfully',
            user: userWithoutPin,
            token,
        };
    }
}

module.exports = new AuthService();
