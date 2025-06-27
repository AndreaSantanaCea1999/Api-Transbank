// app.js - Aplicación principal de Express
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Configuración CORS para permitir conexiones desde el frontend
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3004',
        'http://localhost:3004', // Fallback para desarrollo
        process.env.BANK_API_URL || 'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Source']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Archivos estáticos (si tienes frontend)
app.use(express.static('public'));

// Importar rutas
const transbankRoutes = require('./routes/transbank');

// Usar rutas de Transbank
app.use('/api/transbank', transbankRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// Ruta principal con información de la API
app.get('/', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    res.json({
        message: '🏦 API de Integración con Transbank + Banco',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            // Transbank endpoints
            'POST /api/transbank/create': 'Crear nueva transacción',
            'GET /api/transbank': 'Crear transacción simple (compatible con PHP)',
            'GET /api/transbank/redirect/:token': 'Redirigir a formulario de pago',
            'POST /api/transbank/result': 'Confirmar resultado del pago (webhook Transbank)',
            'GET /api/transbank/status/:token': 'Obtener estado de transacción',
            'POST /api/transbank/refund/:token': 'Realizar reembolso',
            'GET /api/transbank/transaction/:token': 'Obtener información de transacción',
            'POST /api/transbank/webhook/bank': 'Webhook para API del banco',
            'GET /api/transbank/admin/transactions': 'Listar todas las transacciones (admin)',
            
            // Utility endpoints
            'GET /health': 'Health check de la API'
        },
        externalAPIs: {
            transbank: {
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'testing',
                url: process.env.NODE_ENV === 'production' 
                    ? 'https://webpay3g.transbank.cl'
                    : 'https://webpay3gint.transbank.cl'
            },
            bank: {
                url: process.env.BANK_API_URL || 'Not configured',
                status: process.env.BANK_API_URL ? 'configured' : 'not configured'
            },
            frontend: {
                url: process.env.FRONTEND_URL || 'http://localhost:3004'
            }
        },
        database: {
            host: process.env.DB_HOST || 'Not configured',
            name: process.env.DB_NAME || 'Not configured',
            status: (process.env.DB_HOST && process.env.DB_NAME) ? 'configured' : 'not configured'
        }
    });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
        path: req.originalUrl,
        availableRoutes: [
            'GET /',
            'GET /health',
            'POST /api/transbank/create',
            'GET /api/transbank',
            'GET /api/transbank/redirect/:token',
            'POST /api/transbank/result',
            'GET /api/transbank/status/:token',
            'POST /api/transbank/refund/:token',
            'GET /api/transbank/transaction/:token'
        ]
    });
});

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err.stack);
    
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack
        } : 'Error interno del servidor',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n🚀 ================================');
    console.log(`   Servidor Transbank iniciado`);
    console.log('🚀 ================================');
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏦 Transbank: ${process.env.NODE_ENV === 'production' ? 'PRODUCCIÓN' : 'TESTING'}`);
    console.log(`💾 Base de datos: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`🔗 API Banco: ${process.env.BANK_API_URL || 'No configurada'}`);
    console.log(`🖥️  Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3004'}`);
    console.log('\n📋 Endpoints principales:');
    console.log(`   http://localhost:${PORT}/`);
    console.log(`   http://localhost:${PORT}/api/transbank`);
    console.log(`   http://localhost:${PORT}/health`);
    console.log('🚀 ================================\n');
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('🛑 Cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    process.exit(0);
});

module.exports = app;