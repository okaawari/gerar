const express = require('express');
const featureController = require('../controllers/featureController');
const { optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', optionallyAuthenticateUser, featureController.getAllFeatures);
router.get('/:id', optionallyAuthenticateUser, featureController.getFeatureById);

module.exports = router;
