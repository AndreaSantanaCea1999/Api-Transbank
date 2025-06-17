// controllers/transbankController.js
const service = require('../services/transbankService');
const { Transaccion, Logs, EstadoTransaccion } = require('../models');

// Función auxiliar para manejar errores y logs
async function logearAccion(req, accion, descripcion, datosEntrada, datosSalida, codigoRespuesta, mensajeError = null, idTransaccion = null, duracion = 0) {
  try {
    await Logs.create({
      ID_Transaccion: idTransaccion,
      Accion: accion,
      Descripcion: descripcion,
      Datos_Entrada: JSON.stringify(datosEntrada),
      Datos_Salida: datosSalida ? JSON.stringify(datosSalida) : null,
      Codigo_Respuesta: codigoRespuesta,
      Mensaje_Error: mensajeError,
      IP_Origen: req.ip || req.connection.remoteAddress,
      User_Agent: req.headers['user-agent'] || 'Unknown',
      Duracion_MS: duracion
    });
  } catch (logError) {
    console.error('Error creando log:', logError.message);
  }
}

// Inicia una nueva transacción
async function iniciarTransaccion(req, res) {
  const start = Date.now();
  let transaccion = null;
  
  try {
    console.log('🚀 [iniciarTransaccion] Iniciando nueva transacción...');
    
    // Validar datos de entrada
    const { clienteId, ordenCompra, monto, divisa, detalles } = req.body;
    
    if (!clienteId || !ordenCompra || !monto || !divisa) {
      const error = 'Faltan campos requeridos: clienteId, ordenCompra, monto, divisa';
      await logearAccion(req, 'INICIAR_TRANSACCION', 'Validación fallida', req.body, null, '400', error, null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: error,
        required_fields: ['clienteId', 'ordenCompra', 'monto', 'divisa']
      });
    }

    if (monto <= 0) {
      const error = 'El monto debe ser mayor a 0';
      await logearAccion(req, 'INICIAR_TRANSACCION', 'Monto inválido', req.body, null, '400', error, null, Date.now() - start);
      return res.status(400).json({ success: false, message: error });
    }

    // Validar detalles si existen
    if (detalles && Array.isArray(detalles)) {
      for (let i = 0; i < detalles.length; i++) {
        const item = detalles[i];
        if (!item.ID_Producto || !item.Cantidad || item.Cantidad <= 0) {
          const error = `Detalle ${i + 1}: ID_Producto y Cantidad son requeridos y Cantidad debe ser > 0`;
          await logearAccion(req, 'INICIAR_TRANSACCION', 'Detalle inválido', req.body, null, '400', error, null, Date.now() - start);
          return res.status(400).json({ success: false, message: error });
        }
      }
    }

    transaccion = await service.crearTransaccion(req.body);

    await logearAccion(req, 'INICIAR_TRANSACCION', 'Transacción creada exitosamente', req.body, transaccion, '201', null, transaccion.id, Date.now() - start);

    return res.status(201).json({ 
      success: true, 
      message: 'Transacción creada exitosamente',
      transaccion: {
        id: transaccion.id,
        ordenCompra: transaccion.ordenCompra,
        monto: transaccion.monto,
        divisa: transaccion.divisa,
        estado: 'Pendiente',
        createdAt: transaccion.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error en iniciarTransaccion:', error.message);
    
    await logearAccion(req, 'INICIAR_TRANSACCION', 'Error al crear transacción', req.body, null, '500', error.message, transaccion?.id, Date.now() - start);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor al crear transacción',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
}

// Confirma la transacción y orquesta Banco + Inventario
async function confirmar(req, res) {
  const start = Date.now();
  
  try {
    console.log('🚀 [confirmar] Confirmando transacción...');
    
    const { id_transaccion } = req.body;
    
    if (!id_transaccion) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'ID de transacción faltante', req.body, null, '400', 'id_transaccion es requerido', null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: 'id_transaccion es requerido' 
      });
    }

    // Verificar que la transacción existe y está en estado válido
    const transaccion = await Transaccion.findByPk(id_transaccion, {
      include: [{ model: EstadoTransaccion, as: 'estado' }]
    });

    if (!transaccion) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción no encontrada', req.body, null, '404', 'Transacción no existe', id_transaccion, Date.now() - start);
      return res.status(404).json({ 
        success: false, 
        message: 'Transacción no encontrada' 
      });
    }

    if (transaccion.estado && transaccion.estado.nombre !== 'Pendiente') {
      const error = `Transacción ya está en estado: ${transaccion.estado.nombre}`;
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Estado inválido para confirmación', req.body, null, '400', error, id_transaccion, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: error
      });
    }

    const resultado = await service.confirmarTransaccion(id_transaccion);

    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción confirmada exitosamente', req.body, resultado, '200', null, id_transaccion, Date.now() - start);

    return res.status(200).json({
      success: true,
      message: 'Transacción confirmada exitosamente. Pago registrado y stock actualizado.',
      data: {
        transaccion: resultado.transaccion,
        pago_registrado: !!resultado.pago,
        pedido_creado: !!resultado.pedido,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('❌ Error en confirmar:', err.message);
    
    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Error al confirmar transacción', req.body, null, '500', err.message, req.body.id_transaccion, Date.now() - start);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al confirmar transacción',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// Registra el detalle (items) de la transacción
async function detalle(req, res) {
  const start = Date.now();
  
  try {
    console.log('🚀 [detalle] Registrando detalle de transacción...');
    
    const { id_transaccion, detalles } = req.body;
    
    if (!id_transaccion || !detalles || !Array.isArray(detalles)) {
      await logearAccion(req, 'REGISTRAR_DETALLE', 'Datos inválidos', req.body, null, '400', 'id_transaccion y detalles (array) son requeridos', null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: 'id_transaccion y detalles (array) son requeridos' 
      });
    }

    await service.registrarDetalle(id_transaccion, detalles);

    await logearAccion(req, 'REGISTRAR_DETALLE', 'Detalle registrado exitosamente', req.body, { detalles_count: detalles.length }, '200', null, id_transaccion, Date.now() - start);

    return res.json({ 
      success: true, 
      message: `Detalle registrado exitosamente. ${detalles.length} items procesados.`,
      items_procesados: detalles.length
    });
  } catch (err) {
    console.error('❌ Error en detalle:', err.message);
    
    await logearAccion(req, 'REGISTRAR_DETALLE', 'Error al registrar detalle', req.body, null, '500', err.message, req.body.id_transaccion, Date.now() - start);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al registrar detalle',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// Obtiene el estado completo de una transacción
async function obtenerEstado(req, res) {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de transacción inválido' 
      });
    }

    const transaccion = await Transaccion.findByPk(id, {
      include: [
        { 
          model: EstadoTransaccion, 
          as: 'estado',
          attributes: ['id', 'nombre', 'descripcion']
        }
      ],
      attributes: ['id', 'clienteId', 'ordenCompra', 'monto', 'divisa', 'detalles', 'createdAt', 'updatedAt']
    });
    
    if (!transaccion) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transacción no encontrada' 
      });
    }

    return res.json({ 
      success: true, 
      transaccion: {
        ...transaccion.toJSON(),
        total_items: transaccion.detalles ? transaccion.detalles.length : 0
      }
    });
  } catch (err) {
    console.error('❌ Error en obtenerEstado:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al obtener estado',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// Lista todos los logs con filtros opcionales
async function obtenerLogs(req, res) {
  try {
    const { accion, id_transaccion, fecha_inicio, fecha_fin, limit = 50, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (accion) whereClause.Accion = accion;
    if (id_transaccion) whereClause.ID_Transaccion = id_transaccion;
    if (fecha_inicio && fecha_fin) {
      whereClause.Fecha_Log = {
        [require('sequelize').Op.between]: [new Date(fecha_inicio), new Date(fecha_fin)]
      };
    }

    const logs = await Logs.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['Fecha_Log', 'DESC']],
      attributes: {
        exclude: ['Datos_Entrada', 'Datos_Salida'] // Excluir campos grandes por defecto
      }
    });

    return res.json({ 
      success: true, 
      logs: logs.rows,
      total: logs.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: logs.count > (parseInt(offset) + parseInt(limit))
    });
  } catch (err) {
    console.error('❌ Error en obtenerLogs:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al obtener logs',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// Lista todas las transacciones con su estado
async function listarTransacciones(req, res) {
  try {
    const { estado, cliente_id, fecha_inicio, fecha_fin, limit = 20, offset = 0 } = req.query;
    
    const whereClause = {};
    const includeClause = [{ 
      model: EstadoTransaccion, 
      as: 'estado',
      attributes: ['id', 'nombre', 'descripcion']
    }];
    
    if (estado) {
      includeClause[0].where = { nombre: estado };
    }
    if (cliente_id) whereClause.clienteId = cliente_id;
    if (fecha_inicio && fecha_fin) {
      whereClause.createdAt = {
        [require('sequelize').Op.between]: [new Date(fecha_inicio), new Date(fecha_fin)]
      };
    }

    const transacciones = await Transaccion.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'clienteId', 'ordenCompra', 'monto', 'divisa', 'createdAt', 'updatedAt']
    });

    return res.json({ 
      success: true, 
      transacciones: transacciones.rows,
      total: transacciones.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: transacciones.count > (parseInt(offset) + parseInt(limit))
    });
  } catch (err) {
    console.error('❌ Error en listarTransacciones:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al listar transacciones',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// NUEVO: Verificar salud de las conexiones con APIs externas
async function verificarSalud(req, res) {
  try {
    console.log('🏥 [verificarSalud] Verificando conexiones...');
    
    const conexiones = await service.verificarConexiones();
    const todasSaludables = conexiones.inventario && conexiones.banco;
    
    return res.status(todasSaludables ? 200 : 503).json({
      success: todasSaludables,
      message: todasSaludables ? 'Todas las conexiones están saludables' : 'Algunas conexiones fallan',
      servicios: {
        api_inventario: {
          status: conexiones.inventario ? 'UP' : 'DOWN',
          url: process.env.INVENTORY_API_URL
        },
        api_banco: {
          status: conexiones.banco ? 'UP' : 'DOWN',
          url: process.env.BANK_API_URL
        },
        base_datos: {
          status: 'UP', // Si llegamos aquí, la BD está OK
          host: process.env.DB_HOST
        }
      },
      timestamp: conexiones.timestamp
    });
  } catch (err) {
    console.error('❌ Error en verificarSalud:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error verificando salud del sistema',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

// NUEVO: Obtener estadísticas rápidas
async function obtenerEstadisticas(req, res) {
  try {
    const stats = await Promise.all([
      Transaccion.count(),
      Transaccion.count({ include: [{ model: EstadoTransaccion, as: 'estado', where: { nombre: 'Aprobado' } }] }),
      Transaccion.count({ include: [{ model: EstadoTransaccion, as: 'estado', where: { nombre: 'Pendiente' } }] }),
      Transaccion.count({ include: [{ model: EstadoTransaccion, as: 'estado', where: { nombre: 'Rechazado' } }] }),
      Logs.count(),
      Transaccion.sum('monto', { include: [{ model: EstadoTransaccion, as: 'estado', where: { nombre: 'Aprobado' } }] })
    ]);

    return res.json({
      success: true,
      estadisticas: {
        total_transacciones: stats[0] || 0,
        transacciones_aprobadas: stats[1] || 0,
        transacciones_pendientes: stats[2] || 0,
        transacciones_rechazadas: stats[3] || 0,
        total_logs: stats[4] || 0,
        monto_total_aprobado: parseFloat(stats[5] || 0),
        tasa_aprobacion: stats[0] > 0 ? ((stats[1] / stats[0]) * 100).toFixed(2) + '%' : '0%'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error en obtenerEstadisticas:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
  }
}

module.exports = {
  iniciarTransaccion,
  confirmar,
  detalle,
  obtenerEstado,
  obtenerLogs,
  listarTransacciones,
  verificarSalud,
  obtenerEstadisticas
};