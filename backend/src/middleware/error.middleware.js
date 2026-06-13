const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Safe logging
  if (logger && typeof logger.error === 'function') {
    logger.error('API Error:', {
      message,
      statusCode,
      path: req.path,
      method: req.method,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  } else {
    console.error('Fallback Error Log:', message, err.stack);
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors || []
    });
  }

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500 
      ? 'Internal Server Error' 
      : message,
    error: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
}

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

module.exports = {
  errorHandler,
  AppError,
  ValidationError
};
