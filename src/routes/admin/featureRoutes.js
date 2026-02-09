const express = require('express');
const featureController = require('../../controllers/featureController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser, authorizeAdmin);

router.get('/', featureController.getAllFeatures);
router.post('/', featureController.createFeature);
router.get('/:id', featureController.getFeatureById);
router.post('/:id/update', featureController.updateFeature);
router.post('/:id/delete', featureController.deleteFeature);

module.exports = router;
