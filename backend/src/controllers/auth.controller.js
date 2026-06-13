const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  expiresIn: '24h', // Token expires in 24 hours
  issuer: 'arogyaai-backend',
  audience: 'arogyaai-frontend',
};

/**
 * Generate a proper JWT token that can be verified locally
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
    name: user.name,
    iat: Math.floor(Date.now() / 1000), // Issued at time
    iss: JWT_CONFIG.issuer,
    aud: JWT_CONFIG.audience,
  };

  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Verify JWT token (for internal use)
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
  } catch (error) {
    logger.warn(`Token verification failed: ${error.message}`);
    return null;
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    logger.info('User login attempt', { email });

    // TODO: Replace with actual authentication logic
    // For now, mock authentication - any credentials work
    const userId = uuidv4();
    const user = {
      id: userId,
      name: 'Arogya User',
      email: email,
      role: 'user'
    };

    // Generate proper JWT token
    const token = generateToken(user);

    logger.info('User login successful', { userId, email });

    res.status(200).json({
      success: true,
      token,
      user,
      expiresIn: JWT_CONFIG.expiresIn,
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, email: req.body.email });
    next(error);
  }
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    logger.info('User registration attempt', { email });

    // TODO: Replace with actual user creation logic
    // For now, mock registration
    const userId = uuidv4();
    const user = {
      id: userId,
      name,
      email,
      role: 'user'
    };

    // Generate proper JWT token
    const token = generateToken(user);

    logger.info('User registration successful', { userId, email });

    res.status(201).json({
      success: true,
      token,
      user,
      expiresIn: JWT_CONFIG.expiresIn,
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message, email: req.body.email });
    next(error);
  }
}

/**
 * Refresh token endpoint
 */
async function refreshToken(req, res, next) {
  try {
    const { token: oldToken } = req.body;

    if (!oldToken) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify the old token
    const decoded = verifyToken(oldToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Create user object from decoded token
    const user = {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    // Generate new token
    const newToken = generateToken(user);

    logger.info('Token refresh successful', { userId: user.id });

    res.status(200).json({
      success: true,
      token: newToken,
      user,
      expiresIn: JWT_CONFIG.expiresIn,
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    next(error);
  }
}

module.exports = {
  login,
  register,
  refreshToken,
  generateToken,
  verifyToken,
  JWT_CONFIG,
};
