const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/error.middleware');
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const emergencyRoutes = require('./routes/emergency.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const userRoutes = require('./routes/user.routes');
const triageRoutes = require('./routes/triage.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const timelineRoutes = require('./routes/timeline.routes');
const medicalQrRoutes = require('./routes/medicalQr.routes');
const { authMiddleware } = require('./middleware/auth.middleware');
const logger = require('./utils/logger');

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  process.env.FRONTEND_URL,
  process.env.BACKEND_URL,
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin) || process.env.CORS_ORIGIN === '*') {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // In dev, allow all; tighten in production
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.options('*', cors());

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Single request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ArogyaAI Backend"
  });
});

// Register medical QR routes (contains both public and protected sub-routes)
app.use('/api/medical-qr', medicalQrRoutes);

// Public Routes
app.use('/api/auth', authRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/hospitals', hospitalRoutes);

// Protected Routes
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/emergency', authMiddleware, emergencyRoutes);
app.use('/api/appointment', authMiddleware, appointmentRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/timeline', authMiddleware, timelineRoutes);

app.use(errorHandler);

module.exports = app;
