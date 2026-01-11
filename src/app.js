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
    
    // Default allowed origins including localhost (always allow localhost for development)
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

// CORS configuration - ALWAYS allow localhost, plus configured origins
app.use(cors({
    origin: (origin, callback) => {
        // CRITICAL: Always allow requests with no origin (preflight OPTIONS, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        // ALWAYS allow localhost origins (for development/testing)
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        if (isLocalhost) {
            return callback(null, true);
        }
        
        const allowedOrigins = getAllowedOrigins();
        
        // If wildcard is explicitly set, allow everything
        if (allowedOrigins === '*') {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list (from CORS_ORIGIN env var)
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Default: allow the request (permissive for now)
        // If you want stricter control, uncomment the line below and comment this
        // callback(new Error('Not allowed by CORS'));
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
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
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
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

// Handle cPanel/server error page requests
// These are typically triggered by server-level restrictions or mod_security
app.use((req, res, next) => {
    const errorPages = ['/403.shtml', '/404.shtml', '/500.shtml', '/401.shtml'];
    if (errorPages.includes(req.path)) {
        // Extract the intended status code from the path
        const statusMatch = req.path.match(/(\d{3})\.shtml/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 403;
        
        // Log for debugging - check what might have triggered this
        console.error('Server-level error page requested:', {
            path: req.path,
            method: req.method,
            originalUrl: req.originalUrl,
            referer: req.get('referer'),
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress
        });
        
        // Build helpful error message
        let errorMessage = 'Access forbidden. This may be due to server-level restrictions.';
        if (statusCode === 403) {
            errorMessage += ' Common causes: mod_security rules blocking the request, .htaccess restrictions, or file permissions.';
            errorMessage += ' If using PUT/PATCH methods, check mod_security settings in cPanel.';
        }
        
        return res.status(statusCode).json({
            success: false,
            message: `Server error: ${statusCode}`,
            error: {
                code: 'SERVER_ERROR',
                message: errorMessage,
                hint: statusCode === 403 
                    ? 'Check mod_security logs in cPanel and ensure PUT/PATCH methods are allowed. The original request was likely blocked by Apache/mod_security before reaching the Node.js application.'
                    : statusCode === 404
                    ? 'Resource not found'
                    : 'Internal server error'
            },
            timestamp: new Date().toISOString()
        });
    }
    next();
});

// Handle 404 errors for undefined routes
app.use(notFoundHandler);

// Global error handling middleware
// Should be the last middleware added
app.use(errorHandler);

module.exports = app;
