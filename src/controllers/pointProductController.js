const pointProductService = require('../services/pointProductService');

class PointProductController {
    /**
     * Get all point products (public)
     */
    async getAllPointProducts(req, res, next) {
        try {
            const { search, page, limit } = req.query;
            const results = await pointProductService.getAllPointProducts({
                search,
                page,
                limit,
                includeHidden: false
            });
            res.json({
                success: true,
                data: results.products,
                pagination: results.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all point products (admin)
     */
    async adminGetAllPointProducts(req, res, next) {
        try {
            const { search, page, limit, isHidden } = req.query;
            const results = await pointProductService.getAllPointProducts({
                search,
                page,
                limit,
                includeHidden: true
            });
            res.json({
                success: true,
                data: results.products,
                pagination: results.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get point product by ID
     */
    async getPointProductById(req, res, next) {
        try {
            const { id } = req.params;
            const product = await pointProductService.getPointProductById(id);
            res.json({ success: true, data: product });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create point product (admin)
     */
    async createPointProduct(req, res, next) {
        try {
            const { name, description, pointsPrice, stock, images, isHidden } = req.body;
            const product = await pointProductService.createPointProduct({
                name,
                description,
                pointsPrice,
                stock,
                images,
                isHidden
            });
            res.status(201).json({
                success: true,
                message: 'Point product created successfully',
                data: pointProductService.formatPointProduct(product)
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update point product (admin)
     */
    async updatePointProduct(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, pointsPrice, stock, images, isHidden } = req.body;
            const product = await pointProductService.updatePointProduct(id, {
                name,
                description,
                pointsPrice,
                stock,
                images,
                isHidden
            });
            res.json({
                success: true,
                message: 'Point product updated successfully',
                data: pointProductService.formatPointProduct(product)
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete point product (admin)
     */
    async deletePointProduct(req, res, next) {
        try {
            const { id } = req.params;
            const product = await pointProductService.deletePointProduct(id);
            res.json({
                success: true,
                message: 'Point product deleted successfully',
                data: pointProductService.formatPointProduct(product)
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new PointProductController();
