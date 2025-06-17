// src/routes/transbankRoutes.js
const express = require('express');
const router = express.Router();

// Importa el controlador con todas las funciones
const controller = require('../controllers/transbankController');

// Middleware de validación básica
const validarContentType = (req, res, next) => {
  if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({
      success: false,
      message: 'Content-Type debe ser application/json'
    });
  }
  next();
};

// Aplicar middleware a todas las rutas POST
router.use(validarContentType);

// ============================
// RUTAS PRINCIPALES DE TRANSACCIONES
// ============================

// Iniciar una nueva transacción
router.post('/iniciar', controller.iniciarTransaccion);

// Registrar detalle de la transacción
router.post('/detalle', controller.detalle);

// Confirmar la transacción (orquesta Banco + Inventario)
router.post('/confirmar', controller.confirmar);

// ============================
// RUTAS DE CONSULTA
// ============================

// Obtener el estado de una transacción por ID
router.get('/estado/:id', controller.obtenerEstado);

// Listar todas las transacciones con su estado
// Query params: ?estado=Aprobado&cliente_id=1&fecha_inicio=2024-01-01&fecha_fin=2024-12-31&limit=10&offset=0
router.get('/listar', controller.listarTransacciones);

// ============================
// RUTAS DE LOGS Y AUDITORIA
// ============================

// Listar todos los logs de transacciones
// Query params: ?accion=CONFIRMAR_TRANSACCION&id_transaccion=1&fecha_inicio=2024-01-01&limit=20&offset=0
router.get('/logs', controller.obtenerLogs);

// ============================
// RUTAS DE MONITOREO Y SALUD
// ============================

// Verificar salud de las conexiones con APIs externas
router.get('/health', controller.verificarSalud);

// Obtener estadísticas rápidas del sistema
router.get('/stats', controller.obtenerEstadisticas);

// ============================
// RUTA DE INFORMACIÓN DE LA API
// ============================

// Información general de la API Transbank
router.get('/', (req, res) => {
  res.json({
    mensaje: '🏦 API Transbank FERREMAS - Orquestador de Transacciones',
    version: '1.0.0',
    descripcion: 'API para gestionar transacciones integrando Inventario y Banco',
    endpoints: {
      transacciones: {
        'POST /iniciar': 'Crear nueva transacción',
        'POST /detalle': 'Registrar detalles de transacción',
        'POST /confirmar': 'Confirmar transacción (proceso completo)',
        'GET /estado/:id': 'Obtener estado de transacción',
        'GET /listar': 'Listar transacciones con filtros'
      },
      monitoreo: {
        'GET /health': 'Verificar salud de conexiones externas',
        'GET /stats': 'Estadísticas del sistema',
        'GET /logs': 'Logs de auditoria con filtros'
      }
    },
    integraciones: {
      inventario: {
        url: process.env.INVENTORY_API_URL,
        descripcion: 'Verificación de stock y creación de pedidos'
      },
      banco: {
        url: process.env.BANK_API_URL,
        descripcion: 'Registro de pagos y procesamiento WebPay'
      }
    },
    ejemplos: {
      crear_transaccion: {
        method: 'POST',
        url: '/api/transbank/iniciar',
        body: {
          clienteId: 1,
          ordenCompra: 'ORD-001',
          monto: 50000,
          divisa: 'CLP',
          detalles: [
            {
              ID_Producto: 1,
              Cantidad: 2,
              Precio_Unitario: 25000
            }
          ]
        }
      },
      confirmar_transaccion: {
        method: 'POST',
        url: '/api/transbank/confirmar',
        body: {
          id_transaccion: 1
        }
      }
    },
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// ============================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================

// Middleware para manejar rutas no encontradas en el router de transbank
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} no encontrado en la API Transbank`,
    endpoints_disponibles: [
      'POST /api/transbank/iniciar',
      'POST /api/transbank/detalle', 
      'POST /api/transbank/confirmar',
      'GET /api/transbank/estado/:id',
      'GET /api/transbank/listar',
      'GET /api/transbank/logs',
      'GET /api/transbank/health',
      'GET /api/transbank/stats',
      'GET /api/transbank/'
    ]
  });
});

module.exports = router;