// src/controllers/webpayController.js
const { WebpayPlus } = require('transbank-sdk');
const { sequelize, Pagos, WebPayTransacciones, Pedidos } = require('../models');

// Configuración de WebPay
const isProduction = process.env.NODE_ENV === 'production';
const commerceCode = process.env.WEBPAY_COMMERCE_CODE || '597055555532';
const apiKey = process.env.WEBPAY_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

// Configurar WebPay según el entorno
if (isProduction) {
  WebpayPlus.configureForProduction(commerceCode, apiKey);
} else {
  WebpayPlus.configureForTesting();
}

// Generar código único para orden de compra
const generarOrdenCompra = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `FER${timestamp}${random}`.substring(0, 26); // WebPay tiene límite de 26 caracteres
};

// Iniciar transacción WebPay
exports.iniciarTransaccion = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { 
      ID_Pedido, 
      returnUrl = `${req.protocol}://${req.get('host')}/api/webpay/confirmar`,
      finalUrl = `${req.protocol}://${req.get('host')}/api/webpay/resultado`
    } = req.body;

    if (!ID_Pedido) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'ID_Pedido es obligatorio'
      });
    }

    // Verificar que el pedido existe
    const pedido = await Pedidos.findByPk(ID_Pedido, { transaction: t });
    if (!pedido) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    // Verificar que el pedido no tenga ya un pago aprobado
    const pagoExistente = await Pagos.findOne({
      where: { 
        ID_Pedido,
        Estado: ['Aprobado', 'Procesando']
      },
      transaction: t
    });

    if (pagoExistente) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'El pedido ya tiene un pago en proceso o aprobado'
      });
    }

    const ordenCompra = generarOrdenCompra();
    const monto = Math.round(parseFloat(pedido.Total)); // WebPay requiere entero
    
    // Crear registro de pago
    const nuevoPago = await Pagos.create({
      ID_Pedido,
      Codigo_Pago: `PAY_${ordenCompra}`,
      Metodo_Pago: 'WebPay',
      Monto: pedido.Total,
      ID_Divisa: pedido.ID_Divisa || 1,
      Estado: 'Pendiente',
      Comentarios: 'Transacción WebPay iniciada'
    }, { transaction: t });

    // Crear transacción en WebPay
    const response = await WebpayPlus.Transaction.create(
      ordenCompra,
      pedido.ID_Pedido.toString(),
      monto,
      returnUrl
    );

    // Guardar transacción WebPay
    await WebPayTransacciones.create({
      ID_Pago: nuevoPago.ID_Pago,
      Token: response.token,
      Orden_Compra: ordenCompra,
      Monto_Transaccion: monto / 100, // Convertir de vuelta a decimal
      URL_Redireccion: response.url,
      Estado_Transaccion: 'INICIADA',
      Respuesta_Raw: JSON.stringify(response)
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({
      success: true,
      message: 'Transacción WebPay iniciada exitosamente',
      data: {
        token: response.token,
        url: response.url,
        ordenCompra,
        monto: monto / 100,
        ID_Pago: nuevoPago.ID_Pago
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Error al iniciar transacción WebPay:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al iniciar transacción WebPay',
      message: error.message
    });
  }
};

// Confirmar transacción WebPay (callback desde WebPay)
exports.confirmarTransaccion = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { token_ws } = req.body || req.query;

    if (!token_ws) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'Token de transacción requerido'
      });
    }

    // Buscar la transacción
    const transaccion = await WebPayTransacciones.findOne({
      where: { Token: token_ws },
      include: [{
        model: Pagos,
        as: 'pago',
        include: [{
          model: Pedidos,
          as: 'pedido'
        }]
      }],
      transaction: t
    });

    if (!transaccion) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    // Confirmar transacción con WebPay
    const response = await WebpayPlus.Transaction.commit(token_ws);

    const esAprobada = response.response_code === 0;
    const nuevoEstado = esAprobada ? 'AUTORIZADA' : 'RECHAZADA';
    const estadoPago = esAprobada ? 'Aprobado' : 'Rechazado';

    // Actualizar transacción WebPay
    await transaccion.update({
      Estado_Transaccion: nuevoEstado,
      Codigo_Respuesta: response.response_code?.toString(),
      Codigo_Autorizacion: response.authorization_code,
      Tipo_Tarjeta: response.card_detail?.card_type,
      Ultimos_4_Digitos: response.card_detail?.card_number,
      Fecha_Transaccion: response.transaction_date ? new Date(response.transaction_date) : new Date(),
      Fecha_Contable: response.accounting_date ? new Date(response.accounting_date) : new Date(),
      Cuotas: response.installments_number || 1,
      Respuesta_Raw: JSON.stringify(response)
    }, { transaction: t });

    // Actualizar pago
    await transaccion.pago.update({
      Estado: estadoPago,
      Fecha_Procesamiento: new Date(),
      Referencia_Externa: response.authorization_code,
      Comentarios: esAprobada ? 
        `Pago aprobado - Autorización: ${response.authorization_code}` :
        `Pago rechazado - Código: ${response.response_code}`
    }, { transaction: t });

    // Si el pago fue aprobado, actualizar el estado del pedido
    if (esAprobada && transaccion.pago.pedido) {
      await transaccion.pago.pedido.update({
        Estado: 'Aprobado'
      }, { transaction: t });
    }

    await t.commit();

    return res.status(200).json({
      success: true,
      message: esAprobada ? 'Pago procesado exitosamente' : 'Pago rechazado',
      data: {
        transaccion: nuevoEstado,
        pago: estadoPago,
        codigoAutorizacion: response.authorization_code,
        codigoRespuesta: response.response_code,
        tarjeta: response.card_detail?.card_type,
        ultimosDigitos: response.card_detail?.card_number,
        cuotas: response.installments_number || 1,
        monto: response.amount / 100
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Error al confirmar transacción:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al procesar confirmación de pago',
      message: error.message
    });
  }
};

// Obtener estado de transacción
exports.obtenerEstadoTransaccion = async (req, res) => {
  try {
    const { token } = req.params;

    const transaccion = await WebPayTransacciones.findOne({
      where: { Token: token },
      include: [{
        model: Pagos,
        as: 'pago',
        include: [{
          model: Pedidos,
          as: 'pedido',
          attributes: ['ID_Pedido', 'Codigo_Pedido', 'Estado', 'Total']
        }]
      }]
    });

    if (!transaccion) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token: transaccion.Token,
        ordenCompra: transaccion.Orden_Compra,
        estado: transaccion.Estado_Transaccion,
        monto: transaccion.Monto_Transaccion,
        codigoAutorizacion: transaccion.Codigo_Autorizacion,
        fechaTransaccion: transaccion.Fecha_Transaccion,
        pago: {
          ID_Pago: transaccion.pago.ID_Pago,
          estado: transaccion.pago.Estado,
          metodoPago: transaccion.pago.Metodo_Pago
        },
        pedido: transaccion.pago.pedido
      }
    });

  } catch (error) {
    console.error('Error al obtener estado de transacción:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener estado de transacción',
      message: error.message
    });
  }
};

// Anular transacción
exports.anularTransaccion = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { token } = req.params;
    const { monto } = req.body; // Monto a anular (opcional, si no se especifica se anula todo)

    const transaccion = await WebPayTransacciones.findOne({
      where: { Token: token },
      include: [{
        model: Pagos,
        as: 'pago'
      }],
      transaction: t
    });

    if (!transaccion) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    if (transaccion.Estado_Transaccion !== 'AUTORIZADA') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden anular transacciones autorizadas'
      });
    }

    const montoAnulacion = monto ? Math.round(parseFloat(monto) * 100) : 
                          Math.round(parseFloat(transaccion.Monto_Transaccion) * 100);

    // Anular en WebPay
    const response = await WebpayPlus.Transaction.refund(token, montoAnulacion);

    // Actualizar transacción
    await transaccion.update({
      Estado_Transaccion: 'ANULADA',
      Respuesta_Raw: JSON.stringify(response)
    }, { transaction: t });

    // Actualizar pago
    await transaccion.pago.update({
      Estado: 'Reembolsado',
      Comentarios: `Transacción anulada - Tipo: ${response.type}`
    }, { transaction: t });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: 'Transacción anulada exitosamente',
      data: {
        tipo: response.type,
        codigoAutorizacion: response.authorization_code,
        codigoRespuesta: response.response_code,
        balance: response.balance / 100
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Error al anular transacción:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al anular transacción',
      message: error.message
    });
  }
};

// Página de resultado final (GET)
exports.resultadoTransaccion = async (req, res) => {
  try {
    const { token_ws } = req.query;

    if (!token_ws) {
      return res.status(400).send(`
        <html>
          <head><title>Error - WebPay</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Error</h1>
            <p>Token de transacción no encontrado</p>
            <a href="/" style="color: blue;">Volver al inicio</a>
          </body>
        </html>
      `);
    }

    const transaccion = await WebPayTransacciones.findOne({
      where: { Token: token_ws },
      include: [{
        model: Pagos,
        as: 'pago',
        include: [{
          model: Pedidos,
          as: 'pedido'
        }]
      }]
    });

    if (!transaccion) {
      return res.status(404).send(`
        <html>
          <head><title>Error - WebPay</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Transacción no encontrada</h1>
            <a href="/" style="color: blue;">Volver al inicio</a>
          </body>
        </html>
      `);
    }

    const esExitosa = transaccion.Estado_Transaccion === 'AUTORIZADA';
    const color = esExitosa ? 'green' : 'red';
    const icono = esExitosa ? '✅' : '❌';
    const titulo = esExitosa ? 'Pago Exitoso' : 'Pago Rechazado';

    return res.send(`
      <html>
        <head>
          <title>${titulo} - FERREMAS</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: green; }
            .error { color: red; }
            .details { text-align: left; margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
            .button { display: inline-block; padding: 10px 20px; margin: 10px; text-decoration: none; border-radius: 5px; color: white; }
            .btn-primary { background-color: #007bff; }
            .btn-secondary { background-color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="${esExitosa ? 'success' : 'error'}">${icono} ${titulo}</h1>
            
            <div class="details">
              <p><strong>Pedido:</strong> ${transaccion.pago.pedido.Codigo_Pedido}</p>
              <p><strong>Orden de Compra:</strong> ${transaccion.Orden_Compra}</p>
              <p><strong>Monto:</strong> $${Number(transaccion.Monto_Transaccion).toLocaleString('es-CL')}</p>
              ${esExitosa ? `<p><strong>Autorización:</strong> ${transaccion.Codigo_Autorizacion}</p>` : ''}
              ${transaccion.Tipo_Tarjeta ? `<p><strong>Tarjeta:</strong> ${transaccion.Tipo_Tarjeta} **** ${transaccion.Ultimos_4_Digitos}</p>` : ''}
              <p><strong>Estado:</strong> ${transaccion.pago.Estado}</p>
              <p><strong>Fecha:</strong> ${new Date(transaccion.Fecha_Transaccion || Date.now()).toLocaleString('es-CL')}</p>
            </div>

            ${esExitosa ? 
              '<p style="color: green;">Su pago ha sido procesado exitosamente. Recibirá un email de confirmación.</p>' :
              '<p style="color: red;">Su pago no pudo ser procesado. Por favor, intente nuevamente.</p>'
            }
            
            <a href="/pedidos/${transaccion.pago.pedido.ID_Pedido}" class="button btn-primary">Ver Pedido</a>
            <a href="/" class="button btn-secondary">Volver al Inicio</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error en página de resultado:', error);
    return res.status(500).send(`
      <html>
        <head><title>Error - WebPay</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1 style="color: red;">❌ Error del Sistema</h1>
          <p>Ocurrió un error al procesar su solicitud</p>
          <a href="/" style="color: blue;">Volver al inicio</a>
        </body>
      </html>
    `);
  }
};