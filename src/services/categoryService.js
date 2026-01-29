const prisma = require('../lib/prisma');

class CategoryService {
    /**
     * Validate category data
     * @param {Object} data - { name, description?, parentId? }
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

        if (data.parentId !== undefined && data.parentId !== null) {
            if (typeof data.parentId !== 'number' && !Number.isInteger(Number(data.parentId))) {
                errors.push('Parent ID must be a valid integer');
            }
        }

        if (data.order !== undefined && data.order !== null) {
            const order = parseInt(data.order);
            if (isNaN(order) || order < 0) {
                errors.push('Order must be a valid non-negative integer');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check for circular reference
     * @param {number} categoryId - Category ID to check
     * @param {number} potentialParentId - Potential parent ID
     * @returns {Promise<boolean>} - True if circular reference would occur
     */
    async wouldCreateCircularReference(categoryId, potentialParentId) {
        if (!potentialParentId || categoryId === potentialParentId) {
            return categoryId === potentialParentId;
        }

        // Check if the potential parent is a descendant of the category
        let currentParentId = potentialParentId;
        const visited = new Set();

        while (currentParentId) {
            if (visited.has(currentParentId)) {
                break; // Prevent infinite loop
            }
            visited.add(currentParentId);

            if (currentParentId === categoryId) {
                return true; // Circular reference detected
            }

            const parent = await prisma.category.findUnique({
                where: { id: currentParentId },
                select: { parentId: true }
            });

            if (!parent || !parent.parentId) {
                break;
            }

            currentParentId = parent.parentId;
        }

        return false;
    }

    /**
     * Get all categories with subcategories
     * @param {boolean} includeSubcategories - Whether to include subcategories in the response (default: true)
     * @returns {Array} - List of categories with their subcategories
     */
    async getAllCategories(includeSubcategories = true) {
        if (!includeSubcategories) {
            // Return all categories in a flat list, sorted by order then createdAt
            return await prisma.category.findMany({
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            email: true
                        }
                    },
                    updater: {
                        select: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            email: true
                        }
                    }
                },
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'desc' }
                ]
            });
        }

        // Return top-level categories with their subcategories nested
        return await prisma.category.findMany({
            where: {
                parentId: null // Only get top-level categories
            },
            include: {
                children: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                name: true,
                                phoneNumber: true,
                                email: true
                            }
                        },
                        updater: {
                            select: {
                                id: true,
                                name: true,
                                phoneNumber: true,
                                email: true
                            }
                        }
                    },
                    orderBy: [
                        { order: 'asc' },
                        { createdAt: 'desc' }
                    ]
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            },
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ]
        });
    }

    /**
     * Get category by ID
     * @param {number} id - Category ID
     * @returns {Object} - Category with products and subcategories
     */
    async getCategoryById(id) {
        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                children: {
                    orderBy: [
                        { order: 'asc' },
                        { createdAt: 'desc' }
                    ]
                },
                products: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                stock: true,
                                createdAt: true
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Format products to extract the actual product objects
        const formattedCategory = {
            ...category,
            products: category.products.map(pc => pc.product)
        };

        return formattedCategory;
    }

    /**
     * Get products by category ID (including products from subcategories if requested)
     * @param {number} categoryId - Category ID
     * @param {boolean} includeSubcategories - Whether to include products from subcategories
     * @param {number} userId - Optional user ID to include favorite status
     * @returns {Array} - List of products in category
     */
    async getCategoryProducts(categoryId, includeSubcategories = false, userId = null) {
        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: parseInt(categoryId) },
            include: {
                children: {
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

        // Build category IDs array
        const categoryIds = [parseInt(categoryId)];
        if (includeSubcategories && category.children) {
            category.children.forEach(child => {
                categoryIds.push(child.id);
            });
        }

        let products = await prisma.product.findMany({
            where: {
                deletedAt: null, // Exclude deleted products
                categories: {
                    some: {
                        categoryId: {
                            in: categoryIds
                        }
                    }
                }
            },
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
        });

        // Sort by order field in ProductCategory for the primary category
        // If multiple categories, sort by the first category's order
        if (categoryIds.length === 1) {
            const primaryCategoryId = categoryIds[0];
            products = products.sort((a, b) => {
                const aCategory = a.categories.find(pc => pc.categoryId === primaryCategoryId);
                const bCategory = b.categories.find(pc => pc.categoryId === primaryCategoryId);
                
                const aOrder = aCategory ? (aCategory.order || 0) : 999999;
                const bOrder = bCategory ? (bCategory.order || 0) : 999999;
                
                if (aOrder !== bOrder) {
                    return aOrder - bOrder; // Lower order number = appears first
                }
                // If order is same, sort by createdAt (newer first)
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } else {
            // Multiple categories - sort by createdAt as fallback
            products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Get favorite statuses if userId is provided
        let favoriteStatuses = {};
        if (userId) {
            const favoriteService = require('./favoriteService');
            const productIds = products.map(p => p.id);
            favoriteStatuses = await favoriteService.getFavoriteStatuses(userId, productIds);
        }

        // Format products with discount information and favorite status
        const productService = require('./productService');
        return products.map(product => {
            const isFavorite = favoriteStatuses[product.id] || false;
            const formatted = productService.formatProductWithDiscount(product, isFavorite);
            formatted.categories = product.categories
                ? product.categories.map(pc => pc.category)
                : [];
            // Include categoryOrders mapping (categoryId -> order)
            formatted.categoryOrders = {};
            if (product.categories) {
                product.categories.forEach(pc => {
                    formatted.categoryOrders[pc.categoryId] = pc.order;
                });
            }
            formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
            formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
            return formatted;
        });
    }

    /**
     * Create a new category
     * @param {Object} data - { name, description?, parentId?, adminId? }
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

        // If parentId is provided, validate it exists
        if (data.parentId !== undefined && data.parentId !== null) {
            const parentId = parseInt(data.parentId);
            const parentCategory = await prisma.category.findUnique({
                where: { id: parentId }
            });

            if (!parentCategory) {
                const error = new Error('Parent category not found');
                error.statusCode = 404;
                throw error;
            }
        }

        // Check if category with same name and parent already exists
        const parentId = data.parentId !== undefined && data.parentId !== null ? parseInt(data.parentId) : null;
        const existingCategory = await prisma.category.findFirst({
            where: {
                name: data.name.trim(),
                parentId: parentId
            }
        });

        if (existingCategory) {
            const error = new Error('Category with this name already exists in this parent category');
            error.statusCode = 409;
            throw error;
        }

        // Prepare category data
        const categoryData = {
            name: data.name.trim(),
            description: data.description ? data.description.trim() : null,
            parentId: parentId
        };

        // Add admin tracking if provided
        if (data.adminId !== undefined && data.adminId !== null) {
            categoryData.createdBy = parseInt(data.adminId);
            categoryData.updatedBy = parseInt(data.adminId);
        }

        // Create category
        const category = await prisma.category.create({
            data: categoryData,
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                children: true,
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        return category;
    }

    /**
     * Update a category
     * @param {number} id - Category ID
     * @param {Object} data - { name?, description?, parentId?, order?, adminId? }
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

        // If parentId is being updated, validate it
        let parentId = existingCategory.parentId;
        if (data.parentId !== undefined) {
            const newParentId = data.parentId !== null ? parseInt(data.parentId) : null;

            // Check for circular reference
            if (newParentId !== null) {
                const wouldCreateCircular = await this.wouldCreateCircularReference(parseInt(id), newParentId);
                if (wouldCreateCircular) {
                    const error = new Error('Cannot set parent: this would create a circular reference');
                    error.statusCode = 400;
                    throw error;
                }

                // Check if parent exists
                const parentCategory = await prisma.category.findUnique({
                    where: { id: newParentId }
                });

                if (!parentCategory) {
                    const error = new Error('Parent category not found');
                    error.statusCode = 404;
                    throw error;
                }
            }

            parentId = newParentId;
        }

        // If name or parentId is being updated, check for duplicates
        const nameToCheck = data.name !== undefined ? data.name.trim() : existingCategory.name;
        const parentIdToCheck = parentId !== existingCategory.parentId ? parentId : existingCategory.parentId;

        if (data.name !== undefined || data.parentId !== undefined) {
            const duplicateCategory = await prisma.category.findFirst({
                where: {
                    name: nameToCheck,
                    parentId: parentIdToCheck,
                    id: { not: parseInt(id) } // Exclude current category
                }
            });

            if (duplicateCategory) {
                const error = new Error('Category with this name already exists in this parent category');
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
        if (data.parentId !== undefined) {
            updateData.parentId = parentId;
        }
        if (data.order !== undefined && data.order !== null) {
            updateData.order = parseInt(data.order);
        }

        // Add admin tracking if provided
        if (data.adminId !== undefined && data.adminId !== null) {
            updateData.updatedBy = parseInt(data.adminId);
        }

        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                children: {
                    orderBy: [
                        { order: 'asc' },
                        { createdAt: 'desc' }
                    ]
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
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
                },
                children: {
                    select: {
                        id: true,
                        name: true
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

        // Check if category has subcategories (they will be cascade deleted, but we should inform the admin)
        if (category.children && category.children.length > 0) {
            // Note: Cascade delete will handle subcategories, but we might want to warn
            // For now, we'll allow deletion with cascade
        }

        // Delete category (cascade will delete subcategories)
        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        return category;
    }
}

module.exports = new CategoryService();

