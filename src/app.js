// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorMiddleware');
const { handleJsonErrors } = require('./middleware/validation');
const { notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

// Health check route
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Ecommerce API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Configure CORS
const getAllowedOrigins = () => {
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin === '*') return '*';
    const defaultOrigins = [
        'http://localhost:3000', 'http://localhost:3001',
        'http://localhost:5173', 'http://localhost:8080',
        'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
        'http://127.0.0.1:5173', 'http://127.0.0.1:8080'
    ];
    const envOrigins = corsOrigin 
        ? corsOrigin.split(',').map(o => o.trim()).filter(Boolean)
        : [];
    return [...new Set([...defaultOrigins, ...envOrigins])];
};

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            return callback(null, true);
        }
        const allowed = getAllowedOrigins();
        if (allowed === '*' || allowed.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Parse request bodies
app.use(express.json({ limit: '10mb', strict: true }));
app.use(handleJsonErrors);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle cPanel error pages
app.use((req, res, next) => {
    if (['/403.shtml', '/404.shtml', '/500.shtml', '/401.shtml'].includes(req.path)) {
        const match = req.path.match(/(\d{3})\.shtml/);
        const code = match ? parseInt(match[1], 10) : 403;
        return res.status(code).json({
            success: false,
            message: `Server error: ${code}`,
            error: { code: 'SERVER_ERROR', message: 'Server-level error' },
            timestamp: new Date().toISOString()
        });
    }
    next();
});

// Load routes with error handling
const createErrorRouter = (msg) => {
    const r = express.Router();
    r.all('*', (req, res) => res.status(500).json({
        success: false, message: 'Route unavailable', error: msg
    }));
    return r;
};

const loadRoute = (path, name) => {
    try {
        return require(path);
    } catch (e) {
        process.stderr.write(`❌ Failed to load ${name}: ${e.message}\n`);
        return createErrorRouter(`${name} failed: ${e.message}`);
    }
};

// Load routes synchronously (with error handling)
try {
    app.use('/api/auth', loadRoute('./routes/authRoutes', 'authRoutes'));
    app.use('/api/categories', loadRoute('./routes/categoryRoutes', 'categoryRoutes'));
    app.use('/api/products', loadRoute('./routes/productRoutes', 'productRoutes'));
    app.use('/api/cart', loadRoute('./routes/cartRoutes', 'cartRoutes'));
    app.use('/api/orders', loadRoute('./routes/orderRoutes', 'orderRoutes'));
    app.use('/api/addresses', loadRoute('./routes/addressRoutes', 'addressRoutes'));
    app.use('/api/favorites', loadRoute('./routes/favoriteRoutes', 'favoriteRoutes'));
    app.use('/api/admin', loadRoute('./routes/admin', 'adminRoutes'));
} catch (error) {
    process.stderr.write(`❌ Critical route loading error: ${error.message}\n`);
}

// Error handlers (MUST be after routes)
app.use(notFoundHandler);
app.use(errorHandler);
app.use((err, req, res, next) => {
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: 'Error handler failed'
        });
    }
});

module.exports = app;
