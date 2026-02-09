const express = require('express');
const categoryRoutes = require('./categoryRoutes');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const userRoutes = require('./userRoutes');
const uploadRoutes = require('./uploadRoutes');
const constantsRoutes = require('./constantsRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const bannerRoutes = require('./bannerRoutes');
const featureRoutes = require('./featureRoutes');

const router = express.Router();

// Mount admin sub-routes
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/users', userRoutes);
router.use('/upload', uploadRoutes);
router.use('/constants', constantsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/banners', bannerRoutes);
router.use('/features', featureRoutes);

module.exports = router;
