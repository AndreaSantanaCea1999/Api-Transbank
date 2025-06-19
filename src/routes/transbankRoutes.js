// src/routes/transbankRoutes.js
const express = require('express');
const router = express.Router();
const transbankController = require('../controllers/transbankController');

// Health Check
router.get('/health', transbankController.healthCheck);

// Gestión de transacciones
router.get('/transacciones', transbankController.listarTransacciones);
router.post('/transacciones', transbankController.crearTransaccion);

// Iniciar proceso de pago
router.post('/webpay/iniciar', transbankController.iniciarPagoWebPay);

// Página de pago (formulario simulado)
router.get('/webpay/pagar', transbankController.paginaPagoWebPay);

// Retorno después del pago
router.get('/webpay/retorno', transbankController.retornoWebPay);

// Confirmar transacción (API endpoint)
router.post('/confirmar', transbankController.confirmar);

// Pedidos listos para despachar
router.get('/pedidos/por-despachar', transbankController.obtenerPedidosPorDespachar);

// Historial de compras por cliente
router.get('/historial/:clienteId', transbankController.obtenerHistorialCompras);

// Anular/reembolsar transacción
router.delete('/anular/:id', transbankController.anularTransaccion);

// Ruta de documentación (opcional)
router.get('/', (req, res) => {
  res.json({
    message: 'API Transbank FERREMAS - Sistema de Pagos',
    version: '1.0.0',
    status: 'Activo',
    endpoints: {
      health: 'GET /health - Verificar estado del sistema',
      transacciones: {
        listar: 'GET /transacciones - Lista todas las transacciones',
        crear: 'POST /transacciones - Crear transacción manual'
      },
      webpay: {
        iniciar: 'POST /webpay/iniciar - Iniciar proceso de pago',
        pagar: 'GET /webpay/pagar?token=xxx - Página de pago',
        retorno: 'GET /webpay/retorno?token=xxx&status=xxx - Retorno post-pago'
      },
      api: {
        confirmar: 'POST /confirmar - Confirmar transacción programáticamente'
      },
      consultas: {
        pedidos: 'GET /pedidos/por-despachar - Pedidos pendientes de envío',
        historial: 'GET /historial/:clienteId - Historial de un cliente'
      },
      admin: {
        anular: 'DELETE /anular/:id - Anular/reembolsar transacción'
      }
    },
    ejemplos: {
      iniciar_pago: {
        url: 'POST /webpay/iniciar',
        body: {
          clienteId: 1,
          productos: [
            { ID_Producto: 1, Cantidad: 2 },
            { ID_Producto: 2, Cantidad: 1 }
          ]
        }
      },
      confirmar_pago: {
        url: 'POST /confirmar',
        body: {
          token: 'TOKEN_WEBPAY',
          estado: 'EXITO'
        }
      }
    }
  });
});

module.exports = router;