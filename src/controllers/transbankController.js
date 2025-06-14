const { 
  TransbankTransacciones, 
  TransbankDetalleTransacciones,
  TransbankEstadosTransaccion,
  TransbankComercios,
  TransbankLogs,
  sequelize 
} = require('../models');
const transbankService = require('../services/transbankService');
const inventarioService = require('../services/inventarioService');
const bancoService = require('../services/bancoService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Iniciar una nueva transacción WebPay
 */
const iniciarTransaccion = async (req, res) => {
  const startTime = Date.now();
  const transaction = await sequelize.transaction();
  
  try {
    const {
      idPedido,
      monto,
      productos,
      returnUrl,
      finalUrl,
      sessionId,
      numeroCuotas = 1
    } = req.body;

    // Validar datos de entrada
    if (!monto || monto <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor a 0',
        code: 'INVALID_AMOUNT'
      });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos un producto',
        code: 'PRODUCTS_REQUIRED'
      });
    }

    // Verificar stock de productos
    for (const producto of productos) {
      const stockDisponible = await inventarioService.verificarStock(
        producto.idProducto,
        producto.cantidad,
        producto.idSucursal
      );
      
      if (!stockDisponible.disponible) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para el producto ${producto.idProducto}`,
          code: 'INSUFFICIENT_STOCK',
          stockDisponible: stockDisponible.stock
        });
      }
    }

    // Obtener comercio activo
    const comercio = await TransbankComercios.findOne({
      where: { Estado: 'Activo' }
    });

    if (!comercio) {
      throw new Error('No hay comercios activos configurados');
    }

    // Obtener estado inicial
    const estadoInicial = await TransbankEstadosTransaccion.findOne({
      where: { Codigo_Estado: 'INIT' }
    });

    // Generar orden de compra única
    const ordenCompra = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Iniciar transacción con Transbank
    const resultadoTransbank = await transbankService.crearTransaccion({
      buyOrder: ordenCompra,
      sessionId: sessionId || `SES-${Date.now()}`,
      amount: Math.round(monto * 100), // Transbank espera centavos
      returnUrl: returnUrl || process.env.WEBPAY_RETURN_URL
    });

    // Crear registro de transacción
    const nuevaTransaccion = await TransbankTransacciones.create({
      Token_Transbank: resultadoTransbank.token,
      ID_Comercio: comercio.ID_Comercio,
      ID_Pedido: idPedido || null,
      Orden_Compra: ordenCompra,
      Session_ID: sessionId,
      Monto: monto,
      ID_Estado: estadoInicial.ID_Estado,
      URL_Retorno: returnUrl,
      URL_Final: finalUrl,
      Numero_Cuotas: numeroCuotas,
      JSON_Respuesta_Init: JSON.stringify(resultadoTransbank),
      IP_Cliente: req.ip,
      User_Agent: req.get('User-Agent'),
      Fecha_Vencimiento: new Date(Date.now() + (30 * 60 * 1000)) // 30 minutos
    }, { transaction });

    // Crear detalles de la transacción
    const detallesPromises = productos.map(producto => 
      TransbankDetalleTransacciones.create({
        ID_Transaccion: nuevaTransaccion.ID_Transaccion,
        ID_Producto: producto.idProducto,
        Cantidad: producto.cantidad,
        Precio_Unitario: producto.precioUnitario,
        Subtotal: producto.cantidad * producto.precioUnitario,
        Descripcion: producto.descripcion
      }, { transaction })
    );

    await Promise.all(detallesPromises);

    // Registrar log
    await TransbankLogs.create({
      ID_Transaccion: nuevaTransaccion.ID_Transaccion,
      Accion: 'INIT_TRANSACTION',
      Descripcion: 'Transacción iniciada exitosamente',
      Datos_Entrada: JSON.stringify(req.body),
      Datos_Salida: JSON.stringify(resultadoTransbank),
      Codigo_Respuesta: '200',
      IP_Origen: req.ip,
      User_Agent: req.get('User-Agent'),
      Duracion_MS: Date.now() - startTime
    }, { transaction });

    await transaction.commit();

    logger.info(`Transacción iniciada: ${resultadoTransbank.token}`, {
      transaccionId: nuevaTransaccion.ID_Transaccion,
      ordenCompra,
      monto
    });

    res.status(201).json({
      success: true,
      message: 'Transacción iniciada exitosamente',
      data: {
        token: resultadoTransbank.token,
        url: resultadoTransbank.url,
        transaccionId: nuevaTransaccion.ID_Transaccion,
        ordenCompra,
        monto,
        fechaVencimiento: nuevaTransaccion.Fecha_Vencimiento
      }
    });

  } catch (error) {
    await transaction.rollback();
    
    logger.error('Error al iniciar transacción:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    // Registrar log de error
    try {
      await TransbankLogs.create({
        Accion: 'INIT_TRANSACTION_ERROR',
        Descripcion: 'Error al iniciar transacción',
        Datos_Entrada: JSON.stringify(req.body),
        Mensaje_Error: error.message,
        IP_Origen: req.ip,
        User_Agent: req.get('User-Agent'),
        Duracion_MS: Date.now() - startTime
      });
    } catch (logError) {
      logger.error('Error al registrar log:', logError.message);
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Confirmar una transacción WebPay
 */
const confirmarTransaccion = async (req, res) => {
  const startTime = Date.now();
  const transaction = await sequelize.transaction();
  
  try {
    const { token_ws } = req.body;

    if (!token_ws) {
      return res.status(400).json({
        success: false,
        message: 'Token de transacción requerido',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Buscar transacción
    const transaccion = await TransbankTransacciones.findOne({
      where: { Token_Transbank: token_ws },
      include: [
        { model: TransbankEstadosTransaccion, as: 'estado' },
        { model: TransbankDetalleTransacciones, as: 'detalles' }
      ],
      transaction
    });

    if (!transaccion) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    // Verificar si ya fue confirmada
    if (transaccion.estado.Codigo_Estado === 'AUTH') {
      return res.status(200).json({
        success: true,
        message: 'Transacción ya confirmada',
        data: {
          transaccionId: transaccion.ID_Transaccion,
          codigoAutorizacion: transaccion.Codigo_Autorizacion,
          estado: 'AUTH'
        }
      });
    }

    // Confirmar con Transbank
    const resultadoConfirmacion = await transbankService.confirmarTransaccion(token_ws);

    // Determinar nuevo estado
    const nuevoEstado = await TransbankEstadosTransaccion.findOne({
      where: { 
        Codigo_Estado: resultadoConfirmacion.response_code === 0 ? 'AUTH' : 'FAIL' 
      }
    });

    // Actualizar transacción
    await transaccion.update({
      ID_Estado: nuevoEstado.ID_Estado,
      Fecha_Autorizacion: new Date(),
      Codigo_Autorizacion: resultadoConfirmacion.authorization_code,
      Tipo_Tarjeta: resultadoConfirmacion.card_detail?.card_type,
      Ultimos_4_Digitos: resultadoConfirmacion.card_detail?.card_number?.slice(-4),
      JSON_Respuesta_Commit: JSON.stringify(resultadoConfirmacion)
    }, { transaction });

    // Si la transacción fue exitosa, procesar el pedido
    if (resultadoConfirmacion.response_code === 0) {
      // Actualizar inventario
      for (const detalle of transaccion.detalles) {
        await inventarioService.descontarStock(
          detalle.ID_Producto,
          detalle.Cantidad,
          1 // ID_Sucursal por defecto
        );
      }

      // Registrar pago en la API de banco
      if (transaccion.ID_Pedido) {
        await bancoService.registrarPago({
          idPedido: transaccion.ID_Pedido,
          monto: transaccion.Monto,
          metodoPago: 'Crédito',
          procesadorPago: 'Transbank WebPay',
          numeroTransaccion: transaccion.Token_Transbank,
          codigoAutorizacion: resultadoConfirmacion.authorization_code
        });
      }
    }

    // Registrar log
    await TransbankLogs.create({
      ID_Transaccion: transaccion.ID_Transaccion,
      Accion: 'COMMIT_TRANSACTION',
      Descripcion: `Transacción ${resultadoConfirmacion.response_code === 0 ? 'confirmada' : 'fallida'}`,
      Datos_Entrada: JSON.stringify({ token_ws }),
      Datos_Salida: JSON.stringify(resultadoConfirmacion),
      Codigo_Respuesta: resultadoConfirmacion.response_code.toString(),
      IP_Origen: req.ip,
      User_Agent: req.get('User-Agent'),
      Duracion_MS: Date.now() - startTime
    }, { transaction });

    await transaction.commit();

    logger.info(`Transacción confirmada: ${token_ws}`, {
      transaccionId: transaccion.ID_Transaccion,
      codigoRespuesta: resultadoConfirmacion.response_code,
      codigoAutorizacion: resultadoConfirmacion.authorization_code
    });

    res.status(200).json({
      success: true,
      message: resultadoConfirmacion.response_code === 0 
        ? 'Transacción confirmada exitosamente' 
        : 'Transacción rechazada',
      data: {
        transaccionId: transaccion.ID_Transaccion,
        codigoRespuesta: resultadoConfirmacion.response_code,
        codigoAutorizacion: resultadoConfirmacion.authorization_code,
        estado: nuevoEstado.Codigo_Estado,
        tipoTarjeta: resultadoConfirmacion.card_detail?.card_type,
        ultimosDigitos: resultadoConfirmacion.card_detail?.card_number?.slice(-4),
        monto: transaccion.Monto
      }
    });

  } catch (error) {
    await transaction.rollback();
    
    logger.error('Error al confirmar transacción:', {
      error: error.message,
      stack: error.stack,
      token: req.body.token_ws
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Consultar estado de una transacción
 */
const consultarEstado = async (req, res) => {
  try {
    const { token } = req.params;

    const transaccion = await TransbankTransacciones.findOne({
      where: { Token_Transbank: token },
      include: [
        { model: TransbankEstadosTransaccion, as: 'estado' },
        { model: TransbankDetalleTransacciones, as: 'detalles' },
        { model: TransbankComercios, as: 'comercio' }
      ]
    });

    if (!transaccion) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transaccionId: transaccion.ID_Transaccion,
        token: transaccion.Token_Transbank,
        ordenCompra: transaccion.Orden_Compra,
        monto: transaccion.Monto,
        estado: {
          codigo: transaccion.estado.Codigo_Estado,
          nombre: transaccion.estado.Nombre_Estado,
          descripcion: transaccion.estado.Descripcion,
          esFinal: transaccion.estado.Es_Final,
          esExitoso: transaccion.estado.Es_Exitoso
        },
        fechaCreacion: transaccion.Fecha_Creacion,
        fechaAutorizacion: transaccion.Fecha_Autorizacion,
        codigoAutorizacion: transaccion.Codigo_Autorizacion,
        tipoTarjeta: transaccion.Tipo_Tarjeta,
        ultimosDigitos: transaccion.Ultimos_4_Digitos,
        numeroCuotas: transaccion.Numero_Cuotas,
        detalles: transaccion.detalles.map(detalle => ({
          producto: detalle.ID_Producto,
          cantidad: detalle.Cantidad,
          precioUnitario: detalle.Precio_Unitario,
          subtotal: detalle.Subtotal
        }))
      }
    });

  } catch (error) {
    logger.error('Error al consultar estado:', {
      error: error.message,
      token: req.params.token
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Listar transacciones con filtros
 */
const listarTransacciones = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estado,
      fechaDesde,
      fechaHasta,
      monto,
      ordenCompra
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    // Aplicar filtros
    if (estado) {
      const estadoObj = await TransbankEstadosTransaccion.findOne({
        where: { Codigo_Estado: estado }
      });
      if (estadoObj) {
        whereConditions.ID_Estado = estadoObj.ID_Estado;
      }
    }

    if (fechaDesde || fechaHasta) {
      whereConditions.Fecha_Creacion = {};
      if (fechaDesde) {
        whereConditions.Fecha_Creacion[Op.gte] = new Date(fechaDesde);
      }
      if (fechaHasta) {
        whereConditions.Fecha_Creacion[Op.lte] = new Date(fechaHasta + ' 23:59:59');
      }
    }

    if (monto) {
      whereConditions.Monto = monto;
    }

    if (ordenCompra) {
      whereConditions.Orden_Compra = {
        [Op.like]: `%${ordenCompra}%`
      };
    }

    const { count, rows } = await TransbankTransacciones.findAndCountAll({
      where: whereConditions,
      include: [
        { model: TransbankEstadosTransaccion, as: 'estado' },
        { model: TransbankComercios, as: 'comercio' }
      ],
      order: [['Fecha_Creacion', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      data: {
        transacciones: rows.map(t => ({
          id: t.ID_Transaccion,
          token: t.Token_Transbank,
          ordenCompra: t.Orden_Compra,
          monto: t.Monto,
          estado: t.estado.Nombre_Estado,
          fechaCreacion: t.Fecha_Creacion,
          fechaAutorizacion: t.Fecha_Autorizacion,
          codigoAutorizacion: t.Codigo_Autorizacion
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error al listar transacciones:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  iniciarTransaccion,
  confirmarTransaccion,
  consultarEstado,
  listarTransacciones
};

// ===============================================