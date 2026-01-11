const prisma = require('../lib/prisma');
const crypto = require('crypto');
const productService = require('./productService');

class DraftOrderService {
    /**
     * Generate a unique session token for guest checkout
     * @returns {string} - Unique session token
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create a draft order (guest checkout - no authentication required)
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity
     * @param {string} sessionToken - Optional session token (if not provided, generates new one)
     * @returns {Object} - Draft order with session token
     */
    async createDraftOrder(productId, quantity, sessionToken = null) {
        const prodId = parseInt(productId);
        const qty = parseInt(quantity);

        // Validate inputs
        if (!productId || qty <= 0) {
            const error = new Error('Product ID and quantity (must be > 0) are required');
            error.statusCode = 400;
            throw error;
        }

        // Get product and validate it exists
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(
                `Insufficient stock for product "${stockCheck.product.name}". Available: ${stockCheck.product.stock}, Requested: ${qty}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Use existing session token or generate new one
        const token = sessionToken || this.generateSessionToken();

        // Calculate total amount
        const price = parseFloat(stockCheck.product.price);
        const totalAmount = price * qty;

        // Set expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Check if draft order already exists for this session token
        const existingDraft = await prisma.draftOrder.findUnique({
            where: { sessionToken: token }
        });

        let draftOrder;
        if (existingDraft) {
            // Update existing draft order
            draftOrder = await prisma.draftOrder.update({
                where: { sessionToken: token },
                data: {
                    productId: prodId,
                    quantity: qty,
                    totalAmount: totalAmount,
                    expiresAt: expiresAt
                },
                include: {
                    product: {
                        include: {
                            categories: {
                                include: {
                                    category: {
                                        select: {
                                            id: true,
                                            name: true,
                                            description: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        } else {
            // Create new draft order
            draftOrder = await prisma.draftOrder.create({
                data: {
                    sessionToken: token,
                    productId: prodId,
                    quantity: qty,
                    totalAmount: totalAmount,
                    expiresAt: expiresAt
                },
                include: {
                    product: {
                        include: {
                            categories: {
                                include: {
                                    category: {
                                        select: {
                                            id: true,
                                            name: true,
                                            description: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Format product categories
        if (draftOrder.product && draftOrder.product.categories) {
            draftOrder.product.categories = draftOrder.product.categories.map(pc => pc.category);
            draftOrder.product.categoryId = draftOrder.product.categories.length > 0 
                ? draftOrder.product.categories[0].id 
                : null;
            draftOrder.product.category = draftOrder.product.categories.length > 0 
                ? draftOrder.product.categories[0] 
                : null;
        }

        return draftOrder;
    }

    /**
     * Get draft order by session token
     * @param {string} sessionToken - Session token
     * @returns {Object} - Draft order
     */
    async getDraftOrder(sessionToken) {
        if (!sessionToken) {
            const error = new Error('Session token is required');
            error.statusCode = 400;
            throw error;
        }

        const draftOrder = await prisma.draftOrder.findUnique({
            where: { sessionToken },
            include: {
                product: {
                    include: {
                        categories: {
                            include: {
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!draftOrder) {
            const error = new Error('Draft order not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if expired
        if (new Date() > draftOrder.expiresAt) {
            // Delete expired draft
            await prisma.draftOrder.delete({
                where: { sessionToken }
            });
            const error = new Error('Draft order has expired. Please create a new order.');
            error.statusCode = 410; // Gone
            throw error;
        }

        // Format product categories
        if (draftOrder.product && draftOrder.product.categories) {
            draftOrder.product.categories = draftOrder.product.categories.map(pc => pc.category);
            draftOrder.product.categoryId = draftOrder.product.categories.length > 0 
                ? draftOrder.product.categories[0].id 
                : null;
            draftOrder.product.category = draftOrder.product.categories.length > 0 
                ? draftOrder.product.categories[0] 
                : null;
        }

        return draftOrder;
    }

    /**
     * Delete draft order
     * @param {string} sessionToken - Session token
     */
    async deleteDraftOrder(sessionToken) {
        if (!sessionToken) {
            return;
        }

        await prisma.draftOrder.deleteMany({
            where: { sessionToken }
        });
    }

    /**
     * Clean up expired draft orders (can be called by a cron job)
     */
    async cleanupExpiredDrafts() {
        const deleted = await prisma.draftOrder.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });
        return deleted.count;
    }
}

module.exports = new DraftOrderService();
