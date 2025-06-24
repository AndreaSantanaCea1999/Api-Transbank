/**
 * Rutas Webpay para API Transbank FERREMAS
 * Archivo: src/routes/webpayRoutes.js
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Rutas para manejar endpoints de Webpay Plus
 */

const express = require('express');
const router = express.Router();
const WebpayController = require('../controllers/webpayController');

// Middleware para logging
const logRequest = (req, res, next) => {
  console.log(`🌐 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
};

// Aplicar middleware a todas las rutas
router.use(logRequest);

/**
 * @route   GET /api/webpay/health
 * @desc    Health check para Webpay
 * @access  Public
 */
router.get('/health', WebpayController.healthCheck);

/**
 * @route   GET /api/webpay/config
 * @desc    Obtener configuración actual de Webpay
 * @access  Public
 */
router.get('/config', WebpayController.getConfig);

/**
 * @route   POST /api/webpay/transactions
 * @desc    Crear nueva transacción Webpay
 * @access  Public
 * @body    { amount, buyOrder?, sessionId?, returnUrl? }
 */
router.post('/transactions', WebpayController.createTransaction);

/**
 * @route   PUT /api/webpay/transactions/:token
 * @desc    Confirmar transacción Webpay
 * @access  Public
 * @params  token - Token de la transacción
 */
router.put('/transactions/:token', WebpayController.confirmTransaction);

/**
 * @route   GET /api/webpay/transactions/:token
 * @desc    Consultar estado de transacción
 * @access  Public
 * @params  token - Token de la transacción
 */
router.get('/transactions/:token', WebpayController.getTransactionStatus);

/**
 * @route   POST /api/webpay/transactions/:token/refunds
 * @desc    Realizar reembolso de transacción
 * @access  Public
 * @params  token - Token de la transacción
 * @body    { amount }
 */
router.post('/transactions/:token/refunds', WebpayController.refundTransaction);

/**
 * @route   POST /api/webpay/return
 * @desc    Manejar retorno desde Webpay
 * @access  Public
 * @body    { token_ws }
 */
router.post('/return', WebpayController.handleReturn);

/**
 * @route   GET /api/webpay
 * @desc    Información general de la API Webpay
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Webpay FERREMAS',
    version: '2.0.0',
    documentation: {
      endpoints: {
        health: 'GET /api/webpay/health',
        config: 'GET /api/webpay/config',
        createTransaction: 'POST /api/webpay/transactions',
        confirmTransaction: 'PUT /api/webpay/transactions/:token',
        getStatus: 'GET /api/webpay/transactions/:token',
        refund: 'POST /api/webpay/transactions/:token/refunds',
        return: 'POST /api/webpay/return'
      },
      examples: {
        createTransaction: {
          method: 'POST',
          url: '/api/webpay/transactions',
          body: {
            amount: 15000,
            buyOrder: 'FERREMAS_20250623_1234',
            sessionId: 'SES_unique_session_id',
            returnUrl: 'https://tu-app.com/api/webpay/return'
          }
        },
        confirmTransaction: {
          method: 'PUT',
          url: '/api/webpay/transactions/01ab23cd45ef67890123456789abcdef'
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;