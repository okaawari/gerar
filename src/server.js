// Load app.js FIRST - before anything else
// Passenger needs the app exported immediately
let app;
try {
    app = require('./app');
    
    // Validate it's an Express app
    if (!app || typeof app.use !== 'function') {
        throw new Error('app.js did not export a valid Express app');
    }
} catch (error) {
    // If app.js fails, create minimal error app
    const express = require('express');
    app = express();
    app.get('*', (req, res) => {
        res.status(500).json({
            success: false,
            message: 'App initialization failed',
            error: error.message
        });
    });
}

// Export app IMMEDIATELY - Passenger needs this right away
module.exports = app;

// Everything below runs AFTER Passenger gets the app
// Load environment and database config in background
require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('./config/database');
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to database on startup - NON-BLOCKING for Passenger
setImmediate(async () => {
    try {
        process.stderr.write('\n🔄 Attempting database connection (background)...\n');
        await connectDatabase();
        process.stderr.write('✅ Database connected\n');
    } catch (error) {
        process.stderr.write('\n❌ DATABASE CONNECTION FAILED (async)\n');
        process.stderr.write('Error: ' + (error.message || 'Unknown error') + '\n');
        if (error.stack) {
            process.stderr.write('Stack: ' + error.stack + '\n');
        }
        process.stderr.write('\n');
    }
});

// Check if running under Passenger
const isPassenger = process.env.PASSENGER_APP_ENV || process.env.PASSENGER_APP_ROOT;

if (!isPassenger) {
    // Standalone mode - start HTTP server
    let server;
    
    const startServer = async () => {
        try {
            await connectDatabase();
            
            server = app.listen(PORT, () => {
                console.log('='.repeat(50));
                console.log(`✅ Server is running on port ${PORT}`);
                console.log(`📦 Environment: ${NODE_ENV}`);
                console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
                console.log(`📚 Health Check: http://localhost:${PORT}/`);
                console.log('='.repeat(50));
            });

            const gracefulShutdown = async (signal) => {
                console.log(`\n${signal} received. Starting graceful shutdown...`);
                
                if (server) {
                    server.close(async () => {
                        console.log('HTTP server closed');
                        await disconnectDatabase();
                        console.log('Graceful shutdown completed');
                        process.exit(0);
                    });
                    
                    setTimeout(() => {
                        console.error('Forced shutdown after timeout');
                        process.exit(1);
                    }, 10000);
                } else {
                    await disconnectDatabase();
                    process.exit(0);
                }
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        } catch (error) {
            console.error('Failed to start server:', error);
            await disconnectDatabase();
            process.exit(1);
        }
    };

    startServer();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    process.stderr.write('\n💥 UNHANDLED REJECTION!\n');
    process.stderr.write('Error: ' + (err.message || 'Unknown') + '\n');
    if (err.stack) {
        process.stderr.write('Stack: ' + err.stack + '\n');
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
    process.stderr.write('\n💥 UNCAUGHT EXCEPTION!\n');
    process.stderr.write('Error: ' + (err.message || 'Unknown') + '\n');
    if (err.stack) {
        process.stderr.write('Stack: ' + err.stack + '\n');
    }
    try {
        await disconnectDatabase();
    } catch (e) {
        // Ignore disconnect errors
    }
    process.exit(1);
});
