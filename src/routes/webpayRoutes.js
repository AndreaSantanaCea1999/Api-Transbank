const express = require('express');
const router = express.Router();
const webpayController = require('../controllers/webpayController');

// Rutas para WebPay
router.post('/iniciar', webpayController.iniciarTransaccion);
router.post('/confirmar', webpayController.confirmarTransaccion);
router.get('/confirmar', webpayController.confirmarTransaccion); // WebPay puede usar GET o POST
router.get('/resultado', webpayController.resultadoTransaccion);
router.get('/estado/:token', webpayController.obtenerEstadoTransaccion);
router.post('/anular/:token', webpayController.anularTransaccion);

module.exports = router;