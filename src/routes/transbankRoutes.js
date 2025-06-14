const express = require('express');
const router = express.Router();
const transbankController = require('../controllers/transbankController');
const { validarTransaccion, validarToken } = require('../middlewares/validation');
const rateLimiter = require('../middlewares/rateLimiter');

// Aplicar rate limiting a todas las rutas
router.use(rateLimiter);

// Rutas principales de Transbank
router.post('/init', validarTransaccion, transbankController.iniciarTransaccion);
router.post('/commit', validarToken, transbankController.confirmarTransaccion);
router.get('/status/:token', transbankController.consultarEstado);
router.get('/transactions', transbankController.listarTransacciones);

module.exports = router;