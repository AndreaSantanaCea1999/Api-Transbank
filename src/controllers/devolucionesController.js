const { TransbankDevoluciones } = require('../models');

/**
 * Solicitar una devolución
 */
const solicitarDevolucion = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      idTransaccion,
      tipoDevolucion,
      montoDevolucion,
      motivo
    } = req.body;

    // Validar transacción existe y está autorizada
    const transaccion = await TransbankTransacciones.findOne({
      where: { 
        ID_Transaccion: idTransaccion,
        ID_Estado: await TransbankEstadosTransaccion.findOne({
          where: { Codigo_Estado: 'AUTH' }
        }).then(e => e.ID_Estado)
      },
      transaction
    });

    if (!transaccion) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada o no autorizada',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    // Validar monto de devolución
    if (montoDevolucion > transaccion.Monto) {
      return res.status(400).json({
        success: false,
        message: 'El monto de devolución no puede ser mayor al monto de la transacción',
        code: 'INVALID_REFUND_AMOUNT'
      });
    }

    // Procesar devolución con Transbank
    const resultadoDevolucion = await transbankService.procesarDevolucion({
      token: transaccion.Token_Transbank,
      amount: Math.round(montoDevolucion * 100)
    });

    // Crear registro de devolución
    const devolucion = await TransbankDevoluciones.create({
      ID_Transaccion: idTransaccion,
      Tipo_Devolucion: tipoDevolucion,
      Monto_Devolucion: montoDevolucion,
      Motivo: motivo,
      Token_Devolucion: resultadoDevolucion.token,
      Codigo_Autorizacion_Devolucion: resultadoDevolucion.authorization_code,
      Estado_Devolucion: resultadoDevolucion.response_code === 0 ? 'Procesada' : 'Rechazada',
      Fecha_Procesamiento: resultadoDevolucion.response_code === 0 ? new Date() : null,
      JSON_Respuesta: JSON.stringify(resultadoDevolucion),
      ID_Usuario_Solicita: req.user?.id || null
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Devolución procesada exitosamente',
      data: {
        devolucionId: devolucion.ID_Devolucion,
        estado: devolucion.Estado_Devolucion,
        codigoAutorizacion: devolucion.Codigo_Autorizacion_Devolucion
      }
    });

  } catch (error) {
    await transaction.rollback();
    
    logger.error('Error al procesar devolución:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  solicitarDevolucion
};