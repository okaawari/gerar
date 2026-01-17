const express = require('express');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');
const {
    getDeliveryTimeSlots,
    updateDeliveryTimeSlots,
    getDistricts,
    updateDistricts
} = require('../../controllers/adminConstantsController');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

router.get('/delivery-time-slots', getDeliveryTimeSlots);
router.post('/delivery-time-slots', updateDeliveryTimeSlots);

router.get('/districts', getDistricts);
router.post('/districts', updateDistricts);

module.exports = router;
