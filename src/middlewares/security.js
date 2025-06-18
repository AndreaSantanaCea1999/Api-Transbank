// ====================================
// MIDDLEWARE DE SEGURIDAD AVANZADO
// ====================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { logger } = require('../utils/logger');

// Rate limiting por IP
const createRateLimiter = (windowMs, max, message, keyGenerator = null) => {
  return rateLimit({
    windowMs,
    max,
    message: { 
      success: false, 
      message,
      retry_after: Math.ceil(windowMs / 1000)
    },
    keyGenerator: keyGenerator || ((req) => req.ip),
    handler: (req, res) => {
      logger.security('warn', 'Rate limit exceeded', req.ip, req.headers['user-agent'], {
        endpoint: req.originalUrl,
        method: req.method,
        limit_type: 'general'
      });
      
      res.status(429).json({
        success: false,
        message,
        retry_after: Math.ceil(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Rate limiters específicos
const rateLimiters = {
  // Límite general
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutos
    100, // máximo 100 requests por IP
    'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos'
  ),

  // Límite estricto para endpoints críticos
  critical: createRateLimiter(
    5 * 60 * 1000, // 5 minutos
    10, // máximo 10 requests por IP
    'Límite estricto alcanzado para endpoints críticos, intenta en 5 minutos'
  ),

  // Límite para creación de transacciones
  createTransaction: createRateLimiter(
    1 * 60 * 1000, // 1 minuto
    5, // máximo 5 transacciones por minuto por IP
    'Demasiadas transacciones creadas, espera 1 minuto'
  ),

  // Límite para confirmación de transacciones
  confirmTransaction: createRateLimiter(
    30 * 1000, // 30 segundos
    3, // máximo 3 confirmaciones por 30 segundos
    'Demasiadas confirmaciones de transacción, espera 30 segundos'
  )
};

// Validación de Content-Type
const validateContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      logger.security('warn', 'Invalid content type', req.ip, req.headers['user-agent'], {
        content_type: contentType,
        endpoint: req.originalUrl,
        method: req.method
      });
      
      return res.status(400).json({
        success: false,
        message: 'Content-Type debe ser application/json'
      });
    }
  }
  next();
};

// Validación de tamaño de payload
const validatePayloadSize = (maxSize = 1024 * 1024) => { // 1MB por defecto
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      logger.security('warn', 'Payload too large', req.ip, req.headers['user-agent'], {
        content_length: contentLength,
        max_size: maxSize,
        endpoint: req.originalUrl
      });
      
      return res.status(413).json({
        success: false,
        message: `Payload demasiado grande. Máximo permitido: ${maxSize} bytes`
      });
    }
    next();
  };
};

// Detección de patrones sospechosos
const detectSuspiciousPatterns = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script|javascript:|data:)/i,
    /(union\s+select|drop\s+table|insert\s+into)/i,
    /(\.\.\/)|(\.\.\\)/,
    /(eval\s*\(|setTimeout\s*\(|setInterval\s*\()/i
  ];

  const userAgent = req.headers['user-agent'] || '';
  const url = req.originalUrl;
  const bodyString = JSON.stringify(req.body || {});

  // Verificar patrones en URL, body y user agent
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || 
    pattern.test(bodyString) || 
    pattern.test(userAgent)
  );

  if (isSuspicious) {
    logger.security('error', 'Suspicious pattern detected', req.ip, userAgent, {
      endpoint: url,
      method: req.method,
      body_snippet: bodyString.substring(0, 200),
      threat_type: 'pattern_detection'
    });

    return res.status(400).json({
      success: false,
      message: 'Solicitud rechazada por patrones sospechosos'
    });
  }

  next();
};

// Verificación de headers requeridos
const requireHeaders = (requiredHeaders) => {
  return (req, res, next) => {
    const missingHeaders = requiredHeaders.filter(header => 
      !req.headers[header.toLowerCase()]
    );

    if (missingHeaders.length > 0) {
      logger.security('warn', 'Missing required headers', req.ip, req.headers['user-agent'], {
        missing_headers: missingHeaders,
        endpoint: req.originalUrl
      });

      return res.status(400).json({
        success: false,
        message: `Headers requeridos faltantes: ${missingHeaders.join(', ')}`
      });
    }

    next();
  };
};

// Middleware para logging de accesos
const logAccess = (req, res, next) => {
  const start = Date.now();
  
  // Log del request
  logger.security('info', 'API Access', req.ip, req.headers['user-agent'], {
    method: req.method,
    endpoint: req.originalUrl,
    timestamp: new Date().toISOString(),
    request_id: req.id || Date.now().toString()
  });

  // Interceptar respuesta para log completo
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.security('info', 'API Response', req.ip, req.headers['user-agent'], {
      method: req.method,
      endpoint: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: duration,
      request_id: req.id || start.toString()
    });

    return originalSend.call(this, data);
  };

  next();
};

// Sanitización de inputs
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remover caracteres peligrosos
      return value
        .replace(/[<>]/g, '') // Remover < y >
        .replace(/javascript:/gi, '') // Remover javascript:
        .replace(/data:/gi, '') // Remover data:
        .trim();
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'object') {
            sanitizeObject(obj[key]);
          } else {
            obj[key] = sanitizeValue(obj[key]);
          }
        }
      }
    }
  };

  // Sanitizar body
  if (req.body) {
    sanitizeObject(req.body);
  }

  // Sanitizar query params
  if (req.query) {
    sanitizeObject(req.query);
  }

  next();
};

// Configuración de Helmet para headers de seguridad
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Puede interferir con APIs
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  }
});

// Middleware de validación de API Key (opcional)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

  // Si no hay API keys configuradas, saltar validación
  if (validApiKeys.length === 0) {
    return next();
  }

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    logger.security('warn', 'Invalid or missing API key', req.ip, req.headers['user-agent'], {
      endpoint: req.originalUrl,
      api_key_provided: !!apiKey
    });

    return res.status(401).json({
      success: false,
      message: 'API key requerida o inválida'
    });
  }

  next();
};

// CORS personalizado con logging
const customCors = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'];

  // Log de CORS
  logger.security('debug', 'CORS Request', req.ip, req.headers['user-agent'], {
    origin,
    method: req.method,
    endpoint: req.originalUrl
  });

  // Configurar headers CORS
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,x-api-key');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
};

// Middleware de timeout para requests
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeoutMs, () => {
      logger.security('error', 'Request timeout', req.ip, req.headers['user-agent'], {
        endpoint: req.originalUrl,
        method: req.method,
        timeout_ms: timeoutMs
      });

      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout'
        });
      }
    });

    next();
  };
};

module.exports = {
  rateLimiters,
  validateContentType,
  validatePayloadSize,
  detectSuspiciousPatterns,
  requireHeaders,
  logAccess,
  sanitizeInput,
  helmetConfig,
  validateApiKey,
  customCors,
  requestTimeout
};