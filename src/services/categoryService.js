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
            // Return all categories in a flat list
            return await prisma.category.findMany({
                orderBy: {
                    createdAt: 'desc'
                }
            });
        }

        // Return top-level categories with their subcategories nested
        return await prisma.category.findMany({
            where: {
                parentId: null // Only get top-level categories
            },
            include: {
                children: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
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
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
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
     * Get products by category ID (including products from subcategories if requested)
     * @param {number} categoryId - Category ID
     * @param {boolean} includeSubcategories - Whether to include products from subcategories
     * @returns {Array} - List of products in category
     */
    async getCategoryProducts(categoryId, includeSubcategories = false) {
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

        const products = await prisma.product.findMany({
            where: {
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
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format products to extract categories
        return products.map(product => {
            const formatted = { ...product };
            formatted.categories = product.categories
                ? product.categories.map(pc => pc.category)
                : [];
            formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
            formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
            return formatted;
        });
    }

    /**
     * Create a new category
     * @param {Object} data - { name, description?, parentId? }
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

        // Create category
        const category = await prisma.category.create({
            data: {
                name: data.name.trim(),
                description: data.description ? data.description.trim() : null,
                parentId: parentId
            },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                children: true
            }
        });

        return category;
    }

    /**
     * Update a category
     * @param {number} id - Category ID
     * @param {Object} data - { name?, description?, parentId? }
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
                    orderBy: {
                        createdAt: 'desc'
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

