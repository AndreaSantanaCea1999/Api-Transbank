// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./models'); // Importar configuración de base de datos y modelos
const transbankRoutes = require('./routes/transbankRoutes'); // Importar rutas reales

const app = express();
const PORT = process.env.PORT || 3003;

// Middlewares de seguridad y configuración (ejemplo simplificado)
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
  if (!validKeys.includes(apiKey)) {
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

// Validaciones específicas sólo para rutas que esperan JSON
app.use('/api/transbank', validateContentType);
app.use(validatePayloadSize(1024 * 1024));
app.use(detectSuspiciousPatterns);
app.use(sanitizeInput);
app.use(requestLogger);

// Validación opcional de API Key para rutas /api/transbank
app.use(
  '/api/transbank',
  process.env.API_KEYS ? validateApiKey : (req, res, next) => next(),
  transbankRoutes
);

// Ruta salud básica
app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: 'API de Transbank funcionando correctamente' });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware global para manejo de errores
app.use((err, req, res, next) => {
  console.error('Error inesperado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Función para iniciar servidor y conectar a la base de datos
async function startServer() {
  try {
    await db.testConnection();  // Probar conexión a la base de datos
    await db.sync();            // Sincronizar modelos con la base de datos

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log(`API de Transbank disponible en http://localhost:${PORT}/api/transbank`);
    });
  } catch (error) {
    console.error('❌ No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
