const categoryService = require('../services/categoryService');

class CategoryController {
    /**
     * Get all categories
     * GET /api/categories
     */
    async getAllCategories(req, res, next) {
        try {
            const categories = await categoryService.getAllCategories();

            res.status(200).json({
                success: true,
                message: 'Categories retrieved successfully',
                data: categories,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get category by ID
     * GET /api/categories/:id
     */
    async getCategoryById(req, res, next) {
        try {
            const { id } = req.params;
            const category = await categoryService.getCategoryById(id);

            res.status(200).json({
                success: true,
                message: 'Category retrieved successfully',
                data: category,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get products by category ID
     * GET /api/categories/:id/products
     */
    async getCategoryProducts(req, res, next) {
        try {
            const { id } = req.params;
            const products = await categoryService.getCategoryProducts(id);

            res.status(200).json({
                success: true,
                message: 'Category products retrieved successfully',
                data: products,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new category
     * POST /api/categories
     */
    async createCategory(req, res, next) {
        try {
            const { name, description } = req.body;
            const category = await categoryService.createCategory({ name, description });

            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: category,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a category
     * PUT /api/categories/:id
     */
    async updateCategory(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const category = await categoryService.updateCategory(id, { name, description });

            res.status(200).json({
                success: true,
                message: 'Category updated successfully',
                data: category,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a category
     * DELETE /api/categories/:id
     */
    async deleteCategory(req, res, next) {
        try {
            const { id } = req.params;
            const category = await categoryService.deleteCategory(id);

            res.status(200).json({
                success: true,
                message: 'Category deleted successfully',
                data: category,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CategoryController();

