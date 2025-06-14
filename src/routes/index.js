const express = require('express');
const router = express.Router();

// Importar rutas específicas
const transbankRoutes = require('./transbankRoutes');
const devolucionesRoutes = require('./devolucionesRoutes');
const comerciosRoutes = require('./comerciosRoutes');
const estadisticasRoutes = require('./estadisticasRoutes');
const webhooksRoutes = require('./webhooksRoutes');

// Configurar rutas
router.use('/transbank', transbankRoutes);
router.use('/devoluciones', devolucionesRoutes);
router.use('/comercios', comerciosRoutes);
router.use('/estadisticas', estadisticasRoutes);
router.use('/webhooks', webhooksRoutes);

// Ruta principal de documentación
router.get('/', (req, res) => {
  res.json({
    name: 'API Transbank FERREMAS',
    version: '1.0.0',
    description: 'API para integración con WebPay y gestión de pagos',
    environment: process.env.NODE_ENV,
    endpoints: {
      transbank: {
        'POST /transbank/init': 'Iniciar nueva transacción',
        'POST /transbank/commit': 'Confirmar transacción',
        'GET /transbank/status/:token': 'Consultar estado de transacción',
        'GET /transbank/transactions': 'Listar transacciones'
      },
      devoluciones: {
        'POST /devoluciones': 'Solicitar devolución',
        'GET /devoluciones/:id': 'Consultar estado de devolución'
      },
      comercios: {
        'GET /comercios': 'Listar comercios',
        'POST /comercios': 'Crear nuevo comercio'
      },
      estadisticas: {
        'GET /estadisticas/dashboard': 'Dashboard de estadísticas',
        'GET /estadisticas/ventas': 'Estadísticas de ventas'
      },
      webhooks: {
        'POST /webhooks/transbank': 'Webhook de notificaciones Transbank'
      }
    },
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('../../package.json').version
  });
});

module.exports = router;
