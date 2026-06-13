require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/db');
const env = require('./src/config/env');
const { initTelegramBot } = require('./src/services/telegramBot');

let isStarted = false;
const PORT = process.env.PORT || 5000;

async function startServer(port) {
  if (isStarted) return;
  isStarted = true;

  try {
    // Singleton DB connection
    await connectDB();

    const server = http.createServer(app);

    // Initialize Telegram Bot (Webhooks in prod, Polling in dev)
    initTelegramBot(app);

    server.listen(port, '0.0.0.0', () => {
      logger.info(`Server running on http://0.0.0.0:${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} busy, trying ${port + 1}`);
        isStarted = false;
        server.close();
        startServer(port + 1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

startServer(PORT);
