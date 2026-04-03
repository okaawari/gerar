const express = require('express');
const pointProductController = require('../controllers/pointProductController');

const router = express.Router();

/**
 * @route GET /api/point-products
 * @desc Get all loyalty store products
 * @access Public
 */
router.get('/', pointProductController.getAllPointProducts);

/**
 * @route GET /api/point-products/:id
 * @desc Get single loyalty product detail
 * @access Public
 */
router.get('/:id', pointProductController.getPointProductById);

module.exports = router;
