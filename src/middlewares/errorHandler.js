const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  logger.error('Error en API:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body
  });

  // Errores de Sequelize
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(val => val.message).join(', ');
    error = {
      success: false,
      message: 'Error de validación',
      errors: err.errors.map(e => e.message),
      code: 'VALIDATION_ERROR'
    };
    return res.status(400).json(error);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Recurso duplicado';
    error = {
      success: false,
      message,
      code: 'DUPLICATE_RESOURCE'
    };
    return res.status(409).json(error);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Error de integridad referencial';
    error = {
      success: false,
      message,
      code: 'FOREIGN_KEY_ERROR'
    };
    return res.status(400).json(error);
  }

  // Errores de conexión a base de datos
  if (err.name === 'SequelizeConnectionError') {
    error = {
      success: false,
      message: 'Error de conexión a base de datos',
      code: 'DATABASE_ERROR'
    };
    return res.status(503).json(error);
  }

  // Errores de timeout
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    error = {
      success: false,
      message: 'Timeout en la operación',
      code: 'TIMEOUT_ERROR'
    };
    return res.status(504).json(error);
  }

  // Error por defecto del servidor
  error = {
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
    code: 'INTERNAL_ERROR'
  };

  res.status(err.statusCode || 500).json(error);
};

module.exports = errorHandler;
