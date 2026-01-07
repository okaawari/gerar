const productService = require('../services/productService');

class ProductController {
    /**
     * Get all products with optional filters
     * GET /api/products?categoryId=1&search=laptop&inStock=true
     */
    async getAllProducts(req, res, next) {
        try {
            const { categoryId, search, inStock } = req.query;
            const filters = {};

            if (categoryId) {
                filters.categoryId = categoryId;
            }

            if (search) {
                filters.search = search;
            }

            if (inStock !== undefined) {
                filters.inStock = inStock;
            }

            const products = await productService.getAllProducts(filters);

            res.status(200).json({
                success: true,
                message: 'Products retrieved successfully',
                data: products,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get product by ID
     * GET /api/products/:id
     */
    async getProductById(req, res, next) {
        try {
            const { id } = req.params;
            const product = await productService.getProductById(id);

            res.status(200).json({
                success: true,
                message: 'Product retrieved successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new product
     * POST /api/products
     */
    async createProduct(req, res, next) {
        try {
            const { name, description, price, stock, categoryId } = req.body;
            const product = await productService.createProduct({
                name,
                description,
                price,
                stock,
                categoryId
            });

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a product
     * PUT /api/products/:id
     */
    async updateProduct(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, price, stock, categoryId } = req.body;
            const product = await productService.updateProduct(id, {
                name,
                description,
                price,
                stock,
                categoryId
            });

            res.status(200).json({
                success: true,
                message: 'Product updated successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a product
     * DELETE /api/products/:id
     */
    async deleteProduct(req, res, next) {
        try {
            const { id } = req.params;
            const product = await productService.deleteProduct(id);

            res.status(200).json({
                success: true,
                message: 'Product deleted successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ProductController();

