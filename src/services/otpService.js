const prisma = require('../lib/prisma');
const smsService = require('./smsService');
const crypto = require('crypto');
const { validatePhoneNumber } = require('../utils/hashUtils');

class OTPService {
    constructor() {
        this.otpLength = 6;
        this.otpExpiryMinutes = 10; // OTP expires in 10 minutes
        this.maxAttemptsPerPhone = 10; // Max 10 OTP requests per phone per hour
        this.resendCooldownSeconds = 60; // 60 seconds cooldown between resends
    }

    /**
     * Generate a random OTP code
     * @param {string} purpose - Purpose of OTP (REGISTRATION uses 4-digit, others use 6-digit)
     * @returns {string} - OTP code (4 or 6 digits)
     */
    generateOTPCode(purpose = 'VERIFICATION') {
        // REGISTRATION uses 4-digit code, others use 6-digit
        if (purpose === 'REGISTRATION') {
            return crypto.randomInt(1000, 9999).toString();
        }
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Send OTP to phone number
     * @param {string} phoneNumber - Phone number to send OTP to
     * @param {string} purpose - Purpose of OTP (REGISTRATION, LOGIN, PASSWORD_RESET, etc.)
     * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
     */
    async sendOTP(phoneNumber, purpose = 'VERIFICATION') {
        try {
            // 1. Validate phone number
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

            // 2. For REGISTRATION purpose, check if user already exists BEFORE rate limiting
            if (purpose === 'REGISTRATION') {
                const existingUser = await prisma.user.findUnique({
                    where: { phoneNumber },
                });

                if (existingUser) {
                    const error = new Error('Бүртгэлтэй утасны дугаар байна');
                    error.statusCode = 409;
                    throw error;
                }
            }

            // 3. Check rate limiting - prevent abuse
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentOTPs = await prisma.otp.count({
                where: {
                    phoneNumber,
                    purpose,
                    createdAt: {
                        gte: oneHourAgo
                    }
                }
            });

            if (recentOTPs >= this.maxAttemptsPerPhone) {
                // Find the oldest OTP request in the last hour to calculate when they can try again
                const oldestOTP = await prisma.otp.findFirst({
                    where: {
                        phoneNumber,
                        purpose,
                        createdAt: {
                            gte: oneHourAgo
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                });

                let errorMessage = `Хэтэрхий олон удаа хүсэлт илгээсэн байна. Та цагт ${this.maxAttemptsPerPhone} удаа илгээх боломжтой.`;
                
                if (oldestOTP) {
                    const timeUntilReset = new Date(oldestOTP.createdAt.getTime() + 60 * 60 * 1000);
                    const minutesUntilReset = Math.ceil((timeUntilReset.getTime() - Date.now()) / (60 * 1000));
                    
                    if (minutesUntilReset > 0) {
                        errorMessage += ` Та ${minutesUntilReset} минутын дараа дахин оролдоно уу.`;
                    } else {
                        errorMessage += ' Та хэдэн минут хүлээгээд дахин оролдоно уу..';
                    }
                } else {
                    errorMessage += ' Дараа дахин оролдоно уу.';
                }

                const error = new Error(errorMessage);
                error.statusCode = 429;
                error.code = 'RATE_LIMIT_EXCEEDED';
                error.details = {
                    maxAttempts: this.maxAttemptsPerPhone,
                    attemptsUsed: recentOTPs,
                    resetInMinutes: oldestOTP ? Math.ceil((new Date(oldestOTP.createdAt.getTime() + 60 * 60 * 1000).getTime() - Date.now()) / (60 * 1000)) : null
                };
                throw error;
            }

            // 4. Check if there's a recent OTP that hasn't expired yet (cooldown)
            const cooldownTime = new Date(Date.now() - this.resendCooldownSeconds * 1000);
            const recentActiveOTP = await prisma.otp.findFirst({
                where: {
                    phoneNumber,
                    purpose,
                    isUsed: false,
                    expiresAt: {
                        gt: new Date()
                    },
                    createdAt: {
                        gte: cooldownTime
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (recentActiveOTP) {
                // Return existing OTP info but don't send again (still in cooldown)
                const secondsRemaining = Math.ceil(
                    (this.resendCooldownSeconds * 1000 - (Date.now() - recentActiveOTP.createdAt.getTime())) / 1000
                );
                const error = new Error(`Шинэ OTP код дахин хүсэхийн өмнө ${secondsRemaining} секунд хүлээнэ үү.`);
                error.statusCode = 429;
                throw error;
            }

            // 5. Generate new OTP code first (before invalidating previous ones)
            const cleanPhoneNumber = String(phoneNumber).trim();
            const cleanPurpose = String(purpose).trim();
            const otpCode = String(this.generateOTPCode(purpose)).trim();
            const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

            // 6. Invalidate all previous unused OTPs for this phone/purpose
            // Use trimmed values to ensure consistency
            await prisma.otp.updateMany({
                where: {
                    phoneNumber: cleanPhoneNumber,
                    purpose: cleanPurpose,
                    isUsed: false
                },
                data: {
                    isUsed: true // Mark as used to invalidate
                }
            });

            // 6. Store new OTP in database (ensure code is stored as string)
            const otpRecord = await prisma.otp.create({
                data: {
                    phoneNumber: cleanPhoneNumber,
                    code: otpCode,
                    purpose: cleanPurpose,
                    expiresAt,
                    isUsed: false
                }
            });

            // 8. Send OTP via SMS
            const smsResult = await smsService.sendOTP(phoneNumber, otpCode, purpose);

            if (!smsResult.success) {
                // If SMS fails, we still created the OTP record
                // In production, you might want to delete it or handle differently
                const error = new Error(`SMS илгээж чадсангүй: ${smsResult.message}`);
                error.statusCode = 500;
                error.smsError = smsResult.error;
                throw error;
            }

            return {
                success: true,
                message: 'Нэг удаагийн код амжилттай илгээгдлээ.',
                expiresAt: expiresAt.toISOString(),
                expiresInMinutes: this.otpExpiryMinutes
            };

        } catch (error) {
            // Re-throw if it's already a formatted error
            if (error.statusCode) {
                throw error;
            }

            // Wrap unexpected errors
            const newError = new Error(error.message || 'Нэг удаагийн код илгээхэд алдаа гарлаа.');
            newError.statusCode = 500;
            throw newError;
        }
    }

    /**
     * Check OTP code without marking it as used (for UI validation)
     * @param {string} phoneNumber - Phone number
     * @param {string} code - OTP code to check
     * @param {string} purpose - Purpose of OTP
     * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
     */
    async checkOTP(phoneNumber, code, purpose = 'VERIFICATION') {
        try {
            // 1. Validate inputs
            if (!phoneNumber || !code) {
                const error = new Error('Утасны дугаар болон нэг удаагийн код оруулна уу.');
                error.statusCode = 400;
                throw error;
            }

            // Trim whitespace from code
            code = String(code).trim();

            if (!validatePhoneNumber(phoneNumber)) {
                const error = new Error('Утасны дугаарын формат буруу байна. 8 оронтой байх ёстой.');
                error.statusCode = 400;
                throw error;
            }

            // Validate OTP code format based on purpose
            const expectedLength = purpose === 'REGISTRATION' ? 4 : 6;
            const codePattern = purpose === 'REGISTRATION' ? /^\d{4}$/ : /^\d{6}$/;
            
            if (!codePattern.test(code)) {
                const error = new Error(`Нэг удаагийн кодын формат буруу байна. ${expectedLength} оронтой байх ёстой.`);
                error.statusCode = 400;
                throw error;
            }

            // 2. Find the most recent OTP
            const now = new Date();
            const cleanPhoneNumber = String(phoneNumber).trim();
            const cleanCode = String(code).trim();
            const cleanPurpose = String(purpose).trim();
            
            const mostRecentOTP = await prisma.otp.findFirst({
                where: {
                    phoneNumber: cleanPhoneNumber,
                    code: cleanCode,
                    purpose: cleanPurpose
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (!mostRecentOTP) {
                const error = new Error('Нэг удаагийн код буруу байна. Кодоо шалгаад дахин оролдоно уу.');
                error.statusCode = 400;
                throw error;
            }

            // Check if used
            if (mostRecentOTP.isUsed) {
                const error = new Error('Нэг удаагийн код аль хэдийн ашиглагдсан байна. Шинэ код дахин авна уу.');
                error.statusCode = 400;
                throw error;
            }

            // Check if expired
            if (mostRecentOTP.expiresAt <= now) {
                const error = new Error('Нэг удаагийн кодын хугацаа дууссан байна. Шинэ код дахин авна уу.');
                error.statusCode = 400;
                throw error;
            }

            return {
                success: true,
                message: 'OTP code is valid'
            };

        } catch (error) {
            if (error.statusCode) {
                throw error;
            }
            const newError = new Error(error.message || 'Failed to check OTP');
            newError.statusCode = 500;
            throw newError;
        }
    }

    /**
     * Verify OTP code (marks it as used)
     * @param {string} phoneNumber - Phone number
     * @param {string} code - OTP code to verify
     * @param {string} purpose - Purpose of OTP (must match the one used when sending)
     * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
     */
    async verifyOTP(phoneNumber, code, purpose = 'VERIFICATION') {
        try {
            // 1. Validate inputs
            if (!phoneNumber || !code) {
                const error = new Error('Phone number and OTP code are required');
                error.statusCode = 400;
                throw error;
            }

            // Trim whitespace from code
            code = String(code).trim();

            if (!validatePhoneNumber(phoneNumber)) {
                const error = new Error('Утасны дугаарын формат буруу байна. 8 оронтой байх ёстой.');
                error.statusCode = 400;
                throw error;
            }

            // Validate OTP code format based on purpose
            // REGISTRATION uses 4-digit, others use 6-digit
            const expectedLength = purpose === 'REGISTRATION' ? 4 : 6;
            const codePattern = purpose === 'REGISTRATION' ? /^\d{4}$/ : /^\d{6}$/;
            
            if (!codePattern.test(code)) {
                const error = new Error(`Нэг удаагийн кодын формат буруу байна. ${expectedLength} оронтой байх ёстой.`);
                error.statusCode = 400;
                throw error;
            }

            // 2. Find the OTP record - search for unused, non-expired OTPs
            // Ensure all values are strings and trimmed for comparison
            const now = new Date();
            const cleanPhoneNumber = String(phoneNumber).trim();
            const cleanCode = String(code).trim();
            const cleanPurpose = String(purpose).trim();
            
            // First, find the most recent OTP with this code (regardless of status)
            const mostRecentOTP = await prisma.otp.findFirst({
                where: {
                    phoneNumber: cleanPhoneNumber,
                    code: cleanCode,
                    purpose: cleanPurpose
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (!mostRecentOTP) {
                const error = new Error('Нэг удаагийн код буруу байна. Шалгаад дахин оролдоно уу.');
                error.statusCode = 400;
                throw error;
            }

            // Check if the most recent OTP is used
            if (mostRecentOTP.isUsed) {
                const error = new Error('Нэг удаагийн код аль хэдийн ашиглагдсан байна. Шинэ код дахин авна уу.');
                error.statusCode = 400;
                throw error;
            }

            // Check if the most recent OTP is expired
            if (mostRecentOTP.expiresAt <= now) {
                // Mark as used
                await prisma.otp.update({
                    where: { id: mostRecentOTP.id },
                    data: { isUsed: true }
                });

                const error = new Error('Нэг удаагийн кодын хугацаа дууссан байна. Шинэ код дахин авна уу.');
                error.statusCode = 400;
                throw error;
            }

            // OTP is valid - use it
            const otpRecord = mostRecentOTP;

            // 3. For REGISTRATION purpose, don't mark as used yet (will be marked during registration)
            // For other purposes, mark as used immediately
            if (cleanPurpose !== 'REGISTRATION') {
                await prisma.otp.update({
                    where: { id: otpRecord.id },
                    data: { isUsed: true }
                });

                // Invalidate all other unused OTPs for this phone/purpose
                await prisma.otp.updateMany({
                    where: {
                        phoneNumber: cleanPhoneNumber,
                        purpose: cleanPurpose,
                        isUsed: false,
                        id: {
                            not: otpRecord.id
                        }
                    },
                    data: {
                        isUsed: true
                    }
                });
            }

            return {
                success: true,
                message: 'OTP verified successfully'
            };

        } catch (error) {
            // Re-throw if it's already a formatted error
            if (error.statusCode) {
                throw error;
            }

            // Wrap unexpected errors
            const newError = new Error(error.message || 'Failed to verify OTP');
            newError.statusCode = 500;
            throw newError;
        }
    }

    /**
     * Clean up expired OTPs (should be called periodically via cron job)
     * @returns {Promise<number>} - Number of expired OTPs cleaned up
     */
    async cleanupExpiredOTPs() {
        try {
            const result = await prisma.otp.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    }
                }
            });

            return result.count;
        } catch (error) {
            console.error('Error cleaning up expired OTPs:', error);
            return 0;
        }
    }
}

module.exports = new OTPService();
