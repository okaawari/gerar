require('dotenv').config();
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to database on startup
(async () => {
    try {
        await connectDatabase();
        console.log('✅ Database connected');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        // Don't exit - let the app start anyway (for Passenger)
    }
})();

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

            // Graceful shutdown handler
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
} else {
    // Passenger mode - just export the app, Passenger handles HTTP server
    console.log('✅ Running under Passenger');
    console.log(`📦 Environment: ${NODE_ENV}`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥', err.name, err.message);
    if (err.stack) console.error(err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥', err.name, err.message);
    if (err.stack) console.error(err.stack);
    await disconnectDatabase();
    process.exit(1);
});

// Export app for Passenger
module.exports = app;
