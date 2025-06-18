// === src/app.js - VERSIÓN COMPLETA CON SEGURIDAD Y LOGGING ===
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Importar configuraciones y middlewares
const sequelize = require('./database');
const transbankRoutes = require('./routes/transbankRoutes');
const { logger, requestLogger } = require('./utils/logger');
const {
  rateLimiters,
  validateContentType,
  validatePayloadSize,
  detectSuspiciousPatterns,
  logAccess,
  sanitizeInput,
  helmetConfig,
  validateApiKey,
  customCors,
  requestTimeout
} = require('./middlewares/security');

const app = express();
const PORT = process.env.PORT || 3003;

// ====================================
// CONFIGURACIÓN DE LOGGING
// ====================================

// Configurar morgan para usar nuestro logger
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' 
  : 'dev';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.info('HTTP', { message: message.trim() });
    }
  }
}));

// ====================================
// MIDDLEWARES DE SEGURIDAD
// ====================================

// Helmet para headers de seguridad
app.use(helmetConfig);

// CORS personalizado con logging
app.use(customCors);

// Rate limiting general
app.use(rateLimiters.general);

// Timeout para requests
app.use(requestTimeout(30000)); // 30 segundos

// Logging de accesos
app.use(logAccess);

// ====================================
// MIDDLEWARES DE PARSING Y VALIDACIÓN
// ====================================

// Body parser con límite de tamaño
app.use(express.json({ 
  limit: '1mb',
  strict: true,
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb' 
}));

// Validación de Content-Type
app.use(validateContentType);

// Validación de tamaño de payload
app.use(validatePayloadSize(1024 * 1024)); // 1MB

// Detección de patrones sospechosos
app.use(detectSuspiciousPatterns);

// Sanitización de inputs
app.use(sanitizeInput);

// Request logger personalizado
app.use(requestLogger);

// ====================================
// MIDDLEWARE DE API KEY (OPCIONAL)
// ====================================

// Solo aplicar validación de API key si está configurada
if (process.env.API_KEYS) {
  app.use('/api/transbank', validateApiKey);
  logger.info('API Key validation enabled');
}

// ====================================
// RUTAS PRINCIPALES
// ====================================

// Ruta de salud básica (sin rate limiting estricto)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'api-transbank-ferremas',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: 'connected' // Se validará en startServer
  });
});

// Ruta raíz con información de la API
app.get('/', (req, res) => {
  res.status(200).json({
    message: '📦 API de Transbank FERREMAS funcionando correctamente',
    version: '1.0.0',
    description: 'Orquestador de transacciones que integra Inventario y Banco',
    documentation: {
      endpoints: '/api/transbank',
      swagger: '/api/transbank/docs', // Si se implementa Swagger UI
      postman: 'Ver colección en docs/FERREMAS_API_Collection.postman_collection.json'
    },
    integrations: {
      inventario: {
        url: process.env.INVENTORY_API_URL,
        description: 'API de gestión de inventario y productos'
      },
      banco: {
        url: process.env.BANK_API_URL,
        description: 'API de procesamiento de pagos'
      }
    },
    features: [
      'Gestión de transacciones end-to-end',
      'Verificación automática de stock',
      'Procesamiento de pagos integrado',
      'Logging y auditoría completa',
      'Monitoreo de salud del sistema',
      'Rate limiting y seguridad avanzada'
    ],
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// ====================================
// RUTAS DE LA API TRANSBANK
// ====================================

// Aplicar rate limiting específico para endpoints críticos
app.use('/api/transbank/iniciar', rateLimiters.createTransaction);
app.use('/api/transbank/confirmar', rateLimiters.confirmTransaction);
app.use('/api/transbank/health', rateLimiters.critical);
app.use('/api/transbank/stats', rateLimiters.critical);

// Rutas principales de Transbank
app.use('/api/transbank', transbankRoutes);

// ====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ====================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  const error = {
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    availableEndpoints: {
      info: '/',
      health: '/health',
      transbank: '/api/transbank',
      documentation: '/api/transbank/'
    },
    method: req.method,
    timestamp: new Date().toISOString()
  };

  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user_agent: req.headers['user-agent']
  });

  res.status(404).json(error);
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  const errorId = Date.now().toString();
  
  // Log del error
  logger.error('Unhandled error', error, {
    error_id: errorId,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user_agent: req.headers['user-agent'],
    body: req.body
  });

  // Respuesta al cliente
  const response = {
    success: false,
    message: 'Error interno del servidor',
    error_id: errorId,
    timestamp: new Date().toISOString()
  };

  // En desarrollo, incluir detalles del error
  if (process.env.NODE_ENV === 'development') {
    response.error_details = {
      message: error.message,
      stack: error.stack
    };
  }

  res.status(error.status || 500).json(response);
});

// ====================================
// FUNCIONES DE INICIALIZACIÓN
// ====================================

// Función para verificar conectividad con APIs externas
async function checkExternalAPIs() {
  const axios = require('axios');
  const results = {
    inventario: false,
    banco: false
  };

  try {
    logger.info('Verificando conectividad con APIs externas...');

    // Verificar API Inventario
    try {
      await axios.get(`${process.env.INVENTORY_API_URL}/productos`, { timeout: 5000 });
      results.inventario = true;
      logger.info('✅ API Inventario: Conectada');
    } catch (error) {
      logger.warn('⚠️ API Inventario: No disponible', { error: error.message });
    }

    // Verificar API Banco
    try {
      await axios.get(`${process.env.BANK_API_URL}/`, { timeout: 5000 });
      results.banco = true;
      logger.info('✅ API Banco: Conectada');
    } catch (error) {
      logger.warn('⚠️ API Banco: No disponible', { error: error.message });
    }

  } catch (error) {
    logger.error('Error verificando APIs externas', error);
  }

  return results;
}

// Función para configurar el graceful shutdown
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`Recibida señal ${signal}, iniciando graceful shutdown...`);

    // Cerrar servidor HTTP
    server.close(async () => {
      logger.info('Servidor HTTP cerrado');

      try {
        // Cerrar conexión a base de datos
        await sequelize.close();
        logger.info('Conexión a base de datos cerrada');

        logger.info('Graceful shutdown completado');
        process.exit(0);
      } catch (error) {
        logger.error('Error durante graceful shutdown', error);
        process.exit(1);
      }
    });

    // Forzar salida después de 10 segundos
    setTimeout(() => {
      logger.error('Graceful shutdown tomó demasiado tiempo, forzando salida');
      process.exit(1);
    }, 10000);
  };

  // Escuchar señales de terminación
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ====================================
// FUNCIÓN PRINCIPAL DE INICIO
// ====================================

const startServer = async () => {
  try {
    logger.info('🚀 Iniciando API Transbank FERREMAS...');

    // 1. Verificar variables de entorno críticas
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'INVENTORY_API_URL', 'BANK_API_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    logger.info('✅ Variables de entorno verificadas');

    // 2. Conectar a base de datos
    await sequelize.authenticate();
    logger.info('✅ Conexión a la base de datos establecida');
    
    // 3. Sincronizar modelos
    await sequelize.sync({ alter: false });
    logger.info('📦 Modelos sincronizados correctamente');

    // 4. Verificar APIs externas
    const apiStatus = await checkExternalAPIs();
    if (!apiStatus.inventario || !apiStatus.banco) {
      logger.warn('⚠️ Algunas APIs externas no están disponibles. El sistema funcionará con capacidades limitadas.');
    }

    // 5. Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info('🎉 Servidor iniciado exitosamente', {
        port: PORT,
        environment: process.env.NODE_ENV,
        url: `http://localhost:${PORT}`,
        api_url: `http://localhost:${PORT}/api/transbank`,
        health_url: `http://localhost:${PORT}/health`,
        timestamp: new Date().toISOString()
      });

      logger.info('📍 URLs importantes:', {
        api_transbank: `http://localhost:${PORT}/api/transbank`,
        health_check: `http://localhost:${PORT}/health`,
        api_info: `http://localhost:${PORT}`,
        inventario_integration: process.env.INVENTORY_API_URL,
        banco_integration: process.env.BANK_API_URL
      });

      logger.info('🔧 Configuración activa:', {
        rate_limiting: 'Enabled',
        api_key_validation: process.env.API_KEYS ? 'Enabled' : 'Disabled',
        cors: 'Custom CORS enabled',
        security_headers: 'Helmet enabled',
        request_logging: 'Enabled',
        environment: process.env.NODE_ENV
      });
    });

    // 6. Configurar graceful shutdown
    setupGracefulShutdown(server);

    // 7. Log de inicio completado
    logger.info('🚀 API Transbank FERREMAS iniciada correctamente y lista para recibir requests');

  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error);
    
    // Intentar cerrar conexiones si existen
    try {
      await sequelize.close();
    } catch (dbError) {
      logger.error('Error cerrando conexión a BD durante cleanup:', dbError);
    }

    process.exit(1);
  }
};

// ====================================
// MANEJO DE EXCEPCIONES NO CAPTURADAS
// ====================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// ====================================
// INICIAR EL SERVIDOR
// ====================================

startServer();

module.exports = app;