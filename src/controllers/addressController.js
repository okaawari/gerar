const addressService = require('../services/addressService');
const { getDistricts, getKhorooOptions, isValidDistrict } = require('../constants/districts');
const { getOffDeliveryDatesConfig } = require('../config/offDeliveryDates');

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
     * POST /api/addresses/:id/update
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
     * POST /api/addresses/:id/delete
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
     * POST /api/addresses/:id/set-default
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

    /**
     * Get list of available districts
     * GET /api/addresses/districts
     */
    async getDistricts(req, res, next) {
        try {
            const districts = getDistricts();

            res.status(200).json({
                success: true,
                message: 'Districts retrieved successfully',
                data: districts
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get off-delivery dates (weekdays and specific dates when delivery is unavailable)
     * GET /api/addresses/off-delivery-dates
     * Used by orders/create page when user selects delivery date.
     */
    async getOffDeliveryDates(req, res, next) {
        try {
            const { offWeekdays, offDates } = getOffDeliveryDatesConfig();

            res.status(200).json({
                success: true,
                message: 'Off-delivery dates retrieved successfully',
                data: { offWeekdays, offDates }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get khoroo options for a specific district
     * GET /api/addresses/khoroo?district=Багануур дүүрэг
     */
    async getKhorooOptions(req, res, next) {
        try {
            const { district } = req.query;

            if (!district) {
                const error = new Error('District parameter is required');
                error.statusCode = 400;
                throw error;
            }

            if (!isValidDistrict(district)) {
                const error = new Error('Invalid district');
                error.statusCode = 400;
                throw error;
            }

            const khorooOptions = getKhorooOptions(district);

            res.status(200).json({
                success: true,
                message: 'Khoroo options retrieved successfully',
                data: {
                    district,
                    khorooOptions
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AddressController();
