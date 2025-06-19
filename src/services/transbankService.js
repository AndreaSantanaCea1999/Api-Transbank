// src/services/transbankService.js
const axios = require('axios');
const crypto = require('crypto');
const { Transaccion, TransbankLog } = require('../models');

// URLs de APIs externas
const INVENTORY_API = process.env.INVENTORY_API_URL || 'http://localhost:3000/api';
const BANK_API = process.env.BANK_API_URL || 'http://localhost:3001/api';

// Configuración WebPay (Modo desarrollo)
const WEBPAY_CONFIG = {
  commerceCode: process.env.WEBPAY_COMMERCE_CODE || '597055555532',
  apiKey: process.env.WEBPAY_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
  environment: process.env.NODE_ENV === 'production' ? 'PRODUCCION' : 'INTEGRACION'
};

// ============================================
// FUNCIÓN PRINCIPAL: CREAR TRANSACCIÓN WEBPAY
// ============================================
async function crearTransaccionWebPay(data) {
  const startTime = Date.now();
  
  try {
    console.log('💳 [crearTransaccionWebPay] Iniciando transacción WebPay...');
    console.log('🔍 INVENTORY_API configurada como:', INVENTORY_API);
    
    const { clienteId, productos, email, returnUrl } = data;

    // Validaciones básicas
    if (!clienteId) {
      throw new Error('clienteId es requerido');
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      throw new Error('Debe proporcionar al menos un producto');
    }

    const productosDetalladosParaTransaccion = [];
    let montoTotalCalculado = 0;

    console.log(`📋 Procesando ${productos.length} producto(s)...`);

    // ✅ VALIDAR CADA PRODUCTO CON URLS CORREGIDAS
    for (const item of productos) {
      console.log(`\n🔍 Procesando producto: ${JSON.stringify(item)}`);
      
      if (!item.ID_Producto || !item.Cantidad || item.Cantidad <= 0) {
        throw new Error(`Producto inválido: ${JSON.stringify(item)}`);
      }

      try {
        // ✅ CORRECCIÓN: URL que SÍ funciona para obtener producto
        const urlProducto = `${INVENTORY_API}/productos/${item.ID_Producto}`;
        console.log(`🌐 Consultando producto en: ${urlProducto}`);
        
        const prodResponse = await axios.get(urlProducto, { 
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const productoInfo = prodResponse.data;
        console.log(`✅ Producto encontrado: ${productoInfo.Nombre} - $${productoInfo.Precio_Venta}`);

        // ✅ CORRECCIÓN: URL que SÍ funciona para obtener inventario
        const urlInventario = `${INVENTORY_API}/inventario`;
        console.log(`🌐 Consultando inventario en: ${urlInventario}`);
        
        const inventarioResponse = await axios.get(urlInventario, { 
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const inventarioCompleto = inventarioResponse.data;
        console.log(`📦 Inventario obtenido: ${inventarioCompleto.length} registros`);
        
        // Filtrar inventarios por ID_Producto
        const inventariosProducto = inventarioCompleto.filter(inv => 
          inv.ID_Producto === parseInt(item.ID_Producto)
        );
        
        console.log(`🎯 Inventarios encontrados para producto ${item.ID_Producto}: ${inventariosProducto.length}`);
        
        // Sumar stock de todas las sucursales
        const stockTotal = inventariosProducto.reduce((total, inv) => {
          const stock = parseInt(inv.Stock_Actual) || 0;
          console.log(`  📍 Sucursal ${inv.ID_Sucursal}: ${stock} unidades`);
          return total + stock;
        }, 0);
        
        console.log(`📊 Stock total disponible: ${stockTotal} unidades`);
        console.log(`📋 Cantidad solicitada: ${item.Cantidad} unidades`);

        // Verificar stock suficiente
        if (stockTotal < item.Cantidad) {
          throw new Error(`Stock insuficiente para ${productoInfo.Nombre}. Disponible: ${stockTotal}, Solicitado: ${item.Cantidad}`);
        }

        // Calcular precios
        const precioUnitario = parseFloat(productoInfo.Precio_Venta);
        if (isNaN(precioUnitario) || precioUnitario <= 0) {
          throw new Error(`Precio inválido para el producto ${productoInfo.Nombre}: ${productoInfo.Precio_Venta}`);
        }

        const subtotal = precioUnitario * item.Cantidad;
        montoTotalCalculado += subtotal;

        console.log(`💰 Cálculo: $${precioUnitario} x ${item.Cantidad} = $${subtotal}`);

        // Agregar producto detallado
        productosDetalladosParaTransaccion.push({
          ID_Producto: item.ID_Producto,
          Codigo: productoInfo.Codigo || '',
          Nombre: productoInfo.Nombre,
          Descripcion: productoInfo.Descripcion || '',
          Precio_Unitario: precioUnitario,
          Cantidad: item.Cantidad,
          Subtotal: subtotal,
          Stock_Disponible: stockTotal,
          Stock_Por_Sucursal: inventariosProducto.map(inv => ({
            id_inventario: inv.ID_Inventario,
            sucursal: inv.ID_Sucursal,
            stock_actual: inv.Stock_Actual,
            stock_reservado: inv.Stock_Reservado || 0,
            stock_disponible: (inv.Stock_Actual || 0) - (inv.Stock_Reservado || 0)
          }))
        });

        console.log(`✅ Producto validado exitosamente: ${productoInfo.Nombre}`);

      } catch (apiError) {
        console.error(`❌ Error consultando producto ${item.ID_Producto}:`, {
          message: apiError.message,
          status: apiError.response?.status,
          url: apiError.config?.url,
          data: apiError.response?.data
        });
        
        throw new Error(`Error consultando producto ID ${item.ID_Producto}: ${apiError.message}`);
      }
    }

    // Verificar monto total
    if (montoTotalCalculado <= 0) {
      throw new Error('El monto total debe ser mayor a cero');
    }

    console.log(`💰 Monto total calculado: $${montoTotalCalculado.toLocaleString()}`);

    // Generar orden de compra única
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9).toUpperCase();
    const ordenCompra = `FERREMAS-${timestamp}-${randomSuffix}`;

    console.log(`📋 Orden de compra generada: ${ordenCompra}`);

    // ✅ CREAR TRANSACCIÓN EN BASE DE DATOS
    console.log('💾 Creando transacción en base de datos...');
    
    const transaccion = await Transaccion.create({
      clienteId: parseInt(clienteId),
      ordenCompra,
      monto: montoTotalCalculado,
      token: crypto.randomBytes(32).toString('hex'),
      estadoTexto: 'PENDIENTE',
      detalles: productosDetalladosParaTransaccion
    });

    console.log(`✅ Transacción creada con ID: ${transaccion.id}`);

    // ✅ GENERAR DATOS WEBPAY (SIMULADO)
    const webpayData = {
      token: transaccion.token,
      url: `http://localhost:3003/api/transbank/webpay/pagar?token=${transaccion.token}`,
      transaccion_id: transaccion.id,
      monto_total: montoTotalCalculado,
      orden_compra: ordenCompra
    };

    // ✅ REGISTRAR LOG DE ÉXITO
    await TransbankLog.create({
      ID_Transaccion: transaccion.id,
      Accion: 'CREAR_TRANSACCION_WEBPAY',
      Descripcion: 'Transacción WebPay iniciada exitosamente',
      Datos_Entrada: JSON.stringify(data),
      Datos_Salida: JSON.stringify(webpayData),
      Codigo_Respuesta: '201',
      Duracion_MS: Date.now() - startTime
    });

    console.log('🎉 Transacción WebPay creada exitosamente');

    return {
      transaccion,
      webpay: webpayData
    };

  } catch (error) {
    console.error('❌ Error en crearTransaccionWebPay:', {
      message: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
    // Registrar log de error
    try {
      await TransbankLog.create({
        ID_Transaccion: null,
        Accion: 'ERROR_CREAR_TRANSACCION_WEBPAY',
        Descripcion: 'Error al iniciar transacción WebPay',
        Datos_Entrada: JSON.stringify(data),
        Codigo_Respuesta: '500',
        Mensaje_Error: error.message,
        Duracion_MS: Date.now() - startTime
      });
    } catch (logError) {
      console.error('❌ Error creando log de error:', logError.message);
    }

    throw error;
  }
}

// ============================================
// CONFIRMAR TRANSACCIÓN
// ============================================
async function confirmarTransaccion(idTransaccion, webpayData = null) {
  const startTime = Date.now();
  
  try {
    console.log(`✅ [confirmarTransaccion] Confirmando transacción ID: ${idTransaccion}`);

    // Buscar transacción
    const transaccion = await Transaccion.findByPk(idTransaccion);
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (transaccion.estadoTexto !== 'PENDIENTE') {
      throw new Error(`Transacción ya está en estado: ${transaccion.estadoTexto}`);
    }

    console.log(`📋 Transacción encontrada: ${transaccion.ordenCompra} por $${transaccion.monto}`);

    // Actualizar estado de la transacción
    transaccion.estadoTexto = 'APROBADO';
    await transaccion.save();

    console.log('💳 Transacción marcada como APROBADO');

    // ✅ ACTUALIZAR INVENTARIO (DESCONTAR STOCK)
    let inventarioActualizado = false;
    const productosActualizados = [];

    if (transaccion.detalles && Array.isArray(transaccion.detalles)) {
      try {
        console.log('📦 Iniciando actualización de inventario...');
        
        for (const producto of transaccion.detalles) {
          if (producto.ID_Producto && producto.Cantidad) {
            try {
              console.log(`🔄 Actualizando stock para: ${producto.Nombre} (${producto.Cantidad} unidades)`);
              
              // Realizar movimiento de salida en inventario
              const movimientoData = {
                Tipo_Movimiento: 'Salida',
                Cantidad: parseInt(producto.Cantidad),
                ID_Bodeguero: 1,
                Comentario: `Venta WebPay - Orden ${transaccion.ordenCompra} - ${producto.Nombre}`
              };

              const urlMovimiento = `${INVENTORY_API}/inventario/${producto.ID_Producto}/movimiento`;
              console.log(`🌐 Registrando movimiento en: ${urlMovimiento}`);

              const movimientoResponse = await axios.post(
                urlMovimiento,
                movimientoData,
                { 
                  timeout: 10000,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );

              console.log(`✅ Stock actualizado para ${producto.Nombre}: -${producto.Cantidad} unidades`);
              
              productosActualizados.push({
                id_producto: producto.ID_Producto,
                nombre: producto.Nombre,
                cantidad_descontada: producto.Cantidad,
                resultado: 'EXITOSO',
                response: movimientoResponse.data
              });

            } catch (inventarioError) {
              console.warn(`⚠️ Error actualizando stock para producto ${producto.ID_Producto}:`, {
                message: inventarioError.message,
                status: inventarioError.response?.status,
                data: inventarioError.response?.data
              });
              
              productosActualizados.push({
                id_producto: producto.ID_Producto,
                nombre: producto.Nombre,
                cantidad_descontada: producto.Cantidad,
                resultado: 'ERROR',
                error: inventarioError.message
              });
            }
          }
        }

        inventarioActualizado = productosActualizados.some(p => p.resultado === 'EXITOSO');
        console.log(`📊 Actualización de inventario: ${inventarioActualizado ? 'EXITOSA' : 'FALLÓ'}`);

      } catch (error) {
        console.warn('⚠️ Error general actualizando inventario:', error.message);
      }
    }

    // ✅ REGISTRAR LOG DE CONFIRMACIÓN
    await TransbankLog.create({
      ID_Transaccion: transaccion.id,
      Accion: 'CONFIRMAR_TRANSACCION',
      Descripcion: 'Transacción confirmada exitosamente',
      Datos_Entrada: JSON.stringify({ idTransaccion, webpayData }),
      Datos_Salida: JSON.stringify({ 
        transaccion: {
          id: transaccion.id,
          ordenCompra: transaccion.ordenCompra,
          monto: transaccion.monto,
          estado: transaccion.estadoTexto
        },
        inventario_actualizado: inventarioActualizado,
        productos_actualizados: productosActualizados
      }),
      Codigo_Respuesta: '200',
      Duracion_MS: Date.now() - startTime
    });

    return {
      transaccion,
      inventario_actualizado: inventarioActualizado,
      productos_actualizados: productosActualizados,
      webpay: webpayData,
      mensaje: 'Transacción confirmada exitosamente. Pedido en estado "por despachar".'
    };

  } catch (error) {
    console.error('❌ Error en confirmarTransaccion:', error);

    // Intentar revertir estado si algo falló
    try {
      const transaccion = await Transaccion.findByPk(idTransaccion);
      if (transaccion && transaccion.estadoTexto === 'APROBADO') {
        transaccion.estadoTexto = 'RECHAZADO';
        await transaccion.save();
        console.log('⚠️ Estado revertido a RECHAZADO por error');
      }
    } catch (revertError) {
      console.error('❌ Error revirtiendo estado:', revertError);
    }

    // Registrar log de error
    try {
      await TransbankLog.create({
        ID_Transaccion: idTransaccion,
        Accion: 'ERROR_CONFIRMAR_TRANSACCION',
        Descripcion: 'Error al confirmar transacción',
        Datos_Entrada: JSON.stringify({ idTransaccion, webpayData }),
        Codigo_Respuesta: '500',
        Mensaje_Error: error.message,
        Duracion_MS: Date.now() - startTime
      });
    } catch (logError) {
      console.error('❌ Error creando log de error:', logError.message);
    }

    throw error;
  }
}

// ============================================
// OBTENER PEDIDOS POR DESPACHAR
// ============================================
async function obtenerPedidosPorDespachar(filtros = {}) {
  try {
    console.log('📋 [obtenerPedidosPorDespachar] Consultando pedidos...');

    const whereClause = { estadoTexto: 'APROBADO' };

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
      order: [['createdAt', 'DESC']],
      limit: filtros.limit || 50
    });

    const pedidosEnriquecidos = transacciones.map(tx => ({
      transaccion_id: tx.id,
      orden_compra: tx.ordenCompra,
      cliente_id: tx.clienteId,
      monto_total: parseFloat(tx.monto),
      fecha_creacion: tx.createdAt,
      estado: 'POR_DESPACHAR',
      productos: tx.detalles || [],
      token: tx.token
    }));

    console.log(`📦 Encontrados ${pedidosEnriquecidos.length} pedidos por despachar`);
    return pedidosEnriquecidos;

  } catch (error) {
    console.error('❌ Error obteniendo pedidos por despachar:', error);
    throw error;
  }
}

// ============================================
// OBTENER HISTORIAL DE COMPRAS
// ============================================
async function obtenerHistorialCompras(clienteId) {
  try {
    console.log(`📊 [obtenerHistorialCompras] Cliente ID: ${clienteId}`);

    const transacciones = await Transaccion.findAll({
      where: { 
        clienteId,
        estadoTexto: { 
          [require('sequelize').Op.in]: ['APROBADO', 'PENDIENTE', 'RECHAZADO']
        }
      },
      order: [['createdAt', 'DESC']]
    });

    const historialCompleto = transacciones.map(tx => ({
      transaccion: {
        id: tx.id,
        orden_compra: tx.ordenCompra,
        monto: parseFloat(tx.monto),
        fecha: tx.createdAt,
        estado: tx.estadoTexto
      },
      productos: tx.detalles || [],
      token: tx.token
    }));

    console.log(`📋 Historial: ${historialCompleto.length} transacciones para cliente ${clienteId}`);
    return historialCompleto;

  } catch (error) {
    console.error('❌ Error obteniendo historial de compras:', error);
    throw error;
  }
}

// ============================================
// VERIFICAR CONEXIONES EXTERNAS
// ============================================
async function verificarConexiones() {
  const resultados = {
    inventario: false,
    banco: false,
    webpay: true, // Simulado
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Verificando conexiones externas...');

  // Test API Inventario
  try {
    const urlInventario = `${INVENTORY_API}/productos`;
    console.log(`🌐 Probando API Inventario: ${urlInventario}`);
    
    const inventarioResp = await axios.get(urlInventario, { timeout: 5000 });
    resultados.inventario = inventarioResp.status === 200;
    console.log(`✅ API Inventario: ${resultados.inventario ? 'CONECTADA' : 'DESCONECTADA'}`);
    
  } catch (error) {
    console.warn('⚠️ API Inventario no disponible:', error.message);
    resultados.inventario = false;
  }

  // Test API Banco
  try {
    const urlBanco = `${BANK_API}/`;
    console.log(`🌐 Probando API Banco: ${urlBanco}`);
    
    const bancoResp = await axios.get(urlBanco, { timeout: 5000 });
    resultados.banco = bancoResp.status === 200;
    console.log(`✅ API Banco: ${resultados.banco ? 'CONECTADA' : 'DESCONECTADA'}`);
    
  } catch (error) {
    console.warn('⚠️ API Banco no disponible:', error.message);
    resultados.banco = false;
  }

  console.log('📊 Resultado verificación conexiones:', resultados);
  return resultados;
}

// ============================================
// ANULAR TRANSACCIÓN
// ============================================
async function anularTransaccion(idTransaccion, motivo) {
  try {
    console.log(`🔴 [anularTransaccion] ID: ${idTransaccion}, Motivo: ${motivo}`);

    const transaccion = await Transaccion.findByPk(idTransaccion);
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (['CANCELADO', 'REEMBOLSADO'].includes(transaccion.estadoTexto)) {
      throw new Error(`La transacción ya está ${transaccion.estadoTexto.toLowerCase()}`);
    }

    const estadoAnterior = transaccion.estadoTexto;
    transaccion.estadoTexto = 'REEMBOLSADO';
    await transaccion.save();

    // Registrar log de anulación
    await TransbankLog.create({
      ID_Transaccion: transaccion.id,
      Accion: 'ANULAR_TRANSACCION',
      Descripcion: 'Transacción anulada',
      Datos_Entrada: JSON.stringify({ idTransaccion, motivo, estadoAnterior }),
      Datos_Salida: JSON.stringify({
        id: transaccion.id,
        orden_compra: transaccion.ordenCompra,
        estado_nuevo: transaccion.estadoTexto
      }),
      Codigo_Respuesta: '200'
    });

    console.log(`✅ Transacción ${idTransaccion} anulada exitosamente`);

    return {
      transaccion,
      estado_anterior: estadoAnterior,
      motivo_anulacion: motivo,
      fecha_anulacion: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error anulando transacción:', error);
    throw error;
  }
}

// ============================================
// BUSCAR TRANSACCIÓN POR TOKEN
// ============================================
async function buscarTransaccionPorToken(token) {
  try {
    console.log(`🔍 [buscarTransaccionPorToken] Token: ${token.substring(0, 10)}...`);
    
    const transaccion = await Transaccion.findOne({ where: { token } });
    
    if (transaccion) {
      console.log(`✅ Transacción encontrada: ID ${transaccion.id}, Orden ${transaccion.ordenCompra}`);
    } else {
      console.log('❌ No se encontró transacción con ese token');
    }
    
    return transaccion;
    
  } catch (error) {
    console.error('❌ Error buscando transacción por token:', error);
    throw error;
  }
}

// ============================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================
module.exports = {
  crearTransaccionWebPay,
  confirmarTransaccion,
  obtenerPedidosPorDespachar,
  obtenerHistorialCompras,
  verificarConexiones,
  anularTransaccion,
  buscarTransaccionPorToken
};