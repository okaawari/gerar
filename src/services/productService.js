const prisma = require('../lib/prisma');

class ProductService {
    /**
     * Validate product data
     * @param {Object} data - { name, description, price, stock, categoryId }
     * @returns {Object} - { isValid, errors }
     */
    validateProduct(data) {
        const errors = [];

        if (data.name !== undefined) {
            if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push('Product name is required and must be a non-empty string');
            }

            if (data.name && data.name.length > 191) {
                errors.push('Product name must be 191 characters or less');
            }
        }

        if (data.description !== undefined) {
            if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
                errors.push('Product description is required and must be a non-empty string');
            }
        }

        if (data.price !== undefined) {
            const price = parseFloat(data.price);
            if (isNaN(price) || price < 0) {
                errors.push('Product price must be a valid non-negative number');
            }
        }

        if (data.stock !== undefined) {
            const stock = parseInt(data.stock);
            if (isNaN(stock) || stock < 0) {
                errors.push('Product stock must be a valid non-negative integer');
            }
        }

        if (data.categoryId !== undefined) {
            const categoryId = parseInt(data.categoryId);
            if (isNaN(categoryId) || categoryId <= 0) {
                errors.push('Category ID must be a valid positive integer');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get all products with optional filters
     * @param {Object} filters - { categoryId?, search?, inStock? }
     * @returns {Array} - List of products
     */
    async getAllProducts(filters = {}) {
        const where = {};

        // Filter by category
        if (filters.categoryId) {
            where.categoryId = parseInt(filters.categoryId);
        }

        // Search by name (case-insensitive for MySQL)
        if (filters.search) {
            where.name = {
                contains: filters.search
            };
        }

        // Filter by stock availability
        if (filters.inStock !== undefined) {
            if (filters.inStock === 'true' || filters.inStock === true) {
                where.stock = {
                    gt: 0
                };
            }
        }

        return await prisma.product.findMany({
            where,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get product by ID
     * @param {number} id - Product ID
     * @returns {Object} - Product with category
     */
    async getProductById(id) {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        return product;
    }

    /**
     * Create a new product
     * @param {Object} data - { name, description, price, stock, categoryId }
     * @returns {Object} - Created product
     */
    async createProduct(data) {
        // Validate input
        const validation = this.validateProduct(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: parseInt(data.categoryId) }
        });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Create product
        const product = await prisma.product.create({
            data: {
                name: data.name.trim(),
                description: data.description.trim(),
                price: parseFloat(data.price),
                stock: parseInt(data.stock),
                categoryId: parseInt(data.categoryId)
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });

        return product;
    }

    /**
     * Update a product
     * @param {number} id - Product ID
     * @param {Object} data - { name?, description?, price?, stock?, categoryId? }
     * @returns {Object} - Updated product
     */
    async updateProduct(id, data) {
        // Validate input (only validate fields that are provided)
        const validation = this.validateProduct(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Check if product exists
        const existingProduct = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingProduct) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // If categoryId is being updated, verify category exists
        if (data.categoryId !== undefined && parseInt(data.categoryId) !== existingProduct.categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: parseInt(data.categoryId) }
            });

            if (!category) {
                const error = new Error('Category not found');
                error.statusCode = 404;
                throw error;
            }
        }

        // Build update data
        const updateData = {};
        if (data.name !== undefined) {
            updateData.name = data.name.trim();
        }
        if (data.description !== undefined) {
            updateData.description = data.description.trim();
        }
        if (data.price !== undefined) {
            updateData.price = parseFloat(data.price);
        }
        if (data.stock !== undefined) {
            updateData.stock = parseInt(data.stock);
        }
        if (data.categoryId !== undefined) {
            updateData.categoryId = parseInt(data.categoryId);
        }

        // Update product
        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });

        return product;
    }

    /**
     * Delete a product
     * @param {number} id - Product ID
     * @returns {Object} - Deleted product
     */
    async deleteProduct(id) {
        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) },
            include: {
                cartItems: {
                    select: {
                        id: true
                    }
                },
                orderItems: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product is in any active carts or orders
        // Note: According to schema, we can't delete products referenced in orders
        // because of the foreign key constraint. We'll let Prisma handle this.
        // For cart items, we should allow deletion but the schema might prevent it.
        // Let's try to delete and handle the error if needed.

        // Delete product
        try {
            await prisma.product.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            // If there are foreign key constraints, provide a better error message
            if (error.code === 'P2003') {
                const errorMsg = new Error('Cannot delete product. It is referenced in existing orders or cart items.');
                errorMsg.statusCode = 409;
                throw errorMsg;
            }
            throw error;
        }

        return product;
    }

    /**
     * Check if product has sufficient stock
     * @param {number} productId - Product ID
     * @param {number} quantity - Required quantity
     * @returns {Object} - { hasStock, product }
     */
    async checkStockAvailability(productId, quantity) {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(productId) }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        return {
            hasStock: product.stock >= quantity,
            product
        };
    }

    /**
     * Reduce product stock by quantity
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to reduce
     * @returns {Object} - Updated product
     */
    async reduceStock(productId, quantity) {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(productId) }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        const qty = parseInt(quantity);
        const newStock = product.stock - qty;

        if (newStock < 0) {
            const error = new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        return await prisma.product.update({
            where: { id: parseInt(productId) },
            data: {
                stock: newStock
            }
        });
    }
}

module.exports = new ProductService();

