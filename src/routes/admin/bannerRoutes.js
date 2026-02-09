const express = require('express');
const bannerController = require('../../controllers/bannerController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser, authorizeAdmin);

router.get('/', bannerController.getAllBanners);
router.post('/', bannerController.createBanner);
router.get('/:id', bannerController.getBannerById);
router.post('/:id/update', bannerController.updateBanner);
router.post('/:id/delete', bannerController.deleteBanner);

module.exports = router;
