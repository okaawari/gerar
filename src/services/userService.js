const prisma = require('../lib/prisma');
const crypto = require('crypto');

class UserService {
    /**
     * Get all users (for admin dashboard)
     * @param {Object} filters - Filter options (search, role, etc.)
     * @returns {Array} - Array of users with order counts
     */
    async getAllUsers(filters = {}) {
        const { search, role, page = 1, limit = 50 } = filters;
        const skip = (page - 1) * limit;

        const where = {};

        // Search by name, phone number, or email (MySQL: no mode; collation handles case)
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phoneNumber: { contains: search } },
                { email: { contains: search } },
            ];
        }

        // Filter by role
        if (role) {
            where.role = role;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    phoneNumber: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            orders: true,
                            addresses: true,
                            favorites: true,
                            cartItems: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get user by ID with full details (orders, addresses, etc.)
     * @param {number} userId - User ID
     * @returns {Object} - User with all related data
     */
    async getUserById(userId) {
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
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                addresses: {
                    orderBy: {
                        isDefault: 'desc',
                    },
                },
                orders: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    include: {
                        address: true,
                        items: {
                            include: {
                                product: {
                                    include: {
                                        categories: {
                                            include: {
                                                category: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        orders: true,
                        addresses: true,
                        favorites: true,
                        cartItems: true,
                    },
                },
            },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Format orders to include formatted product data
        const formattedOrders = user.orders.map((order) => ({
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount.toString(),
            deliveryTimeSlot: order.deliveryTimeSlot,
            address: order.address,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            items: order.items.map((item) => ({
                id: item.id,
                quantity: item.quantity,
                price: item.price.toString(),
                product: {
                    id: item.product.id,
                    name: item.product.name,
                    description: item.product.description,
                    price: item.product.price.toString(),
                    originalPrice: item.product.originalPrice?.toString() || null,
                    images: item.product.images,
                    categories: item.product.categories.map((pc) => ({
                        id: pc.category.id,
                        name: pc.category.name,
                    })),
                },
            })),
        }));

        return {
            ...user,
            orders: formattedOrders,
        };
    }

    /**
     * Generate a password reset code for a user (admin function)
     * @param {number} userId - User ID
     * @returns {Object} - Reset code and expiry info
     */
    async generatePasswordResetCode(userId) {
        const id = parseInt(userId);

        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, phoneNumber: true, email: true, name: true },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Generate a 6-digit reset code
        const resetCode = crypto.randomInt(100000, 999999).toString();

        // Store reset code in a temporary field or create a reset token
        // For simplicity, we'll return the code directly
        // In production, you might want to store this in a database table with expiry
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Valid for 1 hour

        // Generate a reset token that can be used with the code
        const resetToken = crypto.randomBytes(32).toString('hex');

        return {
            userId: user.id,
            userPhone: user.phoneNumber,
            userEmail: user.email,
            userName: user.name,
            resetCode,
            resetToken,
            expiresAt,
            resetLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&code=${resetCode}`,
            message: `Reset code generated for user: ${user.name} (${user.phoneNumber})`,
        };
    }

    /**
     * Reset user password using code (for admin or user)
     * @param {number} userId - User ID (optional if using token)
     * @param {string} resetCode - Reset code
     * @param {string} newPin - New 4-digit PIN
     * @param {string} resetToken - Optional reset token
     * @returns {Object} - Success message
     */
    async resetUserPassword(userId, resetCode, newPin, resetToken = null) {
        // Validate new PIN
        const { validatePin, hashPin } = require('../utils/hashUtils');

        if (!validatePin(newPin)) {
            const error = new Error('Invalid PIN format. Must be 4 digits.');
            error.statusCode = 400;
            throw error;
        }

        // If userId is provided, use it directly
        // Otherwise, you'd need to validate the resetToken and extract userId
        // For now, we'll require userId
        const id = parseInt(userId);

        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // In a production system, you'd validate the resetCode and resetToken here
        // by checking against a database table that stores reset requests
        // For now, we'll proceed if userId is provided (admin-initiated reset)

        // Hash new PIN
        const hashedPin = await hashPin(newPin);

        // Update user PIN
        await prisma.user.update({
            where: { id },
            data: { pin: hashedPin },
        });

        return {
            success: true,
            message: 'Password reset successfully',
            userId: user.id,
        };
    }

    /**
     * Update user role (super admin only)
     * @param {number} userId - User ID to update
     * @param {string} newRole - New role (USER, ADMIN, or SUPER_ADMIN)
     * @returns {Object} - Updated user
     */
    async updateUserRole(userId, newRole) {
        const id = parseInt(userId);

        if (isNaN(id)) {
            const error = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        // Validate role
        const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];
        if (!validRoles.includes(newRole)) {
            const error = new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, phoneNumber: true, email: true, name: true, role: true },
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Prevent super admin from removing their own super admin role
        // (This check should be done at controller level with the requesting user's ID)

        // Update user role
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { role: newRole },
            select: {
                id: true,
                phoneNumber: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return updatedUser;
    }
}

module.exports = new UserService();
