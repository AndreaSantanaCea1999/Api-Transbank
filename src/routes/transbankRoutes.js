// src/routes/transbankRoutes.js
const express = require('express');
const router = express.Router();

const transbankController = require('../controllers/transbankController');

router.get('/transacciones', transbankController.listarTransacciones);
router.post('/transacciones', transbankController.crearTransaccion);

// Rutas WebPay
router.post('/webpay/iniciar', transbankController.iniciarPagoWebPay);
router.get('/webpay/pagar', transbankController.paginaPagoWebPay);
router.get('/webpay/retorno', transbankController.retornoWebPay);

// Confirmar pago WebPay (API)
router.post('/confirmar', transbankController.confirmar);

// Pedidos
router.get('/pedidos/por-despachar', transbankController.obtenerPedidosPorDespachar);

// Historial compras por cliente
router.get('/historial/:clienteId', transbankController.obtenerHistorialCompras);

// Anular transacción
router.delete('/anular/:id', transbankController.anularTransaccion);

module.exports = router;
