const express = require('express');
const pointProductController = require('../../controllers/pointProductController');

const router = express.Router();

/**
 * @route GET /api/admin/point-products
 * @desc Get all loyalty rewards (includes hidden)
 * @access Admin
 */
router.get('/', pointProductController.adminGetAllPointProducts);

/**
 * @route POST /api/admin/point-products
 * @desc Create new loyalty reward item
 * @access Admin
 */
router.post('/', pointProductController.createPointProduct);

/**
 * @route PUT /api/admin/point-products/:id
 * @desc Update loyalty reward item
 * @access Admin
 */
router.put('/:id', pointProductController.updatePointProduct);

/**
 * @route DELETE /api/admin/point-products/:id
 * @desc Remove loyalty reward item
 * @access Admin
 */
router.delete('/:id', pointProductController.deletePointProduct);

module.exports = router;
