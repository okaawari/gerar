const productService = require('../services/productService');

class ProductController {
    /**
     * Get all products with advanced search and filtering
     * GET /api/products?
     *   categoryId=1
     *   &categoryIds[]=1&categoryIds[]=2
     *   &search=laptop
     *   &inStock=true
     *   &minPrice=100&maxPrice=1000
     *   &minStock=1&maxStock=100
     *   &createdAfter=2024-01-01&createdBefore=2024-12-31
     *   &sortBy=price&sortOrder=asc
     *   &page=1&limit=20
     */
    async getAllProducts(req, res, next) {
        try {
            const { 
                categoryId, 
                categoryIds,
                search, 
                inStock,
                minPrice,
                maxPrice,
                minStock,
                maxStock,
                createdAfter,
                createdBefore,
                sortBy,
                sortOrder,
                page,
                limit
            } = req.query;

            const filters = {};

            // Handle category filters (support both single and multiple)
            // Check for categoryIds[] format (with brackets) first, then categoryIds (without brackets)
            const categoryIdsArray = req.query['categoryIds[]'] || categoryIds;
            
            if (categoryIdsArray) {
                // Handle array format: categoryIds[]=1&categoryIds[]=2 or categoryIds=1,2
                if (Array.isArray(categoryIdsArray)) {
                    // Filter out empty strings from array
                    const validIds = categoryIdsArray.filter(id => id != null && String(id).trim().length > 0);
                    if (validIds.length > 0) {
                        filters.categoryIds = validIds;
                    }
                } else if (typeof categoryIdsArray === 'string') {
                    // Comma-separated list
                    const validIds = categoryIdsArray.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    if (validIds.length > 0) {
                        filters.categoryIds = validIds;
                    }
                }
            }
            
            // Only use categoryId if categoryIds is not set
            if (!filters.categoryIds && categoryId) {
                filters.categoryId = categoryId;
            }

            if (search) {
                filters.search = search;
            }

            if (inStock !== undefined) {
                filters.inStock = inStock;
            }

            if (minPrice !== undefined) {
                filters.minPrice = minPrice;
            }

            if (maxPrice !== undefined) {
                filters.maxPrice = maxPrice;
            }

            if (minStock !== undefined) {
                filters.minStock = minStock;
            }

            if (maxStock !== undefined) {
                filters.maxStock = maxStock;
            }

            if (createdAfter !== undefined) {
                filters.createdAfter = createdAfter;
            }

            if (createdBefore !== undefined) {
                filters.createdBefore = createdBefore;
            }

            if (sortBy) {
                filters.sortBy = sortBy;
            }

            if (sortOrder) {
                filters.sortOrder = sortOrder;
            }

            if (page !== undefined) {
                filters.page = page;
            }

            if (limit !== undefined) {
                filters.limit = limit;
            }

            // Include userId if user is authenticated (for favorite status)
            if (req.user && req.user.id) {
                filters.userId = req.user.id;
            }

            const result = await productService.getAllProducts(filters);

            res.status(200).json({
                success: true,
                message: 'Products retrieved successfully',
                data: result.products,
                pagination: result.pagination
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
            // Include userId if user is authenticated (for favorite status)
            const userId = req.user && req.user.id ? req.user.id : null;
            const product = await productService.getProductById(id, userId);

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
     * Body: { name, description, price, originalPrice?, images?, stock, categoryId }
     */
    async createProduct(req, res, next) {
        try {
            const { name, description, price, originalPrice, images, stock, categoryId } = req.body;
            const product = await productService.createProduct({
                name,
                description,
                price,
                originalPrice,
                images,
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
     * Body: { name?, description?, price?, originalPrice?, images?, stock?, categoryId? }
     */
    async updateProduct(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, price, originalPrice, images, stock, categoryId } = req.body;
            const product = await productService.updateProduct(id, {
                name,
                description,
                price,
                originalPrice,
                images,
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

