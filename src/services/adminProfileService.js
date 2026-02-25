const prisma = require('../lib/prisma');
const { hashPin, comparePin, validatePin, validatePhoneNumber } = require('../utils/hashUtils');
const { validateEmail } = require('../middleware/validation');

class AdminProfileService {
    /**
     * Get current admin's profile
     * @param {number} userId - Admin user ID from JWT
     * @returns {Object} - Admin profile (id, phoneNumber, name, email, role, createdAt, updatedAt)
     */
    async getProfile(userId) {
        const id = parseInt(userId);
        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        return user;
    }

    /**
     * Update admin's profile info
     * @param {number} userId - Admin user ID from JWT
     * @param {Object} data - { name (required), email? (optional, nullable), phoneNumber? (optional, 8 digits) }
     * @returns {Object} - Updated admin profile
     */
    async updateProfile(userId, data) {
        const id = parseInt(userId);
        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const { name, email, phoneNumber } = data;

        // name is required, min 1 char
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            const error = new Error('Name is required and must be at least 1 character');
            error.statusCode = 400;
            throw error;
        }
        if (name.trim().length > 50) {
            const error = new Error('Name must be at most 50 characters');
            error.statusCode = 400;
            throw error;
        }

        const updateData = { name: name.trim() };

        // email: optional, nullable — null or valid email
        if (email !== undefined) {
            const trimmed = typeof email === 'string' ? email.trim() : '';
            if (trimmed.length > 0) {
                if (!validateEmail(trimmed)) {
                    const error = new Error('Invalid email format');
                    error.statusCode = 400;
                    throw error;
                }
                updateData.email = trimmed;
            } else {
                updateData.email = null;
            }
        }

        // phoneNumber: optional, 8 digits
        if (phoneNumber !== undefined) {
            const str = String(phoneNumber).trim();
            if (str.length > 0) {
                if (!validatePhoneNumber(str)) {
                    const error = new Error('Phone number must be 8 digits');
                    error.statusCode = 400;
                    throw error;
                }
                updateData.phoneNumber = str;
            }
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, phoneNumber: true },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Check email uniqueness when setting a non-empty email
        if (updateData.email) {
            const existing = await prisma.user.findFirst({
                where: {
                    email: updateData.email,
                    id: { not: id },
                },
                select: { id: true },
            });
            if (existing) {
                const error = new Error('Email is already in use');
                error.statusCode = 409;
                throw error;
            }
        }

        // Check phone number uniqueness when changing
        if (updateData.phoneNumber && updateData.phoneNumber !== user.phoneNumber) {
            const existing = await prisma.user.findFirst({
                where: {
                    phoneNumber: updateData.phoneNumber,
                    id: { not: id },
                },
                select: { id: true },
            });
            if (existing) {
                const error = new Error('Phone number is already in use');
                error.statusCode = 409;
                throw error;
            }
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return updated;
    }

    /**
     * Change admin's PIN code
     * @param {number} userId - Admin user ID from JWT
     * @param {Object} data - { currentPin, newPin, confirmPin } — all 4 digits, newPin must match confirmPin
     * @returns {Object} - { success, message }
     */
    async changePin(userId, data) {
        const id = parseInt(userId);
        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const { currentPin, newPin, confirmPin } = data;

        if (!currentPin || !newPin || !confirmPin) {
            const error = new Error('currentPin, newPin, and confirmPin are required');
            error.statusCode = 400;
            throw error;
        }

        if (!validatePin(currentPin) || !validatePin(newPin) || !validatePin(confirmPin)) {
            const error = new Error('All PINs must be 4 digits');
            error.statusCode = 400;
            throw error;
        }

        if (newPin !== confirmPin) {
            const error = new Error('Шинэ ПИН код таарахгүй байна');
            error.statusCode = 400;
            throw error;
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, pin: true },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const isCurrentPinValid = await comparePin(currentPin, user.pin);
        if (!isCurrentPinValid) {
            const error = new Error('Одоогийн ПИН код буруу байна');
            error.statusCode = 400;
            throw error;
        }

        const hashedNewPin = await hashPin(newPin);
        await prisma.user.update({
            where: { id },
            data: { pin: hashedNewPin },
        });

        return { success: true, message: 'ПИН код амжилттай солигдлоо' };
    }
}

module.exports = new AdminProfileService();
