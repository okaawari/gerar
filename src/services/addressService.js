const prisma = require('../lib/prisma');

class AddressService {
    /**
     * Validate address data
     * @param {Object} data - Address data
     * @returns {Object} - { isValid, errors }
     */
    validateAddress(data) {
        const errors = [];

        // Required fields
        if (!data.fullName || typeof data.fullName !== 'string' || data.fullName.trim().length < 2) {
            errors.push('Full name is required and must be at least 2 characters');
        }

        if (!data.phoneNumber || typeof data.phoneNumber !== 'string') {
            errors.push('Phone number is required');
        } else if (!/^\d{8}$/.test(data.phoneNumber)) {
            errors.push('Phone number must be exactly 8 digits');
        }

        if (!data.provinceOrDistrict || typeof data.provinceOrDistrict !== 'string' || data.provinceOrDistrict.trim().length < 2) {
            errors.push('Province or district is required and must be at least 2 characters');
        }

        if (!data.khorooOrSoum || typeof data.khorooOrSoum !== 'string' || data.khorooOrSoum.trim().length < 2) {
            errors.push('Khoroo or soum is required and must be at least 2 characters');
        }

        // Optional fields validation
        if (data.label !== undefined && data.label !== null && typeof data.label !== 'string') {
            errors.push('Label must be a string');
        }

        if (data.street !== undefined && data.street !== null && typeof data.street !== 'string') {
            errors.push('Street must be a string');
        }

        if (data.neighborhood !== undefined && data.neighborhood !== null && typeof data.neighborhood !== 'string') {
            errors.push('Neighborhood must be a string');
        }

        if (data.residentialComplex !== undefined && data.residentialComplex !== null && typeof data.residentialComplex !== 'string') {
            errors.push('Residential complex must be a string');
        }

        if (data.building !== undefined && data.building !== null && typeof data.building !== 'string') {
            errors.push('Building must be a string');
        }

        if (data.entrance !== undefined && data.entrance !== null && typeof data.entrance !== 'string') {
            errors.push('Entrance must be a string');
        }

        if (data.apartmentNumber !== undefined && data.apartmentNumber !== null && typeof data.apartmentNumber !== 'string') {
            errors.push('Apartment number must be a string');
        }

        if (data.addressNote !== undefined && data.addressNote !== null) {
            if (typeof data.addressNote !== 'string') {
                errors.push('Address note must be a string');
            } else if (data.addressNote.length > 500) {
                errors.push('Address note must be 500 characters or less');
            }
        }

        if (data.isDefault !== undefined && typeof data.isDefault !== 'boolean') {
            errors.push('isDefault must be a boolean');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate address ownership
     * @param {number} addressId - Address ID
     * @param {number} userId - User ID
     * @returns {Promise<boolean>} - True if address belongs to user
     */
    async validateAddressOwnership(addressId, userId) {
        const address = await prisma.address.findUnique({
            where: { id: parseInt(addressId) },
            select: { userId: true }
        });

        if (!address) {
            return false;
        }

        return address.userId === parseInt(userId);
    }

    /**
     * Create a new address
     * @param {number} userId - User ID
     * @param {Object} addressData - Address data
     * @returns {Promise<Object>} - Created address
     */
    async createAddress(userId, addressData) {
        const validation = this.validateAddress(addressData);
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.details = { errors: validation.errors };
            throw error;
        }

        const userIdInt = parseInt(userId);

        // If setting as default, unset other default addresses
        if (addressData.isDefault === true) {
            await prisma.address.updateMany({
                where: { userId: userIdInt, isDefault: true },
                data: { isDefault: false }
            });
        }

        const address = await prisma.address.create({
            data: {
                userId: userIdInt,
                label: addressData.label || null,
                fullName: addressData.fullName.trim(),
                phoneNumber: addressData.phoneNumber.trim(),
                provinceOrDistrict: addressData.provinceOrDistrict.trim(),
                khorooOrSoum: addressData.khorooOrSoum.trim(),
                street: addressData.street?.trim() || null,
                neighborhood: addressData.neighborhood?.trim() || null,
                residentialComplex: addressData.residentialComplex?.trim() || null,
                building: addressData.building?.trim() || null,
                entrance: addressData.entrance?.trim() || null,
                apartmentNumber: addressData.apartmentNumber?.trim() || null,
                addressNote: addressData.addressNote?.trim() || null,
                isDefault: addressData.isDefault === true
            }
        });

        return address;
    }

    /**
     * Get all addresses for a user
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - List of addresses
     */
    async getUserAddresses(userId) {
        const addresses = await prisma.address.findMany({
            where: { userId: parseInt(userId) },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return addresses;
    }

    /**
     * Get address by ID (with ownership check)
     * @param {number} addressId - Address ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Address
     */
    async getAddressById(addressId, userId) {
        const address = await prisma.address.findUnique({
            where: { id: parseInt(addressId) }
        });

        if (!address) {
            const error = new Error('Address not found');
            error.statusCode = 404;
            throw error;
        }

        // Check ownership
        if (address.userId !== parseInt(userId)) {
            const error = new Error('Access denied. You can only view your own addresses.');
            error.statusCode = 403;
            throw error;
        }

        return address;
    }

    /**
     * Update an address
     * @param {number} addressId - Address ID
     * @param {number} userId - User ID
     * @param {Object} updates - Address updates
     * @returns {Promise<Object>} - Updated address
     */
    async updateAddress(addressId, userId, updates) {
        // Validate ownership first
        const existingAddress = await this.getAddressById(addressId, userId);

        // Validate updates if any fields are being updated
        if (Object.keys(updates).length > 0) {
            const validation = this.validateAddress(updates);
            if (!validation.isValid) {
                const error = new Error('Validation failed');
                error.statusCode = 400;
                error.details = { errors: validation.errors };
                throw error;
            }
        }

        const userIdInt = parseInt(userId);

        // If setting as default, unset other default addresses
        if (updates.isDefault === true) {
            await prisma.address.updateMany({
                where: {
                    userId: userIdInt,
                    isDefault: true,
                    id: { not: parseInt(addressId) }
                },
                data: { isDefault: false }
            });
        }

        // Prepare update data (only include fields that are being updated)
        const updateData = {};
        if (updates.label !== undefined) updateData.label = updates.label?.trim() || null;
        if (updates.fullName !== undefined) updateData.fullName = updates.fullName.trim();
        if (updates.phoneNumber !== undefined) updateData.phoneNumber = updates.phoneNumber.trim();
        if (updates.provinceOrDistrict !== undefined) updateData.provinceOrDistrict = updates.provinceOrDistrict.trim();
        if (updates.khorooOrSoum !== undefined) updateData.khorooOrSoum = updates.khorooOrSoum.trim();
        if (updates.street !== undefined) updateData.street = updates.street?.trim() || null;
        if (updates.neighborhood !== undefined) updateData.neighborhood = updates.neighborhood?.trim() || null;
        if (updates.residentialComplex !== undefined) updateData.residentialComplex = updates.residentialComplex?.trim() || null;
        if (updates.building !== undefined) updateData.building = updates.building?.trim() || null;
        if (updates.entrance !== undefined) updateData.entrance = updates.entrance?.trim() || null;
        if (updates.apartmentNumber !== undefined) updateData.apartmentNumber = updates.apartmentNumber?.trim() || null;
        if (updates.addressNote !== undefined) updateData.addressNote = updates.addressNote?.trim() || null;
        if (updates.isDefault !== undefined) updateData.isDefault = updates.isDefault === true;

        const updatedAddress = await prisma.address.update({
            where: { id: parseInt(addressId) },
            data: updateData
        });

        return updatedAddress;
    }

    /**
     * Delete an address
     * @param {number} addressId - Address ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Deleted address
     */
    async deleteAddress(addressId, userId) {
        // Validate ownership first
        const address = await this.getAddressById(addressId, userId);

        // Check if address is used in any orders
        const orderCount = await prisma.order.count({
            where: { addressId: parseInt(addressId) }
        });

        if (orderCount > 0) {
            const error = new Error('Cannot delete address that is used in existing orders');
            error.statusCode = 400;
            error.details = { orderCount };
            throw error;
        }

        const deletedAddress = await prisma.address.delete({
            where: { id: parseInt(addressId) }
        });

        return deletedAddress;
    }

    /**
     * Set address as default
     * @param {number} addressId - Address ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Updated address
     */
    async setDefaultAddress(addressId, userId) {
        // Validate ownership first
        await this.getAddressById(addressId, userId);

        const userIdInt = parseInt(userId);

        // Unset other default addresses
        await prisma.address.updateMany({
            where: {
                userId: userIdInt,
                isDefault: true,
                id: { not: parseInt(addressId) }
            },
            data: { isDefault: false }
        });

        // Set this address as default
        const updatedAddress = await prisma.address.update({
            where: { id: parseInt(addressId) },
            data: { isDefault: true }
        });

        return updatedAddress;
    }

    /**
     * Get user's default address
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>} - Default address or null
     */
    async getDefaultAddress(userId) {
        const address = await prisma.address.findFirst({
            where: {
                userId: parseInt(userId),
                isDefault: true
            }
        });

        return address;
    }
}

module.exports = new AddressService();
