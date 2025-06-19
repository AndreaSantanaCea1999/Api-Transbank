const service = require('../services/transbankService');
const { Transaccion, TransbankLog, EstadoTransaccion, DetalleTransaccion } = require('../models'); // agregué DetalleTransaccion
const { Op } = require('sequelize');

// Función auxiliar para manejar errores y logs
async function logearAccion(req, accion, descripcion, datosEntrada, datosSalida, codigoRespuesta, mensajeError = null, idTransaccion = null, duracion = 0) {
  try {
    await TransbankLog.create({
      ID_Transaccion: idTransaccion,
      Accion: accion,
      Descripcion: descripcion,
      Datos_Entrada: JSON.stringify(datosEntrada),
      Datos_Salida: datosSalida ? JSON.stringify(datosSalida) : null,
      Codigo_Respuesta: codigoRespuesta,
      Mensaje_Error: mensajeError,
      IP_Origen: req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress,
      User_Agent: req.headers['user-agent'] || 'Unknown',
      Duracion_MS: duracion
    });
  } catch (logError) {
    console.error('Error creando log:', logError.message);
  }
}

// Iniciar pago WebPay
async function iniciarPagoWebPay(req, res) {
  const start = Date.now();
  
  try {
    console.log('💳 [iniciarPagoWebPay] Iniciando pago con WebPay...');
    
    const { clienteId, productos, email, returnUrl } = req.body;
    
    if (!clienteId || !productos || productos.length === 0) {
      await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Datos inválidos', req.body, null, '400', 'clienteId y productos son requeridos', null, Date.now() - start);
      return res.status(400).json({ success: false, message: 'clienteId y productos son requeridos' });
    }

    // Crear transacción con WebPay en el servicio
    const resultado = await service.crearTransaccionWebPay({
      clienteId,
      productos,
      email,
      returnUrl: returnUrl || `http://localhost:3003/api/transbank/webpay/retorno`
    });

    await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Pago WebPay iniciado', req.body, resultado.webpay, '201', null, resultado.transaccion.id, Date.now() - start);

    return res.status(201).json({
      success: true,
      message: 'Transacción WebPay iniciada. Redirigir al usuario a la URL de pago.',
      transaccion: {
        id: resultado.transaccion.id,
        ordenCompra: resultado.transaccion.ordenCompra,
        monto: resultado.transaccion.monto,
        estado: 'Pendiente'
      },
      webpay: {
        url: resultado.webpay.url,
        token: resultado.webpay.token
      }
    });
  } catch (error) {
    console.error('❌ Error en iniciarPagoWebPay:', error.message);
    await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Error al iniciar pago', req.body, null, '500', error.message, null, Date.now() - start);
    return res.status(500).json({ success: false, message: 'Error al iniciar pago con WebPay', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

// Página de pago WebPay simulada
async function paginaPagoWebPay(req, res) {
  try {
    const { token } = req.query;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>WebPay - Pago Seguro</title>
      <style>
        body { font-family: Arial; background: #f5f5f5; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 100%; box-shadow: 0 2px 10px rgba(0,0,0,0.1);}
        h1 { color: #d32f2f; margin-bottom: 20px; text-align: center;}
        .info { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin-bottom: 20px; font-size: 14px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; color: #666; }
        input { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
        .buttons { display: flex; gap: 10px; }
        button { flex: 1; padding: 12px; font-size: 16px; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.3s;}
        .btn-pagar { background-color: #4caf50; color: white; }
        .btn-pagar:hover { background-color: #45a049; }
        .btn-cancelar { background-color: #f44336; color: white; }
        .btn-cancelar:hover { background-color: #da190b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>WebPay Plus</h1>
        <div class="info"><strong>Modo de prueba:</strong> Use cualquier número de tarjeta para simular el pago.</div>
        <form id="paymentForm">
          <label for="cardNumber">Número de Tarjeta</label>
          <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required>
          <label for="cardHolder">Nombre del Titular</label>
          <input type="text" id="cardHolder" placeholder="JUAN PEREZ" required>
          <label for="expiry">Fecha de Vencimiento</label>
          <input type="text" id="expiry" placeholder="MM/AA" maxlength="5" required>
          <label for="cvv">CVV</label>
          <input type="text" id="cvv" placeholder="123" maxlength="3" required>
          <div class="buttons">
            <button type="submit" class="btn-pagar">Pagar</button>
            <button type="button" class="btn-cancelar" onclick="cancelar()">Cancelar</button>
          </div>
        </form>
      </div>
      <script>
        document.getElementById('paymentForm').addEventListener('submit', function(e) {
          e.preventDefault();
          document.querySelector('.btn-pagar').textContent = 'Procesando...';
          document.querySelector('.btn-pagar').disabled = true;
          setTimeout(() => {
            window.location.href = '/api/transbank/webpay/retorno?token=${token}&status=success';
          }, 2000);
        });
        function cancelar() {
          window.location.href = '/api/transbank/webpay/retorno?token=${token}&status=cancelled';
        }
        document.getElementById('cardNumber').addEventListener('input', function(e) {
          let value = e.target.value.replace(/\\s/g, '');
          let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
          e.target.value = formattedValue;
        });
        document.getElementById('expiry').addEventListener('input', function(e) {
          let value = e.target.value.replace(/\\D/g, '');
          if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4);
          }
          e.target.value = value;
        });
      </script>
    </body>
    </html>
    `;
    res.send(html);
  } catch (error) {
    console.error('❌ Error en paginaPagoWebPay:', error);
    res.status(500).send('Error al cargar página de pago');
  }
}

// Retorno WebPay (exitoso o cancelado)
async function retornoWebPay(req, res) {
  const start = Date.now();
  
  try {
    console.log('🔄 [retornoWebPay] Procesando retorno de WebPay...');
    
    const { token, status } = req.query;
    
    if (!token) return res.status(400).send('Token no válido');

    // Obtener transacción reciente para el token (simulado)
    const transaccion = await Transaccion.findOne({ order: [['createdAt', 'DESC']] });
    if (!transaccion) return res.status(404).send('Transacción no encontrada');

    if (status === 'success') {
      const resultado = await service.confirmarTransaccion(transaccion.id, {
        token,
        response: {
          status: 'AUTHORIZED',
          amount: transaccion.monto
        }
      });
      await logearAccion(req, 'RETORNO_WEBPAY_EXITOSO', 'Pago completado exitosamente', { token, status }, resultado, '200', null, transaccion.id, Date.now() - start);

      const html = `
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pago Exitoso - FERREMAS</title><style>
      body{font-family: Arial;background:#f5f5f5;margin:0;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;}
      .container{background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);padding:40px;text-align:center;max-width:500px;}
      .icon{font-size:72px;color:#4caf50;margin-bottom:20px;}
      h1{color:#333;margin-bottom:10px;}
      .info-box{background:#f5f5f5;padding:20px;border-radius:4px;margin:20px 0;}
      .btn{display:inline-block;padding:12px 30px;background:#2196f3;color:#fff;text-decoration:none;border-radius:4px;margin-top:20px;}
      </style></head><body><div class="container">
      <div class="icon">✓</div><h1>¡Pago Exitoso!</h1><p>Tu compra ha sido procesada correctamente.</p>
      <div class="info-box">
        <h3>Detalles de la Orden</h3>
        <p><strong>N° Orden:</strong> ${transaccion.ordenCompra}</p>
        <p><strong>Monto:</strong> $${Number(transaccion.monto).toLocaleString('es-CL')} CLP</p>
        <p><strong>Estado:</strong> Por despachar</p>
      </div>
      <p>Recibirás un correo con los detalles de tu pedido.</p>
      <p>Tu pedido será despachado en las próximas 48-72 horas.</p>
      <a href="/" class="btn">Volver a la Tienda</a>
      </div></body></html>`;

      return res.send(html);
    } else {
      await logearAccion(req, 'RETORNO_WEBPAY_CANCELADO', 'Pago cancelado por el usuario', { token, status }, null, '200', null, transaccion.id, Date.now() - start);

      const html = `
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pago Cancelado - FERREMAS</title><style>
      body{font-family: Arial;background:#f5f5f5;margin:0;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;}
      .container{background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);padding:40px;text-align:center;max-width:500px;}
      .icon{font-size:72px;color:#f44336;margin-bottom:20px;}
      h1{color:#333;margin-bottom:10px;}
      .btn{display:inline-block;padding:12px 30px;background:#2196f3;color:#fff;text-decoration:none;border-radius:4px;margin-top:20px;}
      </style></head><body><div class="container">
      <div class="icon">✕</div><h1>Pago Cancelado</h1><p>El proceso de pago ha sido cancelado.</p>
      <p>Tu carrito de compras ha sido guardado y puedes intentar nuevamente cuando lo desees.</p>
      <a href="/" class="btn">Volver a la Tienda</a>
      </div></body></html>`;

      return res.send(html);
    }
  } catch (error) {
    console.error('❌ Error en retornoWebPay:', error.message);
    await logearAccion(req, 'ERROR_RETORNO_WEBPAY', 'Error procesando retorno', req.query, null, '500', error.message, null, Date.now() - start);
    return res.status(500).send('Error procesando el pago. Por favor, contacte a soporte.');
  }
}

// Confirmar transacción con datos WebPay
async function confirmar(req, res) {
  const start = Date.now();
  
  try {
    console.log('✅ [confirmar] Confirmando transacción...');
    
    const { id_transaccion, webpay_token, webpay_response } = req.body;
    
    if (!id_transaccion) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'ID de transacción faltante', req.body, null, '400', 'id_transaccion es requerido', null, Date.now() - start);
      return res.status(400).json({ success: false, message: 'id_transaccion es requerido' });
    }

    const transaccion = await Transaccion.findByPk(id_transaccion, {
      include: [{ model: EstadoTransaccion, as: 'estado' }]
    });
    if (!transaccion) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción no encontrada', req.body, null, '404', 'Transacción no existe', id_transaccion, Date.now() - start);
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
    }

    if (transaccion.estado && transaccion.estado.nombreEstado !== 'Pendiente') {
  const error = `Transacción ya está en estado: ${transaccion.estado.nombreEstado}`;
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Estado inválido para confirmación', req.body, null, '400', error, id_transaccion, Date.now() - start);
         return res.status(400).json({ success: false, message: error });  }

    const webpayData = webpay_token ? {
      token: webpay_token,
      response: webpay_response
    } : null;

    const resultado = await service.confirmarTransaccion(id_transaccion, webpayData);

    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción confirmada exitosamente', req.body, resultado, '200', null, id_transaccion, Date.now() - start);

    return res.status(200).json({
      success: true,
      message: resultado.mensaje,
      data: {
        transaccion: resultado.transaccion,
        pago_registrado: !!resultado.pago,
        pedido_creado: !!resultado.pedido,
        pedido_estado: 'POR_DESPACHAR',
        webpay: resultado.webpay,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('❌ Error en confirmar:', err.message);
    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Error al confirmar transacción', req.body, null, '500', err.message, req.body.id_transaccion, Date.now() - start);
    return res.status(500).json({ success: false, message: 'Error interno al confirmar transacción', error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno' });
  }
}

// Obtener pedidos por despachar (solo admin)
async function obtenerPedidosPorDespachar(req, res) {
  try {
    console.log('📋 [obtenerPedidosPorDespachar] Consultando pedidos...');
    
    const esAdmin = req.headers['x-admin-token'] || req.query.admin === 'true';
    if (!esAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Se requieren privilegios de administrador.' });
    }

    const filtros = {
      clienteId: req.query.cliente_id,
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      limit: parseInt(req.query.limit) || 50
    };

    const pedidos = await service.obtenerPedidosPorDespachar(filtros);

    return res.status(200).json({
      success: true,
      message: 'Pedidos por despachar obtenidos exitosamente',
      total: pedidos.length,
      pedidos,
      filtros_aplicados: filtros
    });
  } catch (error) {
    console.error('❌ Error en obtenerPedidosPorDespachar:', error.message);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos por despachar', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

// Obtener historial compras por cliente
async function obtenerHistorialCompras(req, res) {
  try {
    const { clienteId } = req.params;
    if (!clienteId || isNaN(clienteId)) {
      return res.status(400).json({ success: false, message: 'ID de cliente inválido' });
    }

    const historial = await service.obtenerHistorialCompras(clienteId);

    return res.status(200).json({
      success: true,
      message: 'Historial de compras obtenido exitosamente',
      cliente_id: clienteId,
      total_compras: historial.length,
      compras: historial
    });
  } catch (error) {
    console.error('❌ Error en obtenerHistorialCompras:', error.message);
    return res.status(500).json({ success: false, message: 'Error al obtener historial de compras', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

// Anular o reembolsar transacción
async function anularTransaccion(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de transacción es requerido' });
    }

    const resultado = await service.anularTransaccion(id);

    await logearAccion(req, 'ANULAR_TRANSACCION', `Transacción ${id} anulada`, { id }, resultado, '200', null, id, Date.now() - start);

    return res.status(200).json({
      success: true,
      message: `Transacción ${id} anulada exitosamente`,
      data: resultado
    });
  } catch (error) {
    console.error('❌ Error en anularTransaccion:', error.message);
    await logearAccion(req, 'ANULAR_TRANSACCION', 'Error al anular transacción', req.params, null, '500', error.message, req.params.id, Date.now() - start);
    return res.status(500).json({ success: false, message: 'Error al anular transacción', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

// Listar transacciones con su estado (endpoint nuevo para pruebas)
async function listarTransacciones(req, res) {
  try {
    const transacciones = await Transaccion.findAll({
      include: [{
        model: EstadoTransaccion,
        as: 'estado',
        attributes: ['codigoEstado', 'nombreEstado', 'descripcion']      }]
    });
    return res.json(transacciones);
  } catch (error) {
    console.error('❌ Error listando transacciones:', error.message);
    return res.status(500).json({ error: 'Error al obtener transacciones' });
  }
}

// Crear transacción directamente (usada en POST /transacciones)
async function crearTransaccion(req, res) {
  const start = Date.now();
  try {
    const { clienteId, ordenCompra, monto, divisa, estadoId, detalles } = req.body;

    // Validación básica
    if (!clienteId || !ordenCompra || !monto || !estadoId) {
      await logearAccion(req, 'CREAR_TRANSACCION', 'Datos incompletos para crear transacción', req.body, null, '400', 'Faltan campos requeridos', null, Date.now() - start);
      return res.status(400).json({ success: false, message: 'clienteId, ordenCompra, monto y estadoId son requeridos' });
    }

    // Crear la transacción
    const transaccion = await Transaccion.create({
      clienteId,
      ordenCompra,
      monto,
      divisa: divisa || 'CLP',
      estadoId
    });

    // Crear detalles si existen (suponemos array de detalles)
    if (Array.isArray(detalles) && detalles.length > 0) {
      for (const detalle of detalles) {
        await DetalleTransaccion.create({
          TransaccionId: transaccion.id,
          producto: detalle.producto,
          cantidad: detalle.cantidad
        });
      }
    }

    await logearAccion(req, 'CREAR_TRANSACCION', 'Transacción creada manualmente', req.body, transaccion, '201', null, transaccion.id, Date.now() - start);

    return res.status(201).json({
      success: true,
      message: 'Transacción creada correctamente',
      transaccion
    });
  } catch (error) {
    console.error('❌ Error en crearTransaccion:', error.message);
    await logearAccion(req, 'CREAR_TRANSACCION', 'Error creando transacción', req.body, null, '500', error.message, null, Date.now() - start);
    return res.status(500).json({ success: false, message: 'Error al crear transacción', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

module.exports = {
  iniciarPagoWebPay,
  paginaPagoWebPay,
  retornoWebPay,
  confirmar,
  obtenerPedidosPorDespachar,
  obtenerHistorialCompras,
  anularTransaccion,
  listarTransacciones,
  crearTransaccion
};
