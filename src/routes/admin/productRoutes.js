const express = require('express');
const productController = require('../../controllers/productController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Admin product management routes
// GET route must come before routes with :id parameter
router.get('/', productController.getAllProducts);
router.post('/', productController.createProduct);
router.post('/:id/update', productController.updateProduct);
router.post('/:id/delete', productController.deleteProduct);
router.post('/:id/restore', productController.restoreProduct);
router.post('/:id/hide', productController.hideProduct);
router.post('/:id/unhide', productController.unhideProduct);

module.exports = router;
