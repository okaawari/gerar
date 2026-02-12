const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const orderService = require('./services/orderService');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Interval for checking expired pending orders (default: 5 minutes)
const EXPIRED_ORDER_CHECK_INTERVAL = parseInt(process.env.EXPIRED_ORDER_CHECK_INTERVAL) || 5 * 60 * 1000; // 5 minutes in milliseconds

let server;
let expiredOrderCheckInterval;

// Start server with database connection
const startServer = async () => {
    try {
        // Connect to database first
        await connectDatabase();

        // Start the server - listen on all network interfaces (0.0.0.0) to allow access from other devices
        server = app.listen(PORT, '0.0.0.0', () => {
            if (NODE_ENV === 'production') {
                // Compact single-line log for production
                console.log(`✅ Server started on port ${PORT} (${NODE_ENV})`);
            } else {
                // Verbose logging for development
                console.log('='.repeat(50));
                console.log(`✅ Server is running on port ${PORT}`);
                console.log(`📦 Environment: ${NODE_ENV}`);
                console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
                console.log(`📱 Network Access: http://192.168.1.3:${PORT}/api`);
                console.log(`📚 Health Check: http://localhost:${PORT}/`);
                console.log('='.repeat(50));
            }
        });

        // Start scheduled job to cancel expired pending orders
        const runExpiredOrderCheck = async () => {
            try {
                const result = await orderService.cancelExpiredPendingOrders();
                if (result.cancelled > 0) {
                    console.log(`[Expired Order Check] Cancelled ${result.cancelled} expired pending order(s)`);
                }
            } catch (error) {
                console.error('[Expired Order Check] Error:', error.message);
            }
        };

        // Run immediately on startup (after a short delay to ensure DB is ready)
        setTimeout(() => {
            runExpiredOrderCheck();
        }, 10000); // Wait 10 seconds after server starts

        // Then run periodically
        expiredOrderCheckInterval = setInterval(runExpiredOrderCheck, EXPIRED_ORDER_CHECK_INTERVAL);
        if (NODE_ENV !== 'production') {
            console.log(`⏰ Expired order check scheduled to run every ${EXPIRED_ORDER_CHECK_INTERVAL / 1000 / 60} minutes`);
        }

        // Graceful shutdown handler
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);

            // Clear expired order check interval
            if (expiredOrderCheckInterval) {
                clearInterval(expiredOrderCheckInterval);
                console.log('Expired order check interval cleared');
            }

            // Stop accepting new connections
            if (server) {
                server.close(async () => {
                    console.log('HTTP server closed');

                    // Disconnect from database
                    await disconnectDatabase();

                    console.log('Graceful shutdown completed');
                    process.exit(0);
                });

                // Force close server after 10 seconds
                setTimeout(() => {
                    console.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 10000);
            } else {
                await disconnectDatabase();
                process.exit(0);
            }
        };

        // Handle termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        console.error('Failed to start server:', error);
        await disconnectDatabase();
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    if (server) {
        server.close(async () => {
            await disconnectDatabase();
            process.exit(1);
        });
    } else {
        disconnectDatabase().then(() => process.exit(1));
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    console.error(err.stack);
    await disconnectDatabase();
    process.exit(1);
});

// Start the server
startServer();