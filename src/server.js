require('dotenv').config();
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

// Start server with database connection
const startServer = async () => {
    try {
        // Connect to database first
        await connectDatabase();
        
        // Start the server
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