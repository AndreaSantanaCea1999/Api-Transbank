const generarOrdenCompra = (prefix = 'ORD') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Formatear monto para Transbank (centavos)
 */
const formatearMontoTransbank = (monto) => {
  return Math.round(parseFloat(monto) * 100);
};

/**
 * Formatear monto desde Transbank (pesos)
 */
const formatearMontoDesdeTransbank = (centavos) => {
  return parseFloat(centavos) / 100;
};

/**
 * Validar RUT chileno
 */
const validarRUT = (rut) => {
  if (!rut || typeof rut !== 'string') return false;
  
  const cleanRut = rut.replace(/[.-]/g, '');
  if (!/^\d{7,8}[\dK]$/i.test(cleanRut)) return false;
  
  const digits = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1).toUpperCase();
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = sum % 11;
  const expectedVerifier = remainder === 0 ? '0' : remainder === 1 ? 'K' : (11 - remainder).toString();
  
  return verifier === expectedVerifier;
};

/**
 * Formatear respuesta de éxito
 */
const formatearRespuestaExito = (message, data = null, meta = {}) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
};

/**
 * Formatear respuesta de error
 */
const formatearRespuestaError = (message, code = 'GENERIC_ERROR', errors = null) => {
  const response = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

/**
 * Obtener IP del cliente (considerando proxies)
 */
const obtenerIPCliente = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

/**
 * Sanitizar datos sensibles para logs
 */
const sanitizarDatosSensibles = (obj) => {
  const sensitiveFields = ['password', 'api_key', 'secret', 'token', 'authorization'];
  const sanitized = { ...obj };

  const sanitizeRecursive = (item) => {
    if (typeof item === 'object' && item !== null) {
      for (const key in item) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          item[key] = '***REDACTED***';
        } else if (typeof item[key] === 'object') {
          sanitizeRecursive(item[key]);
        }
      }
    }
  };

  sanitizeRecursive(sanitized);
  return sanitized;
};

/**
 * Delay/sleep asíncrono
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
  generarOrdenCompra,
  formatearMontoTransbank,
  formatearMontoDesdeTransbank,
  validarRUT,
  formatearRespuestaExito,
  formatearRespuestaError,
  obtenerIPCliente,
  sanitizarDatosSensibles,
  delay
};