// controllers/transbankController.js
const service = require('../services/transbankService');
const { Transaccion, Logs, EstadoTransaccion } = require('../models');

// Inicia una nueva transacción
async function iniciarTransaccion(req, res) {
  const start = Date.now();
  try {
    const transaccion = await service.crearTransaccion(req.body);

    await Logs.create({
      ID_Transaccion:   transaccion.id,
      Accion:           'INICIAR_TRANSACCION',
      Descripcion:      'Transacción creada',
      Datos_Entrada:    JSON.stringify(req.body),
      Datos_Salida:     JSON.stringify(transaccion),
      Codigo_Respuesta: '201',
      Mensaje_Error:    null,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });

    return res.status(201).json({ success: true, transaccion });
  } catch (error) {
    await Logs.create({
      ID_Transaccion:   null,
      Accion:           'INICIAR_TRANSACCION',
      Descripcion:      'Error al crear transacción',
      Datos_Entrada:    JSON.stringify(req.body),
      Datos_Salida:     null,
      Codigo_Respuesta: '500',
      Mensaje_Error:    error.message,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });
    return res.status(500).json({ success: false, message: 'Error al iniciar transacción' });
  }
}

// Confirma la transacción y orquesta Banco + Inventario
async function confirmar(req, res) {
  const start = Date.now();
  try {
    const { id_transaccion } = req.body;
    const resultado = await service.confirmarTransaccion(id_transaccion);

    await Logs.create({
      ID_Transaccion:   id_transaccion,
      Accion:           'CONFIRMAR_TRANSACCION',
      Descripcion:      'Transacción confirmada, pago y pedido registrados',
      Datos_Entrada:    JSON.stringify({ id_transaccion }),
      Datos_Salida:     JSON.stringify(resultado),
      Codigo_Respuesta: '200',
      Mensaje_Error:    null,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });

    return res.status(200).json({
      success: true,
      message: 'Transacción confirmada, pago y pedido registrados.',
      data: resultado
    });
  } catch (err) {
    await Logs.create({
      ID_Transaccion:   req.body.id_transaccion || null,
      Accion:           'CONFIRMAR_TRANSACCION',
      Descripcion:      'Error al confirmar transacción',
      Datos_Entrada:    JSON.stringify(req.body),
      Datos_Salida:     null,
      Codigo_Respuesta: '500',
      Mensaje_Error:    err.message,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Registra el detalle (items) de la transacción
async function detalle(req, res) {
  const start = Date.now();
  try {
    const { id_transaccion, detalles } = req.body;
    await service.registrarDetalle(id_transaccion, detalles);

    await Logs.create({
      ID_Transaccion:   id_transaccion,
      Accion:           'REGISTRAR_DETALLE',
      Descripcion:      'Detalle registrado',
      Datos_Entrada:    JSON.stringify({ id_transaccion, detalles }),
      Datos_Salida:     null,
      Codigo_Respuesta: '200',
      Mensaje_Error:    null,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });

    return res.json({ success: true, message: 'Detalle registrado' });
  } catch (err) {
    await Logs.create({
      ID_Transaccion:   req.body.id_transaccion || null,
      Accion:           'REGISTRAR_DETALLE',
      Descripcion:      'Error al guardar detalle',
      Datos_Entrada:    JSON.stringify(req.body),
      Datos_Salida:     null,
      Codigo_Respuesta: '500',
      Mensaje_Error:    err.message,
      IP_Origen:        req.ip,
      User_Agent:       req.headers['user-agent'],
      Duracion_MS:      Date.now() - start
    });
    return res.status(500).json({ success: false, message: 'Error al guardar detalle' });
  }
}

// Obtiene el estado completo de una transacción
async function obtenerEstado(req, res) {
  try {
    const { id } = req.params;
    const transaccion = await Transaccion.findByPk(id, {
      include: EstadoTransaccion
    });
    if (!transaccion) {
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
    }
    return res.json({ success: true, transaccion });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Lista todos los logs
async function obtenerLogs(req, res) {
  try {
    const logs = await Logs.findAll();
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Lista todas las transacciones con su estado
async function listarTransacciones(req, res) {
  try {
    const lista = await Transaccion.findAll({
      include: EstadoTransaccion
    });
    return res.json({ success: true, lista });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  iniciarTransaccion,
  confirmar,
  detalle,
  obtenerEstado,
  obtenerLogs,
  listarTransacciones
};
