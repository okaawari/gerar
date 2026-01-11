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
// Configure CORS to support multiple origins including localhost
const getAllowedOrigins = () => {
    const corsOrigin = process.env.CORS_ORIGIN;
    
    // If wildcard is explicitly set, allow all origins
    if (corsOrigin === '*') {
        return '*';
    }
    
    // Default allowed origins including localhost
    const defaultOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
    ];
    
    // Parse comma-separated origins from environment variable
    const envOrigins = corsOrigin 
        ? corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean)
        : [];
    
    // Combine environment origins with default localhost origins
    const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
    
    return allowedOrigins;
};

// CORS configuration with dynamic origin checking
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) {
            return callback(null, true);
        }
        
        // If wildcard is allowed
        if (allowedOrigins === '*') {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // For localhost with any port, allow it if any localhost is in the list
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocalhost && allowedOrigins.some(o => o.includes('localhost') || o.includes('127.0.0.1'))) {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
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
