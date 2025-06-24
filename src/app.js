// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./models'); // Importar modelos
const apiRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3003;

// Middlewares de seguridad y configuración
const helmet = require('helmet');
const helmetConfig = helmet();

const customCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const rateLimiters = {
  general: (req, res, next) => next(),
  createTransaction: (req, res, next) => next(),
  confirmTransaction: (req, res, next) => next(),
  critical: (req, res, next) => next(),
};

const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

const validatePayloadSize = (maxSize) => (req, res, next) => next();
const detectSuspiciousPatterns = (req, res, next) => next();
const sanitizeInput = (req, res, next) => next();
const requestLogger = (req, res, next) => next();

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  if (validKeys.length > 0 && !validKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

const requestTimeout = (ms) => (req, res, next) => {
  req.setTimeout(ms, () => res.status(503).json({ error: 'Request timeout' }));
  next();
};

// Configuraciones de middlewares generales
app.use(morgan('dev'));
app.use(helmetConfig);
app.use(customCors);
app.use(rateLimiters.general);
app.use(requestTimeout(30000));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Validaciones específicas para rutas que esperan JSON
app.use('/api/transbank', validateContentType);
app.use(validatePayloadSize(1024 * 1024));
app.use(detectSuspiciousPatterns);
app.use(sanitizeInput);
app.use(requestLogger);

// Validación opcional de API Key para rutas /api/transbank
if (process.env.API_KEYS) {
  app.use('/api/transbank', validateApiKey);
}

// Montar rutas
app.use('/api', apiRoutes);

// Ruta salud básica
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Transbank y Webpay - FERREMAS',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      api_info: '/api',
      transbank: '/api/transbank',
      webpay: '/api/webpay',
      'webpay-health': '/api/webpay/health',
      'webpay-create': 'POST /api/webpay/transactions',
      'webpay-confirm': 'PUT /api/webpay/transactions/:token',
      documentation: '/api/transbank'
    }
  });
});
// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    availableEndpoints: ['/api/transbank', '/api/webpay', '/api']
  });
});
// Middleware global para manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error inesperado:', err);
  res.status(500).json({ 
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});


async function startServer() {
  try {
    console.log('🔄 Iniciando servidor...');
    
    await db.sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida correctamente');
    
 
    console.log('📦 Usando tablas existentes (sin sincronización automática)');
    console.log('💡 Solo se usará la tabla "transacciones" existente');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`💳 API de Transbank disponible en http://localhost:${PORT}/api/transbank`);
    });
    
  } catch (error) {
    console.error('❌ No se pudo iniciar el servidor:', error);
    console.error('Detalles del error:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    process.exit(1);
  }
}

// Manejar señales de terminación
process.on('SIGTERM', async () => {
  console.log('📤 Recibida señal SIGTERM, cerrando servidor...');
  try {
    await db.sequelize.close();
    console.log('✅ Conexión a base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cerrando conexión:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('📤 Recibida señal SIGINT, cerrando servidor...');
  try {
    await db.sequelize.close();
    console.log('✅ Conexión a base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cerrando conexión:', error);
    process.exit(1);
  }
});

startServer();

module.exports = app;