const prisma = require('../lib/prisma');

class CategoryService {
    /**
     * Validate category data
     * @param {Object} data - { name, description? }
     * @returns {Object} - { isValid, errors }
     */
    validateCategory(data) {
        const errors = [];

        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push('Category name is required and must be a non-empty string');
        }

        if (data.name && data.name.length > 191) {
            errors.push('Category name must be 191 characters or less');
        }

        if (data.description !== undefined && data.description !== null) {
            if (typeof data.description !== 'string') {
                errors.push('Category description must be a string');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get all categories
     * @returns {Array} - List of categories
     */
    async getAllCategories() {
        return await prisma.category.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get category by ID
     * @param {number} id - Category ID
     * @returns {Object} - Category with products
     */
    async getCategoryById(id) {
        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        stock: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        return category;
    }

    /**
     * Get products by category ID
     * @param {number} categoryId - Category ID
     * @returns {Array} - List of products in category
     */
    async getCategoryProducts(categoryId) {
        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: parseInt(categoryId) }
        });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        return await prisma.product.findMany({
            where: { categoryId: parseInt(categoryId) },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Create a new category
     * @param {Object} data - { name, description? }
     * @returns {Object} - Created category
     */
    async createCategory(data) {
        // Validate input
        const validation = this.validateCategory(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Check if category with same name already exists
        const existingCategory = await prisma.category.findUnique({
            where: { name: data.name.trim() }
        });

        if (existingCategory) {
            const error = new Error('Category with this name already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create category
        const category = await prisma.category.create({
            data: {
                name: data.name.trim(),
                description: data.description ? data.description.trim() : null
            }
        });

        return category;
    }

    /**
     * Update a category
     * @param {number} id - Category ID
     * @param {Object} data - { name?, description? }
     * @returns {Object} - Updated category
     */
    async updateCategory(id, data) {
        // Validate input (only validate fields that are provided)
        const validation = this.validateCategory(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Check if category exists
        const existingCategory = await prisma.category.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingCategory) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // If name is being updated, check for duplicates
        if (data.name && data.name.trim() !== existingCategory.name) {
            const duplicateCategory = await prisma.category.findUnique({
                where: { name: data.name.trim() }
            });

            if (duplicateCategory) {
                const error = new Error('Category with this name already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Update category
        const updateData = {};
        if (data.name !== undefined) {
            updateData.name = data.name.trim();
        }
        if (data.description !== undefined) {
            updateData.description = data.description ? data.description.trim() : null;
        }

        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        return category;
    }

    /**
     * Delete a category
     * @param {number} id - Category ID
     * @returns {Object} - Deleted category
     */
    async deleteCategory(id) {
        // Check if category exists
        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if category has products
        if (category.products && category.products.length > 0) {
            const error = new Error(`Cannot delete category. ${category.products.length} product(s) are associated with this category. Please reassign or delete these products first.`);
            error.statusCode = 409;
            throw error;
        }

        // Delete category
        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        return category;
    }
}

module.exports = new CategoryService();

