/**
 * Rutas Webpay REAL para API Transbank FERREMAS
 * Conexión directa a API REST de Webpay Plus sin SDK
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Rutas para integración real con Transbank Webpay Plus
 */

const express = require('express');
const router = express.Router();
const RealWebpayController = require('../controllers/webpayController'); // Nuevo controlador real

// Middleware para logging y seguridad específico de Webpay
const webpayLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [Webpay] ${req.method} ${req.originalUrl} - ${timestamp}`);
  console.log(`🔍 [Webpay] IP: ${req.ip}, User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  
  // Log del body para requests POST/PUT (sin mostrar datos sensibles)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const logBody = { ...req.body };
    // Ocultar datos sensibles si los hay
    if (logBody.token_ws) logBody.token_ws = logBody.token_ws.substring(0, 10) + '...';
    console.log(`📄 [Webpay] Body:`, logBody);
  }
  
  next();
};

// Rate limiting específico para Webpay
const webpayRateLimit = (req, res, next) => {
  // Implementar rate limiting más estricto para endpoints de pago
  // Por ahora simplemente pasamos, pero aquí puedes agregar lógica específica
  next();
};

// Aplicar middlewares a todas las rutas de Webpay
router.use(webpayLogger);
router.use(webpayRateLimit);

// ============================================
// RUTAS PRINCIPALES WEBPAY PLUS
// ============================================

/**
 * @route   GET /api/webpay/health
 * @desc    Health check específico para Webpay con verificación a Transbank
 * @access  Public
 */
router.get('/health', RealWebpayController.healthCheck);

/**
 * @route   GET /api/webpay/config
 * @desc    Obtener configuración actual de Webpay (sin datos sensibles)
 * @access  Public
 */
router.get('/config', RealWebpayController.getConfig);

/**
 * @route   POST /api/webpay/create
 * @desc    Crear nueva transacción en Webpay Plus (llamada real a Transbank)
 * @access  Public
 * @body    { clienteId?, productos?, amount?, buyOrder?, sessionId?, returnUrl? }
 * @example 
 * {
 *   "clienteId": 1,
 *   "productos": [
 *     {"ID_Producto": 1, "Cantidad": 2},
 *     {"ID_Producto": 2, "Cantidad": 1}
 *   ],
 *   "returnUrl": "https://mi-sitio.com/webpay/return"
 * }
 */
router.post('/create', RealWebpayController.createTransaction);

/**
 * @route   PUT /api/webpay/confirm/:token
 * @desc    Confirmar transacción con Transbank usando token
 * @access  Public
 * @params  token - Token de la transacción retornado por Transbank
 */
router.put('/confirm/:token', RealWebpayController.confirmTransaction);

/**
 * @route   GET /api/webpay/status/:token
 * @desc    Consultar estado actual de transacción en Transbank
 * @access  Public
 * @params  token - Token de la transacción
 */
router.get('/status/:token', RealWebpayController.getTransactionStatus);

/**
 * @route   POST /api/webpay/refund/:token
 * @desc    Realizar reembolso/anulación de transacción
 * @access  Public
 * @params  token - Token de la transacción
 * @body    { amount }
 */
router.post('/refund/:token', RealWebpayController.refundTransaction);

/**
 * @route   POST /api/webpay/return
 * @desc    Manejar retorno automático desde Webpay (callback)
 * @access  Public
 * @body    { token_ws } - Token enviado por Transbank
 */
router.post('/return', RealWebpayController.handleReturn);

// ============================================
// RUTAS DE UTILIDAD Y TESTING
// ============================================

/**
 * @route   POST /api/webpay/test-create
 * @desc    Crear transacción de prueba con datos predefinidos
 * @access  Public (solo en ambiente de integración)
 */
router.post('/test-create', async (req, res) => {
  try {
    // Solo permitir en ambiente de integración
    if (process.env.WEBPAY_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Endpoint de testing no disponible en producción'
      });
    }

    const testData = {
      clienteId: 1,
      amount: 15000,
      buyOrder: `TEST_${Date.now()}`,
      sessionId: `TEST_SES_${Date.now()}`,
      returnUrl: `${req.protocol}://${req.get('host')}/api/webpay/return`
    };

    console.log('🧪 [test-create] Creando transacción de prueba:', testData);

    // Simular el req.body con datos de prueba
    req.body = testData;
    
    // Llamar al controlador real
    await RealWebpayController.createTransaction(req, res);

  } catch (error) {
    console.error('❌ Error en test-create:', error);
    res.status(500).json({
      success: false,
      error: 'Error en transacción de prueba',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/webpay/transactions/local
 * @desc    Listar transacciones locales pendientes o en proceso
 * @access  Public
 */
router.get('/transactions/local', async (req, res) => {
  try {
    const { Transaccion } = require('../models');
    const { Op } = require('sequelize');
    
    const transacciones = await Transaccion.findAll({
      where: {
        estadoTexto: {
          [Op.in]: ['PENDIENTE', 'PROCESANDO']
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      message: 'Transacciones locales obtenidas',
      data: transacciones.map(tx => ({
        id: tx.id,
        orden_compra: tx.ordenCompra,
        cliente_id: tx.clienteId,
        monto: tx.monto,
        estado: tx.estadoTexto,
        token: tx.token ? tx.token.substring(0, 10) + '...' : null,
        fecha_creacion: tx.createdAt,
        productos_count: tx.detalles ? tx.detalles.length : 0
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo transacciones locales:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo transacciones locales',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/webpay/force-confirm/:localId
 * @desc    Forzar confirmación de transacción local (para testing/admin)
 * @access  Public
 * @params  localId - ID de transacción en BD local
 */
router.post('/force-confirm/:localId', async (req, res) => {
  try {
    // Solo permitir en ambiente de integración
    if (process.env.WEBPAY_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Endpoint de force-confirm no disponible en producción'
      });
    }

    const { localId } = req.params;
    const { Transaccion } = require('../models');
    
    const transaccion = await Transaccion.findByPk(localId);
    
    if (!transaccion) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    if (!transaccion.token) {
      return res.status(400).json({
        success: false,
        error: 'Transacción no tiene token de Webpay'
      });
    }

    console.log('🔧 [force-confirm] Forzando confirmación:', {
      localId,
      token: transaccion.token.substring(0, 10) + '...'
    });

    // Simular parámetros y llamar al controlador
    req.params.token = transaccion.token;
    await RealWebpayController.confirmTransaction(req, res);

  } catch (error) {
    console.error('❌ Error en force-confirm:', error);
    res.status(500).json({
      success: false,
      error: 'Error forzando confirmación',
      message: error.message
    });
  }
});

// ============================================
// RUTA DE INFORMACIÓN GENERAL
// ============================================

/**
 * @route   GET /api/webpay
 * @desc    Información general de la API Webpay Real
 * @access  Public
 */
router.get('/', (req, res) => {
  const environment = process.env.WEBPAY_ENV || 'integration';
  
  res.json({
    success: true,
    message: 'API Webpay Plus REAL - FERREMAS',
    version: '2.0.0',
    integration: {
      type: 'REAL_API_REST',
      sdk_used: false,
      direct_api_calls: true,
      environment: environment,
      status: 'ACTIVE'
    },
    documentation: {
      endpoints: {
        health: 'GET /api/webpay/health',
        config: 'GET /api/webpay/config',
        createTransaction: 'POST /api/webpay/create',
        confirmTransaction: 'PUT /api/webpay/confirm/:token',
        getStatus: 'GET /api/webpay/status/:token',
        refund: 'POST /api/webpay/refund/:token',
        return: 'POST /api/webpay/return',
        testCreate: 'POST /api/webpay/test-create (solo integración)',
        localTransactions: 'GET /api/webpay/transactions/local',
        forceConfirm: 'POST /api/webpay/force-confirm/:localId (solo integración)'
      },
      flow: {
        '1': 'POST /api/webpay/create - Crear transacción',
        '2': 'Redirigir usuario a URL de Transbank con token',
        '3': 'Usuario completa pago en Transbank',
        '4': 'Transbank redirige a return_url con token_ws',
        '5': 'POST /api/webpay/return - Procesar retorno',
        '6': 'PUT /api/webpay/confirm/:token - Confirmar transacción'
      },
      examples: {
        createTransaction: {
          method: 'POST',
          url: '/api/webpay/create',
          body: {
            clienteId: 1,
            productos: [
              { ID_Producto: 1, Cantidad: 2 },
              { ID_Producto: 2, Cantidad: 1 }
            ],
            returnUrl: 'https://mi-sitio.com/webpay/return'
          },
          response: {
            success: true,
            data: {
              token: 'e9d555262db0f989e49d724b4db0bd681def....',
              url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
              transaccion_id: 123,
              amount: 50000
            },
            instructions: {
              next_step: 'Redirigir usuario a result.data.url con form POST',
              form_data: { token_ws: 'e9d555262db0f989e49d724b4db0bd681def....' }
            }
          }
        },
        confirmTransaction: {
          method: 'PUT',
          url: '/api/webpay/confirm/e9d555262db0f989e49d724b4db0bd681def....',
          response: {
            success: true,
            data: {
              vci: 'TSY',
              amount: 50000,
              status: 'AUTHORIZED',
              buy_order: 'FER_12345678_901',
              session_id: 'SES_abcdef1234567890',
              card_detail: { card_number: '6623' },
              accounting_date: '0622',
              transaction_date: '2025-06-23T10:30:00.000Z',
              authorization_code: '1213',
              payment_type_code: 'VN',
              response_code: 0,
              installments_number: 0,
              estado_procesado: 'APROBADO',
              transaccion_exitosa: true
            }
          }
        }
      }
    },
    warnings: {
      environment: environment === 'production' ? 
        'ENTORNO DE PRODUCCIÓN - Usar con credenciales reales' : 
        'Entorno de integración - Para testing únicamente',
      testing_endpoints: environment === 'production' ? 
        'Endpoints de testing deshabilitados en producción' :
        'Endpoints de testing disponibles'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================

// Middleware específico para errores de Webpay
router.use((error, req, res, next) => {
  console.error('❌ [Webpay Router Error]:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body
  });

  // Error específico de Transbank
  if (error.response && error.response.data) {
    return res.status(error.response.status || 500).json({
      success: false,
      error: 'Error de Transbank',
      details: error.response.data,
      environment: process.env.WEBPAY_ENV || 'integration'
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor Webpay',
    message: error.message,
    environment: process.env.WEBPAY_ENV || 'integration'
  });
});

module.exports = router;