// src/routes/transbankRoutes.js
const express = require('express');
const router = express.Router();

// Importa tu controlador con todas las funciones
const controller = require('../controllers/transbankController');

// Iniciar una nueva transacción
router.post('/iniciar', controller.iniciarTransaccion);

// Registrar detalle de la transacción
router.post('/detalle', controller.detalle);

// Confirmar la transacción (orquesta Banco + Inventario)
router.post('/confirmar', controller.confirmar);

// Obtener el estado de una transacción por ID
router.get('/estado/:id', controller.obtenerEstado);

// Listar todos los logs de transacciones
router.get('/logs', controller.obtenerLogs);

// Listar todas las transacciones con su estado
router.get('/listar', controller.listarTransacciones);

module.exports = router;
