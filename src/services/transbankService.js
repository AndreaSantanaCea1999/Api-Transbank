// src/services/transbankService.js
const axios = require('axios');
const crypto = require('crypto');
const { Transaccion, TransbankLog, EstadoTransaccion } = require('../models');

const INVENTORY_API = process.env.INVENTORY_API_URL || 'http://localhost:3000/api';
const BANK_API = process.env.BANK_API_URL || 'http://localhost:3001/api/v1';

// Configuración WebPay (Modo desarrollo)
const WEBPAY_CONFIG = {
  commerceCode: process.env.WEBPAY_COMMERCE_CODE || '597055555532',
  apiKey: process.env.WEBPAY_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
  environment: process.env.NODE_ENV === 'production' ? 'PRODUCCION' : 'INTEGRACION'
};

// Función principal para crear transacción con WebPay (con validación y cálculo internos)
async function crearTransaccionWebPay(data) {
  try {
    console.log('💳 [crearTransaccionWebPay] Iniciando transacción WebPay...');
    const { clienteId, productos } = data;

    if (!productos || !Array.isArray(productos) || productos.length !== 2) {
      throw new Error('Debe seleccionar exactamente 2 productos');
    }

    const productosDetalladosParaTransaccion = [];
    let montoTotalCalculado = 0;

    for (const item of productos) {
      if (!item.ID_Producto || !item.Cantidad || item.Cantidad <= 0) {
        throw new Error(`Producto inválido en la solicitud: ${JSON.stringify(item)}`);
      }

      // Obtener detalles producto
      const prodResponse = await axios.get(`${INVENTORY_API}/productos/${item.ID_Producto}`);
      const productoInfo = prodResponse.data;

      // Verificar stock
      const stockResponse = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);
      const inventarioInfo = stockResponse.data;

      if (!inventarioInfo || inventarioInfo.Stock_Actual < item.Cantidad) {
        throw new Error(`Stock insuficiente para ${productoInfo.Nombre}. Disponible: ${inventarioInfo?.Stock_Actual || 0}`);
      }

      const precioVenta = parseFloat(productoInfo.Precio_Venta);
      if (isNaN(precioVenta)) throw new Error(`Precio inválido para el producto ${productoInfo.Nombre}`);

      const subtotal = precioVenta * item.Cantidad;
      montoTotalCalculado += subtotal;

      productosDetalladosParaTransaccion.push({
        ID_Producto: item.ID_Producto,
        Nombre: productoInfo.Nombre,
        Descripcion: productoInfo.Descripcion,
        Precio_Unitario: precioVenta,
        Cantidad: item.Cantidad,
        Subtotal: subtotal,
        Stock_Disponible: inventarioInfo.Stock_Actual
      });
    }

    // Obtener estado "Pendiente"
    const estadoPendiente = await EstadoTransaccion.findOne({ where: { nombreEstado: 'Pendiente' } });
    if (!estadoPendiente) throw new Error('Estado "Pendiente" no encontrado');

    // Generar orden de compra única
    const ordenCompra = `FERREMAS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Crear transacción local
    const transaccion = await Transaccion.create({
      clienteId,
      ordenCompra,
      monto: montoTotalCalculado,
      divisa: 'CLP',
      estadoId: estadoPendiente.id,
      detalles: productosDetalladosParaTransaccion
    });

    // Generar token WebPay simulado
    const webpayToken = crypto.randomBytes(32).toString('hex');
    const webpayUrl = `http://localhost:3003/api/transbank/webpay/pagar?token=${webpayToken}`;

    // Registrar en logs
    await TransbankLog.create({
      ID_Transaccion: transaccion.id,
      Accion: 'CREAR_TRANSACCION_WEBPAY',
      Descripcion: 'Transacción WebPay iniciada',
      Datos_Entrada: JSON.stringify(data),
      Datos_Salida: JSON.stringify({
        transaccion_id: transaccion.id,
        webpay_token: webpayToken,
        monto: montoTotalCalculado
      }),
      Codigo_Respuesta: '201'
    });

    return {
      transaccion,
      webpay: {
        token: webpayToken,
        url: webpayUrl,
        commerceCode: WEBPAY_CONFIG.commerceCode
      }
    };

  } catch (error) {
    console.error('❌ Error en crearTransaccionWebPay:', error);

    await TransbankLog.create({
      Accion: 'ERROR_CREAR_TRANSACCION_WEBPAY',
      Descripcion: 'Error al crear transacción WebPay',
      Datos_Entrada: JSON.stringify(data),
      Codigo_Respuesta: '500',
      Mensaje_Error: error.message
    });

    throw error;
  }
}

// Función para confirmar pago WebPay
async function confirmarPagoWebPay(token, webpayResponse) {
  try {
    console.log('✅ [confirmarPagoWebPay] Confirmando pago WebPay...');

    // Simulación de aprobación
    const pagoAprobado = webpayResponse?.status === 'AUTHORIZED' || true;

    if (!pagoAprobado) {
      throw new Error('Pago rechazado por WebPay');
    }

    return {
      aprobado: true,
      codigo_autorizacion: `AUTH-${Date.now()}`,
      fecha_transaccion: new Date(),
      tipo_pago: 'WebPay Plus',
      cuotas: 0,
      monto_pagado: webpayResponse?.amount || 0
    };

  } catch (error) {
    console.error('❌ Error confirmando pago WebPay:', error);
    throw error;
  }
}

// Función para confirmar la transacción completa
async function confirmarTransaccion(id_transaccion, webpayData = null) {
  let tx = null;
  let estadoOriginal = null;

  try {
    console.log('🔄 [confirmarTransaccion] Procesando confirmación completa...');

    // Buscar transacción con estado
    tx = await Transaccion.findByPk(id_transaccion, {
      include: [{ model: EstadoTransaccion, as: 'estado' }]
    });

    if (!tx) throw new Error('Transacción no encontrada');

    estadoOriginal = tx.estadoId;

    if (tx.estado.nombreEstado !== 'Pendiente') {
      throw new Error(`Transacción ya procesada con estado: ${tx.estado.nombreEstado}`);
    }

    // Confirmar pago WebPay si hay datos
    let pagoWebPay = null;
    if (webpayData) {
      pagoWebPay = await confirmarPagoWebPay(webpayData.token, webpayData.response);
    }

    // Reservar stock
    console.log('📦 Reservando stock...');
    const reservasStock = [];

    for (const item of tx.detalles) {
      try {
        const inventarioResp = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);

        if (inventarioResp.data && inventarioResp.data.ID_Inventario) {
          const movimientoData = {
            ID_Inventario: inventarioResp.data.ID_Inventario,
            Tipo_Movimiento: 'SALIDA',
            Cantidad: Math.abs(item.Cantidad) * -1,
            Precio_Unitario: item.Precio_Unitario,
            Comentarios: `Venta WebPay - Trans: ${tx.id} - Orden: ${tx.ordenCompra}`
          };

          const movimientoResp = await axios.post(`${INVENTORY_API}/movimientos`, movimientoData, { timeout: 10000 });

          reservasStock.push({
            producto_id: item.ID_Producto,
            cantidad: item.Cantidad,
            movimiento_id: movimientoResp.data.id
          });
        }
      } catch (stockError) {
        console.error(`Error reservando stock para producto ${item.ID_Producto}:`, stockError.message);
        throw new Error(`No se pudo reservar stock para producto ${item.ID_Producto}`);
      }
    }

    // Registrar pago en banco
    console.log('💰 Registrando pago en banco...');
    const pagoData = {
      cliente_id: tx.clienteId,
      orden_id: tx.ordenCompra,
      monto: parseFloat(tx.monto),
      divisa: tx.divisa,
      metodo_pago: 'WEBPAY_PLUS',
      estado: 'APROBADO',
      detalles: {
        codigo_autorizacion: pagoWebPay?.codigo_autorizacion,
        tipo_tarjeta: 'CREDITO',
        ultimos_digitos: '****',
        banco_emisor: 'Banco de Prueba',
        fecha_transaccion: new Date()
      }
    };

    const pagoResp = await axios.post(`${BANK_API}/pagos`, pagoData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BANK_API_KEY || ''
      }
    });

    // Crear pedido por despachar
    console.log('📋 Creando pedido por despachar...');
    const pedidoData = {
      ID_Cliente: tx.clienteId,
      ID_Sucursal: 1,
      Total: parseFloat(tx.monto),
      Estado: 'POR_DESPACHAR',
      Fecha_Entrega: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      Comentarios: `Pedido WebPay - Trans: ${tx.id} - Pago: ${pagoResp.data.id}`,
      detalles: tx.detalles.map(item => ({
        ID_Producto: item.ID_Producto,
        Cantidad: item.Cantidad,
        Precio_Unitario: item.Precio_Unitario,
        Subtotal: item.Cantidad * item.Precio_Unitario
      }))
    };

    let pedidoResp;
    try {
      pedidoResp = await axios.post(`${INVENTORY_API}/pedidos`, pedidoData, { timeout: 10000 });
    } catch (pedidoError) {
      console.warn('⚠️ No se pudo crear pedido, endpoint no disponible');
      pedidoResp = { data: { id: 'N/A', mensaje: 'Pedido pendiente de creación manual' } };
    }

    // Actualizar estado a "Aprobado"
    const estadoAprobado = await EstadoTransaccion.findOne({ where: { nombreEstado: 'Aprobado' } });
    tx.estadoId = estadoAprobado.id;
    await tx.save();

    // Registrar log confirmación
    await TransbankLog.create({
      ID_Transaccion: tx.id,
      Accion: 'CONFIRMAR_TRANSACCION_COMPLETA',
      Descripcion: 'Transacción confirmada exitosamente con WebPay',
      Datos_Entrada: JSON.stringify({ id_transaccion, webpayData }),
      Datos_Salida: JSON.stringify({
        pago_id: pagoResp.data.id,
        pedido_id: pedidoResp.data.id,
        reservas_stock: reservasStock
      }),
      Codigo_Respuesta: '200'
    });

    console.log('✅ Transacción confirmada completamente');

    return {
      transaccion: tx,
      pago: pagoResp.data,
      pedido: pedidoResp.data,
      webpay: pagoWebPay,
      reservas_stock: reservasStock,
      mensaje: 'Transacción procesada exitosamente. Pedido en estado "por despachar".'
    };

  } catch (error) {
    console.error('❌ Error en confirmarTransaccion:', error);

    if (tx && estadoOriginal) {
      try {
        const estadoRechazado = await EstadoTransaccion.findOne({ where: { nombreEstado: 'Rechazado' } });
        if (estadoRechazado) {
          tx.estadoId = estadoRechazado.id;
          await tx.save();
        }
      } catch (revertError) {
        console.error('Error revirtiendo estado:', revertError);
      }
    }

    await TransbankLog.create({
      ID_Transaccion: id_transaccion,
      Accion: 'ERROR_CONFIRMAR_TRANSACCION',
      Descripcion: 'Error al confirmar transacción',
      Codigo_Respuesta: '500',
      Mensaje_Error: error.message
    });

    throw error;
  }
}

// Función para obtener pedidos por despachar (admin)
async function obtenerPedidosPorDespachar(filtros = {}) {
  try {
    console.log('📋 [obtenerPedidosPorDespachar] Consultando pedidos...');

    const whereClause = {};
    const estadoAprobado = await EstadoTransaccion.findOne({ where: { nombreEstado: 'Aprobado' } });

    if (estadoAprobado) {
      whereClause.estadoId = estadoAprobado.id;
    }

    if (filtros.clienteId) {
      whereClause.clienteId = filtros.clienteId;
    }

    if (filtros.fecha_desde && filtros.fecha_hasta) {
      whereClause.createdAt = {
        [require('sequelize').Op.between]: [
          new Date(filtros.fecha_desde),
          new Date(filtros.fecha_hasta)
        ]
      };
    }

    const transacciones = await Transaccion.findAll({
      where: whereClause,
      include: [{ model: EstadoTransaccion, as: 'estado' }],
      order: [['createdAt', 'DESC']],
      limit: filtros.limit || 50
    });

    const pedidosEnriquecidos = await Promise.all(
      transacciones.map(async (tx) => {
        try {
          const pedidoResp = await axios.get(`${INVENTORY_API}/pedidos/orden/${tx.ordenCompra}`).catch(() => null);
          return {
            transaccion_id: tx.id,
            orden_compra: tx.ordenCompra,
            cliente_id: tx.clienteId,
            monto_total: tx.monto,
            fecha_creacion: tx.createdAt,
            estado: 'POR_DESPACHAR',
            productos: tx.detalles,
            pedido_inventario: pedidoResp?.data || null
          };
        } catch {
          return {
            transaccion_id: tx.id,
            orden_compra: tx.ordenCompra,
            cliente_id: tx.clienteId,
            monto_total: tx.monto,
            fecha_creacion: tx.createdAt,
            estado: 'POR_DESPACHAR',
            productos: tx.detalles,
            pedido_inventario: null
          };
        }
      })
    );

    return pedidosEnriquecidos;

  } catch (error) {
    console.error('❌ Error obteniendo pedidos por despachar:', error);
    throw error;
  }
}

// Función para obtener historial de compras de cliente
async function obtenerHistorialCompras(clienteId) {
  try {
    console.log(`📊 [obtenerHistorialCompras] Cliente ID: ${clienteId}`);

    const transacciones = await Transaccion.findAll({
      where: { clienteId },
      include: [{ model: EstadoTransaccion, as: 'estado' }],
      order: [['createdAt', 'DESC']]
    });

    const historialCompleto = await Promise.all(
      transacciones.map(async (tx) => {
        let infoPago = null;
        try {
          const pagoResp = await axios.get(`${BANK_API}/pagos/orden/${tx.ordenCompra}`);
          infoPago = pagoResp.data;
        } catch {
          console.warn(`No se encontró información de pago para orden ${tx.ordenCompra}`);
        }

        return {
          transaccion: {
            id: tx.id,
            orden_compra: tx.ordenCompra,
            monto: tx.monto,
            fecha: tx.createdAt,
            estado: tx.estado.nombreEstado
          },
          productos: tx.detalles,
          pago: infoPago
        };
      })
    );

    return historialCompleto;

  } catch (error) {
    console.error('❌ Error obteniendo historial de compras:', error);
    throw error;
  }
}

// Función para verificar salud de las conexiones externas
async function verificarConexiones() {
  const resultados = {
    inventario: false,
    banco: false,
    webpay: true, // Simulado
    timestamp: new Date().toISOString()
  };

  try {
    const inventarioResp = await axios.get(`${INVENTORY_API}/productos`, { timeout: 5000 });
    resultados.inventario = inventarioResp.status === 200;
  } catch (error) {
    console.warn('⚠️ API Inventario no disponible:', error.message);
  }

  try {
    const bancoResp = await axios.get(`${BANK_API}/`, { timeout: 5000 });
    resultados.banco = bancoResp.status === 200;
  } catch (error) {
    console.warn('⚠️ API Banco no disponible:', error.message);
  }

  return resultados;
}

// Función para anular/reembolsar una transacción
async function anularTransaccion(id_transaccion, motivo) {
  try {
    console.log('🔴 [anularTransaccion] Procesando anulación...');

    const tx = await Transaccion.findByPk(id_transaccion, {
      include: [{ model: EstadoTransaccion, as: 'estado' }]
    });

    if (!tx) throw new Error('Transacción no encontrada');
    if (tx.estado.nombreEstado !== 'Aprobado') throw new Error('Solo se pueden anular transacciones aprobadas');

    // Revertir stock
    for (const item of tx.detalles) {
      try {
        const inventarioResp = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);

        if (inventarioResp.data && inventarioResp.data.ID_Inventario) {
          await axios.post(`${INVENTORY_API}/movimientos`, {
            ID_Inventario: inventarioResp.data.ID_Inventario,
            Tipo_Movimiento: 'ENTRADA',
            Cantidad: Math.abs(item.Cantidad),
            Precio_Unitario: item.Precio_Unitario,
            Comentarios: `Reembolso - Trans: ${tx.id} - Motivo: ${motivo}`
          });
        }
      } catch (error) {
        console.error(`Error revirtiendo stock para producto ${item.ID_Producto}`);
      }
    }

    // Registrar reembolso en banco
    await axios.post(`${BANK_API}/pagos/reembolso`, {
      orden_id: tx.ordenCompra,
      monto: parseFloat(tx.monto),
      motivo: motivo
    });

    // Actualizar estado a "Reembolsado"
    const estadoReembolsado = await EstadoTransaccion.findOne({ where: { nombreEstado: 'Reembolsado' } });
    tx.estadoId = estadoReembolsado.id;
    await tx.save();

    // Registrar log
    await TransbankLog.create({
      ID_Transaccion: tx.id,
      Accion: 'ANULAR_TRANSACCION',
      Descripcion: `Transacción anulada. Motivo: ${motivo}`,
      Codigo_Respuesta: '200'
    });

    return { mensaje: 'Transacción anulada y reembolsada correctamente' };

  } catch (error) {
    console.error('❌ Error anulando transacción:', error);
    throw error;
  }
}

module.exports = {
  crearTransaccionWebPay,
  confirmarPagoWebPay,
  confirmarTransaccion,
  obtenerPedidosPorDespachar,
  obtenerHistorialCompras,
  verificarConexiones,
  anularTransaccion
};
