const winston = require('winston');
const path = require('path');

// Configuración de formatos
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuración de transports
const transports = [
  // Consola
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
      })
    )
  })
];

// En producción, agregar archivo de log
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE) {
  const logDir = path.dirname(process.env.LOG_FILE || './logs/transbank-api.log');
  
  // Crear directorio si no existe
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/transbank-api.log',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // Log de errores separado
  transports.push(
    new winston.transports.File({
      filename: './logs/error.log',
      level: 'error',
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  // No salir en errores
  exitOnError: false
});

// Agregar método personalizado para logs de transacciones
logger.transaction = (message, meta = {}) => {
  logger.info(`[TRANSACTION] ${message}`, {
    ...meta,
    type: 'transaction'
  });
};

// Agregar método para logs de integración
logger.integration = (service, message, meta = {}) => {
  logger.info(`[INTEGRATION:${service.toUpperCase()}] ${message}`, {
    ...meta,
    service,
    type: 'integration'
  });
};

module.exports = logger;