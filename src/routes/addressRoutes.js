const express = require('express');
const addressController = require('../controllers/addressController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateAddressCreation, validateAddressUpdate } = require('../middleware/addressValidation');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Address routes
router.post('/', validateAddressCreation, addressController.createAddress);
router.get('/', addressController.getUserAddresses);
router.get('/:id', addressController.getAddressById);
router.put('/:id', validateAddressUpdate, addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.patch('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;
