const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Rate limiter para transacciones
const transactionLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10, // máximo 10 transacciones por ventana
  message: {
    success: false,
    message: 'Demasiadas transacciones. Intenta nuevamente en unos minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Combinar IP y User-Agent para crear clave única
    return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Rate limit excedido:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
  }
});

// Rate limiter más permisivo para consultas
const queryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 consultas por minuto
  message: {
    success: false,
    message: 'Demasiadas consultas. Intenta nuevamente en un momento.',
    code: 'QUERY_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  transactionLimiter,
  queryLimiter
};
