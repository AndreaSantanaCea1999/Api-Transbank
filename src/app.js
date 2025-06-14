const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Importar configuraciones y utilidades
const { testConnection } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');

// Importar rutas
const apiRoutes = require('./routes');

// Crear aplicación Express
const app = express();

// ==============================================
// MIDDLEWARES GLOBALES
// ==============================================

// Seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_BASE_URL] 
    : ['http://localhost:3000', 'http://localhost:4200', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Transbank-Signature']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Información de request
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ==============================================
// RUTAS
// ==============================================

// Rutas principales de la API
app.use('/api', apiRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'API Transbank FERREMAS',
    version: '1.0.0',
    description: 'API para integración con WebPay y gestión de pagos electrónicos',
    status: 'active',
    environment: process.env.NODE_ENV,
    documentation: '/api',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// ==============================================
// MANEJO DE ERRORES
// ==============================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// Middleware global de manejo de errores
app.use(errorHandler);

// ==============================================
// INICIALIZACIÓN DEL SERVIDOR
// ==============================================

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  try {
    // Verificar conexión a base de datos
    await testConnection();
    
    // Verificar configuración de Transbank
    const transbankService = require('./services/transbankService');
    transbankService.verificarConfiguracion();

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 API Transbank iniciada exitosamente`);
      logger.info(`📡 Servidor ejecutándose en puerto ${PORT}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV}`);
      logger.info(`🔗 URL: http://localhost:${PORT}`);
      logger.info(`📚 Documentación: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`🧪 Modo desarrollo - Usando simulación de Transbank`);
      }
    });

    // Manejo de señales para cierre graceful
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} recibido. Cerrando servidor...`);
      
      server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        
        try {
          const { closeConnection } = require('./config/database');
          await closeConnection();
          logger.info('Conexión a base de datos cerrada');
        } catch (error) {
          logger.error('Error al cerrar conexión a base de datos:', error);
        }
        
        process.exit(0);
      });
      
      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('Forzando cierre del proceso...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de errores no capturados
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', {
        reason,
        promise
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Iniciar servidor solo si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;