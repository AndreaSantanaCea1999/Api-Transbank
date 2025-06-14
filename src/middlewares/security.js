const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const constants = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Rate limiter específico para transacciones
 */
const transactionRateLimit = rateLimit({
  windowMs: constants.RATE_LIMITS.WINDOW_SIZE_MS,
  max: constants.RATE_LIMITS.TRANSACTIONS_PER_MINUTE,
  message: {
    success: false,
    message: constants.ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    code: 'TRANSACTION_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    // Combinar IP, User-Agent y posible ID de usuario
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = req.user?.id || 'anonymous';
    return `trans_${ip}_${userId}_${Buffer.from(userAgent).toString('base64').substring(0, 10)}`;
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Rate limit para transacciones excedido:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Slowdown para consultas frecuentes
 */
const querySlowDown = slowDown({
  windowMs: 60 * 1000, // 1 minuto
  delayAfter: 30, // Después de 30 requests, empezar a agregar delay
  delayMs: 100, // Incrementar 100ms por cada request adicional
  maxDelayMs: 2000, // Máximo delay de 2 segundos
  keyGenerator: (req) => {
    return req.ip + req.get('User-Agent');
  }
});

/**
 * Validador de Content-Type
 */
const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type debe ser application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }
  }
  
  next();
};

/**
 * Validador de tamaño de payload
 */
const validatePayloadSize = (req, res, next) => {
  const contentLength = req.get('Content-Length');
  const maxSize = 1024 * 1024; // 1MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Payload demasiado grande',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

/**
 * Sanitizador de entrada
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remover caracteres potencialmente peligrosos
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
};

/**
 * Logger de requests sospechosos
 */
const logSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /\b(script|javascript|vbscript)\b/i,
    /\b(union|select|insert|update|delete|drop)\b/i,
    /<[^>]*>/,
    /\.\./
  ];
  
  const checkSuspicious = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkSuspicious);
    }
    return false;
  };
  
  const isSuspicious = checkSuspicious(req.body) || 
                     checkSuspicious(req.query) || 
                     checkSuspicious(req.params);
  
  if (isSuspicious) {
    logger.warn('Actividad sospechosa detectada:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

module.exports = {
  transactionRateLimit,
  querySlowDown,
  validateContentType,
  validatePayloadSize,
  sanitizeInput,
  logSuspiciousActivity
};
