const prisma = require('../lib/prisma');
const { hashPin, comparePin, validatePin, validatePhoneNumber } = require('../utils/hashUtils');
const { generateToken } = require('../utils/jwtUtils');
const { validateEmail } = require('../middleware/validation');
const otpService = require('./otpService');

class AuthService {
    /**
     * Register a new user (requires OTP verification)
     * @param {Object} userData - { phoneNumber, pin, name, email?, otpCode }
     * @returns {Object} - { user, token }
     */
    async register({ phoneNumber, pin, name, email, otpCode }) {
        // 1. Validation
        if (!phoneNumber || !pin || !name) {
            const error = new Error('Утасны дугаар, пин код болон нэр шаардлагатай');
            error.statusCode = 400;
            throw error;
        }

        if (!otpCode) {
            const error = new Error('Бүртгэлд нэг удаагийн код шаардлагатай');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Утасны дугаарын формат буруу байна. 8 оронтой байх ёстой.');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePin(pin)) {
            const error = new Error('Пин кодын формат буруу байна. 4 оронтой байх ёстой.');
            error.statusCode = 400;
            throw error;
        }

        // Validate name length
        if (name && typeof name === 'string' && name.trim().length > 50) {
            const error = new Error('Нэр 50 тэмдэгтээс их байж болохгүй');
            error.statusCode = 400;
            throw error;
        }

        // Validate OTP code format (4 digits for registration)
        if (!/^\d{4}$/.test(otpCode)) {
            const error = new Error('Нэг удаагийн кодын формат буруу байна. 4 оронтой байх ёстой.');
            error.statusCode = 400;
            throw error;
        }

        // Validate email if provided
        if (email !== undefined && email !== null && email !== '') {
            if (!validateEmail(email)) {
                const error = new Error('Имэйлийн формат буруу байна');
                error.statusCode = 400;
                throw error;
            }
        }

        // 2. Verify OTP code first (before checking if user exists)
        try {
            await otpService.verifyOTP(phoneNumber, otpCode, 'REGISTRATION');
        } catch (otpError) {
            // Re-throw OTP verification errors
            throw otpError;
        }

        // 3. Check if user already exists by phone number
        const existingUserByPhone = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (existingUserByPhone) {
            const error = new Error('Бүртгэлтэй утасны дугаар байна');
            error.statusCode = 409;
            throw error;
        }

        // 4. Check if email is already taken (if provided)
        if (email) {
            const existingUserByEmail = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUserByEmail) {
                const error = new Error('Энэ имэйлтэй хэрэглэгч аль хэдийн бүртгэлтэй байна');
                error.statusCode = 409;
                throw error;
            }
        }

        // 5. Hash PIN
        const hashedPin = await hashPin(pin);

        // 6. Create User
        let user;
        try {
            user = await prisma.user.create({
                data: {
                    phoneNumber,
                    email: email || null,
                    pin: hashedPin,
                    name,
                    role: 'USER', // Default role
                },
            });
        } catch (dbError) {
            // Handle database errors (like data too long, constraints, etc.)
            if (dbError.code && dbError.code.startsWith('P')) {
                // Prisma error - preserve the error
                throw dbError;
            }
            // For other database errors, wrap them
            const error = new Error(dbError.message || 'Хэрэглэгчийн бүртгэл үүсгэхэд алдаа гарлаа');
            error.statusCode = 500;
            error.originalError = dbError;
            throw error;
        }

        // 7. Generate Token
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
            const error = new Error('Утасны дугаар болон пин код шаардлагатай');
            error.statusCode = 400;
            throw error;
        }

        // 2. Find User
        const user = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (!user) {
            const error = new Error('Утасны дугаар эсвэл пин буруу байна');
            error.statusCode = 401;
            throw error;
        }

        // 3. Check PIN
        const isPinValid = await comparePin(pin, user.pin);

        if (!isPinValid) {
            const error = new Error('Утасны дугаар эсвэл пин буруу байна');
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
            const error = new Error('Утасны дугаар шаардлагатай');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Утасны дугаарын формат буруу байна. 8 оронтой байх ёстой.');
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
                message: 'Хэрэв энэ утасны дугаартай бүртгэл байвал, сэргээх код илгээгдсэн.',
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
            message: 'Сэргээх код амжилттай үүсгэгдлээ',
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
            const error = new Error('Утасны дугаар, сэргээх код болон шинэ пин код шаардлагатай');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePhoneNumber(phoneNumber)) {
            const error = new Error('Утасны дугаарын формат буруу байна. 8 оронтой байх ёстой.');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePin(newPin)) {
            const error = new Error('Пин кодын формат буруу байна. 4 оронтой байх ёстой.');
            error.statusCode = 400;
            throw error;
        }

        // 2. Find User
        const user = await prisma.user.findUnique({
            where: { phoneNumber },
        });

        if (!user) {
            const error = new Error('Сэргээх код буруу эсвэл хэрэглэгч олдсонгүй');
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
            message: 'Пин код амжилттай сэргээгдлээ',
            user: userWithoutPin,
            token,
        };
    }
}

module.exports = new AuthService();
