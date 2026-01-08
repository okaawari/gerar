const addressService = require('../services/addressService');

class AddressController {
    /**
     * Create a new address
     * POST /api/addresses
     */
    async createAddress(req, res, next) {
        try {
            const userId = req.user.id;
            const addressData = req.body;
            const address = await addressService.createAddress(userId, addressData);

            res.status(201).json({
                success: true,
                message: 'Address created successfully',
                data: address
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user's addresses
     * GET /api/addresses
     */
    async getUserAddresses(req, res, next) {
        try {
            const userId = req.user.id;
            const addresses = await addressService.getUserAddresses(userId);

            res.status(200).json({
                success: true,
                message: 'Addresses retrieved successfully',
                data: addresses
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get address by ID
     * GET /api/addresses/:id
     */
    async getAddressById(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const address = await addressService.getAddressById(id, userId);

            res.status(200).json({
                success: true,
                message: 'Address retrieved successfully',
                data: address
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update an address
     * PUT /api/addresses/:id
     */
    async updateAddress(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updates = req.body;
            const address = await addressService.updateAddress(id, userId, updates);

            res.status(200).json({
                success: true,
                message: 'Address updated successfully',
                data: address
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete an address
     * DELETE /api/addresses/:id
     */
    async deleteAddress(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const address = await addressService.deleteAddress(id, userId);

            res.status(200).json({
                success: true,
                message: 'Address deleted successfully',
                data: address
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Set address as default
     * PATCH /api/addresses/:id/set-default
     */
    async setDefaultAddress(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const address = await addressService.setDefaultAddress(id, userId);

            res.status(200).json({
                success: true,
                message: 'Default address updated successfully',
                data: address
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AddressController();
