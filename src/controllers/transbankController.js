// src/controllers/transbankController.js
const { Transaccion, TransbankLog, DetalleTransaccion } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

// URLs de APIs externas
const INVENTORY_API = process.env.INVENTORY_API_URL || 'http://localhost:3000/api';
const BANK_API = process.env.BANK_API_URL || 'http://localhost:3001/api/v1';

// Función auxiliar para logs
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

// ============================================
// LISTAR TRANSACCIONES
// ============================================
async function listarTransacciones(req, res) {
  try {
    console.log('📋 [listarTransacciones] Consultando transacciones...');
    
    const { cliente_id, estado, orden, limite = 50 } = req.query;
    
    // Construir filtros dinámicos
    const whereClause = {};
    if (cliente_id) whereClause.clienteId = cliente_id;
    if (estado) whereClause.estadoTexto = estado;
    
    const transacciones = await Transaccion.findAll({
      where: whereClause,
      attributes: [
        'id', 
        'clienteId', 
        'ordenCompra', 
        'monto', 
        'token', 
        'estadoTexto',
        'detalles', 
        'createdAt', 
        'updatedAt'
      ],
      order: [['createdAt', orden === 'asc' ? 'ASC' : 'DESC']],
      limit: parseInt(limite)
    });
    
    // Transformar respuesta
    const respuesta = transacciones.map(tx => ({
      id: tx.id,
      cliente_id: tx.clienteId,
      orden_compra: tx.ordenCompra,
      monto: parseFloat(tx.monto),
      estado: tx.estadoTexto,
      token: tx.token,
      detalles: tx.detalles,
      fecha_creacion: tx.createdAt,
      fecha_actualizacion: tx.updatedAt
    }));
    
    return res.json({
      success: true,
      total: respuesta.length,
      filtros: { cliente_id, estado, orden, limite },
      transacciones: respuesta
    });
    
  } catch (error) {
    console.error('❌ Error listando transacciones:', error.message);
    return res.status(500).json({ 
      success: false,
      error: 'Error al obtener transacciones',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ============================================
// CREAR TRANSACCIÓN MANUAL
// ============================================
async function crearTransaccion(req, res) {
  const start = Date.now();
  
  try {
    console.log('✨ [crearTransaccion] Creando transacción manual...');
    
    const { clienteId, ordenCompra, monto, divisa = 'CLP', estado = 'PENDIENTE', detalles } = req.body;

    // Validación básica
    if (!clienteId || !ordenCompra || !monto) {
      await logearAccion(req, 'CREAR_TRANSACCION', 'Datos incompletos', req.body, null, '400', 'Faltan campos requeridos', null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: 'clienteId, ordenCompra y monto son requeridos' 
      });
    }

    // Verificar que la orden no exista
    const existeOrden = await Transaccion.findOne({ where: { ordenCompra } });
    if (existeOrden) {
      return res.status(400).json({
        success: false,
        message: `La orden ${ordenCompra} ya existe`
      });
    }

    // Crear la transacción
    const transaccion = await Transaccion.create({
  clienteId,
  ordenCompra,
  monto: parseFloat(monto),
  token: `TOKEN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  estadoTexto: estado.toUpperCase(),  // ✅ Debe ser estadoTexto, NO estadoId
  detalles: detalles || null
});

    await logearAccion(req, 'CREAR_TRANSACCION', 'Transacción creada manualmente', req.body, transaccion, '201', null, transaccion.id, Date.now() - start);

    return res.status(201).json({
      success: true,
      message: 'Transacción creada correctamente',
      transaccion: {
        id: transaccion.id,
        cliente_id: transaccion.clienteId,
        orden_compra: transaccion.ordenCompra,
        monto: parseFloat(transaccion.monto),
        estado: transaccion.estadoTexto,
        token: transaccion.token,
        fecha_creacion: transaccion.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error en crearTransaccion:', error.message);
    await logearAccion(req, 'CREAR_TRANSACCION', 'Error creando transacción', req.body, null, '500', error.message, null, Date.now() - start);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al crear transacción', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

// ============================================
// INICIAR PAGO WEBPAY
// ============================================
async function iniciarPagoWebPay(req, res) {
  const start = Date.now();
  
  try {
    console.log('💳 [iniciarPagoWebPay] Iniciando pago con WebPay...');
    
    const { clienteId, productos, email, returnUrl } = req.body;
    
    // Validación básica
    if (!clienteId || !productos || !Array.isArray(productos) || productos.length === 0) {
      await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Datos inválidos', req.body, null, '400', 'clienteId y productos son requeridos', null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: 'clienteId y productos (array) son requeridos' 
      });
    }

    // Validar y calcular monto total
    const productosDetallados = [];
    let montoTotal = 0;

    for (const item of productos) {
      if (!item.ID_Producto || !item.Cantidad || item.Cantidad <= 0) {
        return res.status(400).json({
          success: false,
          message: `Producto inválido: ${JSON.stringify(item)}`
        });
      }

      try {
        // Obtener información del producto desde API Inventario
        const prodResponse = await axios.get(`${INVENTORY_API}/productos/${item.ID_Producto}`, { timeout: 5000 });
        const productoInfo = prodResponse.data;

        // Verificar stock disponible
      const stockResponse = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}/sucursal/1`, { timeout: 5000 });        const inventarioInfo = stockResponse.data;

        if (!inventarioInfo || inventarioInfo.Stock_Actual < item.Cantidad) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para ${productoInfo.Nombre}. Disponible: ${inventarioInfo?.Stock_Actual || 0}, Solicitado: ${item.Cantidad}`
          });
        }

        const precioUnitario = parseFloat(productoInfo.Precio_Venta);
        const subtotal = precioUnitario * item.Cantidad;
        montoTotal += subtotal;

        productosDetallados.push({
          ID_Producto: item.ID_Producto,
          Nombre: productoInfo.Nombre,
          Descripcion: productoInfo.Descripcion,
          Precio_Unitario: precioUnitario,
          Cantidad: item.Cantidad,
          Subtotal: subtotal,
          Stock_Disponible: inventarioInfo.Stock_Actual
        });

      } catch (apiError) {
        console.error(`Error consultando producto ${item.ID_Producto}:`, apiError.message);
        return res.status(400).json({
          success: false,
          message: `Error consultando producto ID ${item.ID_Producto}: ${apiError.message}`
        });
      }
    }

    // Generar orden de compra única
    const ordenCompra = `FERREMAS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Crear transacción en BD
    const transaccion = await Transaccion.create({
      clienteId,
      ordenCompra,
      monto: montoTotal,
      token: crypto.randomBytes(32).toString('hex'),
      estadoTexto: 'PENDIENTE',
      detalles: productosDetallados
    });

    // Simular respuesta de WebPay
    const webpayData = {
      token: transaccion.token,
      url_redirect: `http://localhost:3003/api/transbank/webpay/pagar?token=${transaccion.token}`,
      transaccion_id: transaccion.id,
      monto_total: montoTotal,
      orden_compra: ordenCompra
    };

    await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Pago WebPay iniciado exitosamente', req.body, webpayData, '201', null, transaccion.id, Date.now() - start);

    return res.status(201).json({
      success: true,
      message: 'Transacción WebPay iniciada. Redirigir al usuario a la URL de pago.',
      transaccion_id: transaccion.id,
      token: transaccion.token,
      url_redirect: webpayData.url_redirect,
      monto_total: montoTotal,
      orden_compra: ordenCompra,
      productos_validados: productosDetallados.length,
      instrucciones: 'Redirige al usuario a url_redirect para completar el pago'
    });

  } catch (error) {
    console.error('❌ Error en iniciarPagoWebPay:', error.message);
    await logearAccion(req, 'INICIAR_PAGO_WEBPAY', 'Error al iniciar pago', req.body, null, '500', error.message, null, Date.now() - start);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al iniciar pago con WebPay', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
}

// ============================================
// PÁGINA DE PAGO WEBPAY (SIMULADA)
// ============================================
async function paginaPagoWebPay(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('<h1>Error</h1><p>Token requerido</p>');
    }

    // Verificar que la transacción existe
    const transaccion = await Transaccion.findOne({ where: { token } });
    if (!transaccion) {
      return res.status(404).send('<h1>Error</h1><p>Transacción no encontrada</p>');
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WebPay Plus - Pago Seguro</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 100%; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #d32f2f; margin-bottom: 20px; text-align: center; }
        .info { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin-bottom: 20px; font-size: 14px; }
        .order-info { background: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; color: #666; }
        input { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
        .buttons { display: flex; gap: 10px; }
        button { flex: 1; padding: 12px; font-size: 16px; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.3s; }
        .btn-pagar { background-color: #4caf50; color: white; }
        .btn-pagar:hover { background-color: #45a049; }
        .btn-cancelar { background-color: #f44336; color: white; }
        .btn-cancelar:hover { background-color: #da190b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏦 WebPay Plus</h1>
        <div class="info">
          <strong>⚠️ Modo de prueba:</strong> Use cualquier número de tarjeta para simular el pago.
        </div>
        
        <div class="order-info">
          <h3>📋 Detalles de la Compra</h3>
          <p><strong>Orden:</strong> ${transaccion.ordenCompra}</p>
          <p><strong>Monto:</strong> $${Number(transaccion.monto).toLocaleString('es-CL')} CLP</p>
          <p><strong>Cliente ID:</strong> ${transaccion.clienteId}</p>
        </div>
        
        <form id="paymentForm">
          <label for="cardNumber">Número de Tarjeta</label>
          <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required>
          
          <label for="cardHolder">Nombre del Titular</label>
          <input type="text" id="cardHolder" placeholder="JUAN PEREZ" required>
          
          <label for="expiry">Fecha de Vencimiento</label>
          <input type="text" id="expiry" placeholder="MM/AA" maxlength="5" required>
          
          <label for="cvv">CVV</label>
          <input type="text" id="cvv" placeholder="123" maxlength="4" required>
          
          <div class="buttons">
            <button type="button" class="btn-cancelar" onclick="cancelarPago()">❌ Cancelar</button>
            <button type="submit" class="btn-pagar">✅ Pagar</button>
          </div>
        </form>
      </div>

      <script>
        const token = '${token}';
        
        // Formatear número de tarjeta
        document.getElementById('cardNumber').addEventListener('input', function(e) {
          let value = e.target.value.replace(/\\s/g, '');
          let formattedValue = value.replace(/(\\d{4})(?=\\d)/g, '$1 ');
          e.target.value = formattedValue;
        });
        
        // Formatear fecha de vencimiento
        document.getElementById('expiry').addEventListener('input', function(e) {
          let value = e.target.value.replace(/\\D/g, '');
          if (value.length >= 2) {
            value = value.substring(0,2) + '/' + value.substring(2,4);
          }
          e.target.value = value;
        });
        
                // Procesar pago
        document.getElementById('paymentForm').addEventListener('submit', function(e) {
          e.preventDefault();
          
          // Validar que el token existe
          if (!token || token === '') {
            alert('❌ Error: Token de transacción no válido. Recargue la página.');
            return;
          }
          
          // Validar datos del formulario
          const cardNumber = document.getElementById('cardNumber').value.replace(/\\s/g, '');
          const cardHolder = document.getElementById('cardHolder').value.trim();
          const expiry = document.getElementById('expiry').value;
          const cvv = document.getElementById('cvv').value;
          
          if (cardNumber.length < 13) {
            alert('❌ Número de tarjeta inválido');
            return;
          }
          
          if (cardHolder.length < 2) {
            alert('❌ Nombre del titular requerido');
            return;
          }
          
          if (expiry.length !== 5) {
            alert('❌ Fecha de vencimiento inválida (MM/AA)');
            return;
          }
          
          if (cvv.length < 3) {
            alert('❌ CVV inválido');
            return;
          }
          
          // Simular procesamiento
          const btn = document.querySelector('.btn-pagar');
          const originalText = btn.textContent;
          btn.textContent = '⏳ Procesando...';
          btn.disabled = true;
          
          // Debug: Mostrar token en consola
          console.log('🔍 Token a enviar:', token);
          
          setTimeout(() => {
            try {
              // Construir URL de retorno con validación
              const returnUrl = '/api/transbank/webpay/retorno?token=' + encodeURIComponent(token) + '&status=success';
              console.log('🚀 Redirigiendo a:', returnUrl);
              
              // Redirigir a confirmación exitosa
              window.location.href = returnUrl;
            } catch (error) {
              console.error('❌ Error en redirección:', error);
              alert('❌ Error procesando el pago. Intente nuevamente.');
              btn.textContent = originalText;
              btn.disabled = false;
            }
          }, 2000);
        });
        
        function cancelarPago() {
          if (confirm('¿Está seguro que desea cancelar el pago?')) {
            if (!token || token === '') {
              alert('❌ Error: Token de transacción no válido.');
              return;
            }
            // Construir URL de cancelación
            const cancelUrl = '/api/transbank/webpay/retorno?token=' + encodeURIComponent(token) + '&status=cancelled';
            console.log('❌ Cancelando, redirigiendo a:', cancelUrl);
            window.location.href = cancelUrl;
          }
        }
        
        // Validación adicional al cargar la página
        window.addEventListener('load', function() {
          if (!token || token.length < 10) {
            document.querySelector('.container').innerHTML = 
              '<div style="text-align: center; padding: 40px;">' +
              '<h1 style="color: #f44336;">❌ Error</h1>' +
              '<p>Token de transacción inválido.</p>' +
              '<p>Por favor, inicie una nueva transacción.</p>' +
              '<a href="/" style="display: inline-block; padding: 12px 30px; background: #2196f3; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px;">🏠 Volver a Inicio</a>' +
              '</div>';
          }
        });
      </script>
    </body>
    </html>`; return res.send(html);
    
  } catch (error) {
    console.error('❌ Error en paginaPagoWebPay:', error.message);
    return res.status(500).send('<h1>Error</h1><p>Error interno del servidor</p>');
  }
}

// ============================================
// RETORNO WEBPAY
// ============================================
async function retornoWebPay(req, res) {
  const start = Date.now();
  
  try {
    const { token, status } = req.query;

    if (!token) {
      return res.status(400).send('<h1>Error</h1><p>Token requerido</p>');
    }

    const transaccion = await Transaccion.findOne({ where: { token } });
    if (!transaccion) {
      return res.status(404).send('<h1>Error</h1><p>Transacción no encontrada</p>');
    }

    if (status === 'success') {
      // Actualizar estado de la transacción
      transaccion.estadoTexto = 'APROBADO';
      await transaccion.save();

      await logearAccion(req, 'RETORNO_WEBPAY_EXITOSO', 'Pago procesado exitosamente', { token, status }, null, '200', null, transaccion.id, Date.now() - start);

      const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>✅ Pago Exitoso - FERREMAS</title>
        <style>
          body { font-family: Arial; background: #f5f5f5; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .container { background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center; max-width: 500px; }
          .icon { font-size: 72px; color: #4caf50; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 10px; }
          .info-box { background: #f5f5f5; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .btn { display: inline-block; padding: 12px 30px; background: #2196f3; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>¡Pago Exitoso!</h1>
          <p>Tu compra ha sido procesada correctamente.</p>
          <div class="info-box">
            <h3>📋 Detalles de la Orden</h3>
            <p><strong>N° Orden:</strong> ${transaccion.ordenCompra}</p>
            <p><strong>Monto:</strong> $${Number(transaccion.monto).toLocaleString('es-CL')} CLP</p>
            <p><strong>Estado:</strong> Aprobado ✅</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CL')}</p>
          </div>
          <p>📧 Recibirás un correo con los detalles de tu pedido.</p>
          <p>📦 Tu pedido será despachado en las próximas 48-72 horas.</p>
          <a href="/" class="btn">🏠 Volver a la Tienda</a>
        </div>
      </body>
      </html>`;

      return res.send(html);
      
    } else {
      // Pago cancelado
      transaccion.estadoTexto = 'CANCELADO';
      await transaccion.save();

      await logearAccion(req, 'RETORNO_WEBPAY_CANCELADO', 'Pago cancelado por el usuario', { token, status }, null, '200', null, transaccion.id, Date.now() - start);

      const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>❌ Pago Cancelado - FERREMAS</title>
        <style>
          body { font-family: Arial; background: #f5f5f5; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .container { background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center; max-width: 500px; }
          .icon { font-size: 72px; color: #f44336; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 10px; }
          .btn { display: inline-block; padding: 12px 30px; background: #2196f3; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Pago Cancelado</h1>
          <p>El proceso de pago ha sido cancelado.</p>
          <p>🛒 Tu carrito de compras ha sido guardado y puedes intentar nuevamente cuando lo desees.</p>
          <a href="/" class="btn">🏠 Volver a la Tienda</a>
        </div>
      </body>
      </html>`;

      return res.send(html);
    }
    
  } catch (error) {
    console.error('❌ Error en retornoWebPay:', error.message);
    await logearAccion(req, 'ERROR_RETORNO_WEBPAY', 'Error procesando retorno', req.query, null, '500', error.message, null, Date.now() - start);
    return res.status(500).send('<h1>❌ Error</h1><p>Error procesando el pago. Contacte a soporte.</p>');
  }
}

// ============================================
// CONFIRMAR TRANSACCIÓN (API)
// ============================================
async function confirmar(req, res) {
  const start = Date.now();
  
  try {
    console.log('✅ [confirmar] Confirmando transacción...');
    
    const { token, estado = 'EXITO' } = req.body;
    
    if (!token) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Token faltante', req.body, null, '400', 'token es requerido', null, Date.now() - start);
      return res.status(400).json({ 
        success: false, 
        message: 'token es requerido' 
      });
    }

    const transaccion = await Transaccion.findOne({ where: { token } });
    if (!transaccion) {
      await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción no encontrada', req.body, null, '404', 'Token inválido', null, Date.now() - start);
      return res.status(404).json({ 
        success: false, 
        message: 'Transacción no encontrada' 
      });
    }

    // Verificar estado actual
    if (transaccion.estadoTexto === 'APROBADO') {
      return res.status(400).json({
        success: false,
        message: 'La transacción ya está aprobada'
      });
    }

    // Actualizar estado según el resultado
    const nuevoEstado = estado === 'EXITO' ? 'APROBADO' : 'RECHAZADO';
    transaccion.estadoTexto = nuevoEstado;
    await transaccion.save();

    // Si fue exitoso, intentar actualizar inventario
    let inventarioActualizado = false;
    if (nuevoEstado === 'APROBADO' && transaccion.detalles) {
      try {
        const productos = Array.isArray(transaccion.detalles) ? transaccion.detalles : JSON.parse(transaccion.detalles);
        
        for (const producto of productos) {
          if (producto.ID_Producto && producto.Cantidad) {
            await axios.post(`${INVENTORY_API}/inventario/${producto.ID_Producto}/movimiento`, {
              Tipo_Movimiento: 'Salida',
              Cantidad: producto.Cantidad,
              ID_Bodeguero: 1,
              Comentario: `Venta - Orden ${transaccion.ordenCompra}`
            }, { timeout: 5000 });
          }
        }
        inventarioActualizado = true;
        console.log('✅ Inventario actualizado correctamente');
        
      } catch (inventarioError) {
        console.warn('⚠️ Error actualizando inventario:', inventarioError.message);
      }
    }

    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Transacción confirmada exitosamente', req.body, { transaccion, inventarioActualizado }, '200', null, transaccion.id, Date.now() - start);

    return res.status(200).json({
      success: true,
      message: `Transacción ${nuevoEstado.toLowerCase()} exitosamente`,
      transaccion: {
        id: transaccion.id,
        orden_compra: transaccion.ordenCompra,
        cliente_id: transaccion.clienteId,
        monto: parseFloat(transaccion.monto),
        estado: transaccion.estadoTexto,
        token: transaccion.token,
        fecha_actualizacion: transaccion.updatedAt
      },
      inventario_actualizado: inventarioActualizado,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en confirmar:', error.message);
    await logearAccion(req, 'CONFIRMAR_TRANSACCION', 'Error al confirmar transacción', req.body, null, '500', error.message, null, Date.now() - start);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al confirmar transacción', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno' 
    });
  }
}

// ============================================
// OBTENER PEDIDOS POR DESPACHAR
// ============================================
async function obtenerPedidosPorDespachar(req, res) {
  try {
    console.log('📋 [obtenerPedidosPorDespachar] Consultando pedidos...');
    
    const { cliente_id, fecha_desde, fecha_hasta, limite = 50 } = req.query;
    
    // Construir filtros
    const whereClause = { estadoTexto: 'APROBADO' };
    if (cliente_id) whereClause.clienteId = cliente_id;
    
    if (fecha_desde && fecha_hasta) {
      whereClause.createdAt = {
        [Op.between]: [new Date(fecha_desde), new Date(fecha_hasta)]
      };
    }

    const pedidos = await Transaccion.findAll({
      where: whereClause,
      attributes: [
        'id', 
        'clienteId', 
        'ordenCompra', 
        'monto', 
        'estadoTexto',
        'detalles', 
        'createdAt'
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limite)
    });

    // Transformar respuesta
    const pedidosFormateados = pedidos.map(pedido => ({
      transaccion_id: pedido.id,
      orden_compra: pedido.ordenCompra,
      cliente_id: pedido.clienteId,
      monto_total: parseFloat(pedido.monto),
      fecha_creacion: pedido.createdAt,
      estado: 'POR_DESPACHAR',
      productos: pedido.detalles || []
    }));

    return res.status(200).json({
      success: true,
      message: 'Pedidos por despachar obtenidos exitosamente',
      total: pedidosFormateados.length,
      filtros: { cliente_id, fecha_desde, fecha_hasta, limite },
      pedidos: pedidosFormateados
    });
    
  } catch (error) {
    console.error('❌ Error en obtenerPedidosPorDespachar:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener pedidos por despachar', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

// ============================================
// OBTENER HISTORIAL DE COMPRAS POR CLIENTE
// ============================================
async function obtenerHistorialCompras(req, res) {
  try {
    const { clienteId } = req.params;
    
    if (!clienteId || isNaN(clienteId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de cliente inválido' 
      });
    }

    console.log(`📊 [obtenerHistorialCompras] Cliente ID: ${clienteId}`);

    const compras = await Transaccion.findAll({
      where: { 
        clienteId: parseInt(clienteId),
        estadoTexto: { [Op.in]: ['APROBADO', 'PENDIENTE'] }
      },
      attributes: [
        'id', 
        'ordenCompra', 
        'monto', 
        'estadoTexto',
        'detalles', 
        'createdAt',
        'updatedAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    const historialFormateado = compras.map(compra => ({
      transaccion: {
        id: compra.id,
        orden_compra: compra.ordenCompra,
        monto: parseFloat(compra.monto),
        fecha: compra.createdAt,
        estado: compra.estadoTexto
      },
      productos: compra.detalles || [],
      fecha_actualizacion: compra.updatedAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Historial de compras obtenido exitosamente',
      cliente_id: parseInt(clienteId),
      total_compras: historialFormateado.length,
      compras: historialFormateado
    });
    
  } catch (error) {
    console.error('❌ Error en obtenerHistorialCompras:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener historial de compras', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

// ============================================
// ANULAR TRANSACCIÓN
// ============================================
async function anularTransaccion(req, res) {
  const start = Date.now();
  
  try {
    const { id } = req.params;
    const { motivo = 'Solicitud de anulación' } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de transacción inválido' 
      });
    }

    console.log(`🔴 [anularTransaccion] ID: ${id}, Motivo: ${motivo}`);

    const transaccion = await Transaccion.findByPk(id);
    if (!transaccion) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transacción no encontrada' 
      });
    }

    if (transaccion.estadoTexto === 'CANCELADO' || transaccion.estadoTexto === 'REEMBOLSADO') {
      return res.status(400).json({
        success: false,
        message: `La transacción ya está ${transaccion.estadoTexto.toLowerCase()}`
      });
    }

    // Actualizar estado
    const estadoAnterior = transaccion.estadoTexto;
    transaccion.estadoTexto = 'REEMBOLSADO';
    await transaccion.save();

    await logearAccion(req, 'ANULAR_TRANSACCION', 'Transacción anulada', { id, motivo, estadoAnterior }, transaccion, '200', null, transaccion.id, Date.now() - start);

    return res.status(200).json({
      success: true,
      message: 'Transacción anulada exitosamente',
      transaccion: {
        id: transaccion.id,
        orden_compra: transaccion.ordenCompra,
        estado_anterior: estadoAnterior,
        estado_actual: transaccion.estadoTexto,
        motivo_anulacion: motivo,
        fecha_anulacion: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error en anularTransaccion:', error.message);
    await logearAccion(req, 'ANULAR_TRANSACCION', 'Error anulando transacción', req.params, null, '500', error.message, req.params.id, Date.now() - start);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al anular transacción', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

// ============================================
// HEALTH CHECK
// ============================================
async function healthCheck(req, res) {
  try {
    // Verificar conexiones a APIs externas
    const conexiones = {
      inventario: false,
      banco: false,
      database: false,
      timestamp: new Date().toISOString()
    };

    // Test BD
    try {
      await Transaccion.findOne({ limit: 1 });
      conexiones.database = true;
    } catch (dbError) {
      console.warn('⚠️ Database no disponible:', dbError.message);
    }

    // Test API Inventario
    try {
      const inventarioResp = await axios.get(`${INVENTORY_API}/productos`, { timeout: 3000 });
      conexiones.inventario = inventarioResp.status === 200;
    } catch (inventarioError) {
      console.warn('⚠️ API Inventario no disponible:', inventarioError.message);
    }

    // Test API Banco
    try {
      const bancoResp = await axios.get(`${BANK_API}/`, { timeout: 3000 });
      conexiones.banco = bancoResp.status === 200;
    } catch (bancoError) {
      console.warn('⚠️ API Banco no disponible:', bancoError.message);
    }

    const todasConectadas = Object.values(conexiones).filter(v => typeof v === 'boolean').every(v => v);

    return res.status(todasConectadas ? 200 : 503).json({
      success: todasConectadas,
      message: todasConectadas ? 'Todas las conexiones funcionando' : 'Algunas conexiones fallan',
      status: 'API Transbank funcionando',
      version: '1.0.0',
      conexiones
    });
    
  } catch (error) {
    console.error('❌ Error en healthCheck:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error en health check',
      error: error.message
    });
  }
}

// ============================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================
module.exports = {
  listarTransacciones,
  crearTransaccion,
  iniciarPagoWebPay,
  paginaPagoWebPay,
  retornoWebPay,
  confirmar,
  obtenerPedidosPorDespachar,
  obtenerHistorialCompras,
  anularTransaccion,
  healthCheck
};