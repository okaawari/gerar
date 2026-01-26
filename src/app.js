const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/errorMiddleware');
const { handleJsonErrors } = require('./middleware/validation');
const authRoutes = require('./routes/authRoutes');
const otpRoutes = require('./routes/otpRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/admin');
const { notFoundHandler } = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

const app = express();

// Ensure public/uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from public directory (for uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Middleware configuration
// Configure CORS to support multiple origins including localhost
const getAllowedOrigins = () => {
    const corsOrigin = process.env.CORS_ORIGIN;
    
    // If wildcard is explicitly set, allow all origins
    if (corsOrigin === '*') {
        return '*';
    }
    
    // Default allowed origins including localhost and production domains
    const defaultOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'http://192.168.1.3:3000',
        'http://192.168.1.3:3001',
        'http://192.168.1.3:5000',
        'http://192.168.1.3:5173',
        'http://192.168.1.3:8080',
        'https://admin.gerar.mn',
        'http://admin.gerar.mn',
        'https://api.gerar.mn',
        'http://api.gerar.mn',
        'https://gerar.mn',
        'http://gerar.mn'
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
app.use((req, res, next) => {
    // Allow Next.js internal routes (webpack HMR, etc.) to bypass CORS
    // These are internal Next.js routes that don't need CORS protection
    if (req.path.startsWith('/_next/')) {
        // Set permissive CORS headers for Next.js internal routes
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-session-token');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        
        return next();
    }
    
    cors({
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
            
            // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) in development
            // This allows mobile devices on the same network to access the API
            if (process.env.NODE_ENV === 'development') {
                const isLocalNetwork = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
                if (isLocalNetwork) {
                    return callback(null, true);
                }
            }
            
            // Allow subdomains of gerar.mn (admin.gerar.mn, api.gerar.mn, etc.)
            const isGerarDomain = /^https?:\/\/[a-zA-Z0-9-]+\.gerar\.mn(?::\d+)?$/.test(origin);
            if (isGerarDomain) {
                return callback(null, true);
            }
            
            callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-session-token'],
        exposedHeaders: ['Content-Type', 'Authorization'],
        preflightContinue: false,
        optionsSuccessStatus: 204
    })(req, res, next);
});

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

// Handle Next.js internal routes (webpack HMR, etc.)
// These routes are handled by Next.js dev server, not the Express API
// Return a simple response to avoid 404 errors in logs
app.use((req, res, next) => {
    if (req.path.startsWith('/_next/')) {
        // Return 204 No Content for Next.js internal routes
        // These should be handled by Next.js dev server, not the API server
        return res.status(204).send();
    }
    next();
});

// Handle favicon.ico requests (browsers automatically request this)
app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

// API root endpoint
app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Ecommerce API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            otp: '/api/otp',
            categories: '/api/categories',
            products: '/api/products',
            cart: '/api/cart',
            orders: '/api/orders',
            addresses: '/api/addresses',
            favorites: '/api/favorites',
            payments: '/api/orders/:id/payment-*',
            admin: '/api/admin'
        },
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
// Payment routes must be before order routes to avoid route conflicts
app.use('/api', paymentRoutes); // Payment routes (includes /api/orders/:id/payment-*)
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
            errorMessage += ' Check mod_security settings in cPanel if requests are being blocked.';
        }
        
        return res.status(statusCode).json({
            success: false,
            message: `Server error: ${statusCode}`,
            error: {
                code: 'SERVER_ERROR',
                message: errorMessage,
                hint: statusCode === 403 
                    ? 'Check mod_security logs in cPanel. The original request was likely blocked by Apache/mod_security before reaching the Node.js application.'
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