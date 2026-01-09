const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorMiddleware');
const { handleJsonErrors } = require('./middleware/validation');
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const adminRoutes = require('./routes/admin');
const { notFoundHandler } = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

const app = express();

// Middleware configuration
// Enable CORS for all routes
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Parse JSON request bodies with size limit
app.use(express.json({
    limit: '10mb',
    strict: true
}));

// Handle JSON parsing errors
app.use(handleJsonErrors);

// Parse URL-encoded request bodies
app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Basic health check route
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Ecommerce API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/favorites', favoriteRoutes);

// Admin API routes (requires authentication and admin role)
app.use('/api/admin', adminRoutes);

// Handle 404 errors for undefined routes
app.use(notFoundHandler);

// Global error handling middleware
// Should be the last middleware added
app.use(errorHandler);

module.exports = app;
