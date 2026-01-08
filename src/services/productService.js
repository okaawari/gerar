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
     * Get all products with optional filters (Advanced Search)
     * @param {Object} filters - { 
     *   categoryId?, categoryIds[], search?, inStock?, 
     *   minPrice?, maxPrice?, minStock?, maxStock?,
     *   createdAfter?, createdBefore?,
     *   sortBy?, sortOrder?, page?, limit?
     * }
     * @returns {Object} - { products, pagination: { total, page, limit, totalPages } }
     */
    async getAllProducts(filters = {}) {
        const where = {};

        // Filter by single category or multiple categories
        if (filters.categoryIds && Array.isArray(filters.categoryIds)) {
            // Multiple categories
            const categoryIds = filters.categoryIds
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);
            if (categoryIds.length > 0) {
                where.categoryId = {
                    in: categoryIds
                };
            }
        } else if (filters.categoryId) {
            // Single category (backward compatibility)
            where.categoryId = parseInt(filters.categoryId);
        }

        // Advanced search: search in name and/or description
        if (filters.search) {
            const searchTerm = filters.search.trim();
            if (searchTerm.length > 0) {
                where.OR = [
                    {
                        name: {
                            contains: searchTerm
                        }
                    },
                    {
                        description: {
                            contains: searchTerm
                        }
                    }
                ];
            }
        }

        // Price range filtering
        if (filters.minPrice !== undefined) {
            const minPrice = parseFloat(filters.minPrice);
            if (!isNaN(minPrice) && minPrice >= 0) {
                where.price = where.price || {};
                where.price.gte = minPrice;
            }
        }

        if (filters.maxPrice !== undefined) {
            const maxPrice = parseFloat(filters.maxPrice);
            if (!isNaN(maxPrice) && maxPrice >= 0) {
                where.price = where.price || {};
                where.price.lte = maxPrice;
            }
        }

        // Stock filtering - handle inStock and minStock/maxStock together
        // Priority: minStock/maxStock > inStock > no filter
        const hasStockRange = filters.minStock !== undefined || filters.maxStock !== undefined;
        
        if (hasStockRange) {
            // Stock range filtering takes precedence
            const stockFilter = {};
            
            if (filters.minStock !== undefined) {
                const minStock = parseInt(filters.minStock);
                if (!isNaN(minStock) && minStock >= 0) {
                    // If inStock is true and minStock is specified, ensure minStock is at least 1
                    const effectiveMinStock = (filters.inStock === 'true' || filters.inStock === true) 
                        ? Math.max(minStock, 1) 
                        : minStock;
                    stockFilter.gte = effectiveMinStock;
                }
            } else if (filters.inStock === 'true' || filters.inStock === true) {
                // No minStock but inStock=true, so stock must be > 0
                stockFilter.gt = 0;
            }
            
            if (filters.maxStock !== undefined) {
                const maxStock = parseInt(filters.maxStock);
                if (!isNaN(maxStock) && maxStock >= 0) {
                    stockFilter.lte = maxStock;
                }
            }
            
            if (Object.keys(stockFilter).length > 0) {
                where.stock = stockFilter;
            }
        } else if (filters.inStock !== undefined) {
            // Only inStock filter (no range)
            if (filters.inStock === 'true' || filters.inStock === true) {
                where.stock = { gt: 0 };
            } else if (filters.inStock === 'false' || filters.inStock === false) {
                where.stock = 0;
            }
        }

        // Date range filtering
        if (filters.createdAfter) {
            const createdAfter = new Date(filters.createdAfter);
            if (!isNaN(createdAfter.getTime())) {
                where.createdAt = where.createdAt || {};
                where.createdAt.gte = createdAfter;
            }
        }

        if (filters.createdBefore) {
            const createdBefore = new Date(filters.createdBefore);
            if (!isNaN(createdBefore.getTime())) {
                where.createdAt = where.createdAt || {};
                where.createdAt.lte = createdBefore;
            }
        }

        // Sorting options
        const sortBy = filters.sortBy || 'createdAt';
        const validSortFields = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        
        const sortOrder = (filters.sortOrder === 'asc' || filters.sortOrder === 'ASC') ? 'asc' : 'desc';
        
        const orderBy = {
            [sortField]: sortOrder
        };

        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 50;
        const skip = (page - 1) * limit;

        // Ensure page and limit are valid
        const validPage = page > 0 ? page : 1;
        const validLimit = limit > 0 && limit <= 100 ? limit : 50; // Max 100 items per page

        // Get total count for pagination
        const total = await prisma.product.count({ where });

        // Get products with pagination
        const products = await prisma.product.findMany({
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
            orderBy,
            skip: (validPage - 1) * validLimit,
            take: validLimit
        });

        const totalPages = Math.ceil(total / validLimit);

        return {
            products,
            pagination: {
                total,
                page: validPage,
                limit: validLimit,
                totalPages
            }
        };
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

