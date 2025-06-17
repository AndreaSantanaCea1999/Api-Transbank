const axios = require('axios');
const { Transaccion, Logs, EstadoTransaccion } = require('../models');

const INVENTORY_API = process.env.INVENTORY_API_URL; // http://localhost:3000/api
const BANK_API = process.env.BANK_API_URL; // http://localhost:3001/api/v1

async function crearTransaccion(data) {
  try {
    console.log('🟢 [crearTransaccion] Datos recibidos:', data);

    // 1️⃣ Verificar stock antes de crear transacción
    if (data.detalles && data.detalles.length > 0) {
      for (const item of data.detalles) {
        const stockResponse = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);
        
        if (!stockResponse.data || stockResponse.data.Stock_Actual < item.Cantidad) {
          throw new Error(`Stock insuficiente para producto ${item.ID_Producto}. Disponible: ${stockResponse.data?.Stock_Actual || 0}, Requerido: ${item.Cantidad}`);
        }
      }
      console.log('✅ Verificación de stock completada');
    }

    // 2️⃣ Obtener estado "Pendiente"
    const estadoPendiente = await EstadoTransaccion.findOne({ where: { nombre: 'Pendiente' } });
    if (!estadoPendiente) throw new Error('Estado "Pendiente" no encontrado en la base de datos');

    // 3️⃣ Crear transacción
    const tx = await Transaccion.create({
      clienteId: data.clienteId,
      ordenCompra: data.ordenCompra,
      monto: data.monto,
      divisa: data.divisa,
      estadoId: estadoPendiente.id,
      detalles: data.detalles
    });

    // 4️⃣ Registrar log
    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'CREAR_TRANSACCION',
      Descripcion: 'Transacción creada localmente después de verificar stock',
      Datos_Entrada: JSON.stringify(data),
      Datos_Salida: JSON.stringify(tx),
      Codigo_Respuesta: '201',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    console.log('✅ Transacción creada con ID:', tx.id);
    return tx;

  } catch (error) {
    console.error('❌ Error en crearTransaccion:', error.message);

    await Logs.create({
      ID_Transaccion: null,
      Accion: 'ERROR_CREAR_TRANSACCION',
      Descripcion: 'Fallo al crear transacción',
      Datos_Entrada: JSON.stringify(data),
      Datos_Salida: null,
      Codigo_Respuesta: '500',
      Mensaje_Error: error.message,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    throw error;
  }
}

async function confirmarTransaccion(id_transaccion) {
  try {
    console.log('🟢 [confirmarTransaccion] ID:', id_transaccion);

    // 1️⃣ Buscar transacción
    const tx = await Transaccion.findByPk(id_transaccion);
    if (!tx) throw new Error('Transacción no existe');

    // 2️⃣ Actualizar estado local a "Aprobado"
    const estadoAprobado = await EstadoTransaccion.findOne({ where: { nombre: 'Aprobado' } });
    if (!estadoAprobado) throw new Error('Estado "Aprobado" no encontrado');

    tx.estadoId = estadoAprobado.id;
    await tx.save();

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'CONFIRMAR_TRANSACCION_LOCAL',
      Descripcion: 'Estado actualizado a Aprobado',
      Datos_Entrada: JSON.stringify({ id_transaccion }),
      Datos_Salida: JSON.stringify(tx),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    // 3️⃣ Registrar pago en API Banco
    console.log('💳 Registrando pago en API Banco...');
    const pagoData = {
      clienteId: tx.clienteId,
      ordenId: tx.ordenCompra,
      monto: parseFloat(tx.monto),
      divisa: tx.divisa,
      metodo_pago: 'TRANSBANK',
      estado: 'APROBADO'
    };

    const pagoResp = await axios.post(`${BANK_API}/pagos`, pagoData, {
      timeout: 10000, // 10 segundos timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Transbank-FERREMAS/1.0'
      }
    });

    if (!pagoResp.data.success && !pagoResp.data.mensaje) {
      throw new Error(`Banco API: ${pagoResp.data.message || 'Error al registrar pago'}`);
    }

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'REGISTRAR_PAGO_BANCO',
      Descripcion: 'Pago registrado en API Banco',
      Datos_Entrada: JSON.stringify(pagoData),
      Datos_Salida: JSON.stringify(pagoResp.data),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    // 4️⃣ Crear pedido en API Inventario
    console.log('📦 Creando pedido en API Inventario...');
    const pedidoData = {
      ID_Cliente: tx.clienteId,
      Total: parseFloat(tx.monto),
      Estado: 'CONFIRMADO',
      Comentarios: `Pedido generado desde transacción ${tx.id} - Orden: ${tx.ordenCompra}`,
      detalles: tx.detalles || []
    };

    // Intentar crear pedido - si no existe el endpoint, crear movimientos directamente
    let pedidoResp;
    try {
      pedidoResp = await axios.post(`${INVENTORY_API}/pedidos`, pedidoData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'API-Transbank-FERREMAS/1.0'
        }
      });
    } catch (pedidoError) {
      if (pedidoError.response && pedidoError.response.status === 404) {
        console.log('⚠️ Endpoint /pedidos no existe, creando movimientos directamente...');
        pedidoResp = await crearMovimientosStock(tx);
      } else {
        throw pedidoError;
      }
    }

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'CREAR_PEDIDO_INVENTARIO',
      Descripcion: 'Pedido/Movimientos creados en API Inventario',
      Datos_Entrada: JSON.stringify(pedidoData),
      Datos_Salida: JSON.stringify(pedidoResp.data),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    console.log('✅ Transacción confirmada exitosamente');
    return {
      transaccion: tx,
      pago: pagoResp.data,
      pedido: pedidoResp.data
    };

  } catch (error) {
    console.error('❌ Error en confirmarTransaccion:', error.message);

    // Revertir estado si es necesario
    try {
      const tx = await Transaccion.findByPk(id_transaccion);
      if (tx) {
        const estadoRechazado = await EstadoTransaccion.findOne({ where: { nombre: 'Rechazado' } });
        if (estadoRechazado) {
          tx.estadoId = estadoRechazado.id;
          await tx.save();
        }
      }
    } catch (revertError) {
      console.error('Error al revertir estado:', revertError.message);
    }

    await Logs.create({
      ID_Transaccion: id_transaccion,
      Accion: 'ERROR_CONFIRMAR_TRANSACCION',
      Descripcion: 'Fallo al confirmar transacción',
      Datos_Entrada: JSON.stringify({ id_transaccion }),
      Datos_Salida: null,
      Codigo_Respuesta: '500',
      Mensaje_Error: error.message,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    throw error;
  }
}

// Función auxiliar para crear movimientos de stock cuando no existe endpoint /pedidos
async function crearMovimientosStock(transaccion) {
  const movimientos = [];
  
  if (transaccion.detalles && transaccion.detalles.length > 0) {
    for (const item of transaccion.detalles) {
      try {
        // Obtener inventario del producto
        const inventarioResp = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);
        
        if (inventarioResp.data && inventarioResp.data.ID_Inventario) {
          // Crear movimiento de salida (venta)
          const movimientoData = {
            ID_Inventario: inventarioResp.data.ID_Inventario,
            Tipo_Movimiento: 'SALIDA',
            Cantidad: -Math.abs(item.Cantidad), // Negativo para salida
            Precio_Unitario: item.Precio_Unitario || 0,
            Comentarios: `Venta - Transacción ${transaccion.id} - Orden ${transaccion.ordenCompra}`
          };

          const movimientoResp = await axios.post(`${INVENTORY_API}/movimientos`, movimientoData);
          movimientos.push(movimientoResp.data);
        }
      } catch (movError) {
        console.error(`Error creando movimiento para producto ${item.ID_Producto}:`, movError.message);
      }
    }
  }

  return { data: { movimientos, mensaje: 'Movimientos de stock creados exitosamente' } };
}

async function registrarDetalle(id_transaccion, detalles) {
  try {
    console.log('🟢 [registrarDetalle] ID:', id_transaccion, 'Detalles:', detalles);

    const tx = await Transaccion.findByPk(id_transaccion);
    if (!tx) throw new Error('Transacción no encontrada');

    // Verificar stock para los nuevos detalles
    if (detalles && detalles.length > 0) {
      for (const item of detalles) {
        const stockResponse = await axios.get(`${INVENTORY_API}/inventario/producto/${item.ID_Producto}`);
        
        if (!stockResponse.data || stockResponse.data.Stock_Actual < item.Cantidad) {
          throw new Error(`Stock insuficiente para producto ${item.ID_Producto}`);
        }
      }
    }

    tx.detalles = detalles;
    await tx.save();

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'REGISTRAR_DETALLE',
      Descripcion: 'Detalles registrados en transacción después de verificar stock',
      Datos_Entrada: JSON.stringify({ id_transaccion, detalles }),
      Datos_Salida: JSON.stringify(tx),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    console.log('✅ Detalles registrados exitosamente');

  } catch (error) {
    console.error('❌ Error en registrarDetalle:', error.message);

    await Logs.create({
      ID_Transaccion: id_transaccion,
      Accion: 'ERROR_REGISTRAR_DETALLE',
      Descripcion: 'Fallo al registrar detalles',
      Datos_Entrada: JSON.stringify({ id_transaccion, detalles }),
      Datos_Salida: null,
      Codigo_Respuesta: '500',
      Mensaje_Error: error.message,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    throw error;
  }
}

// Función para verificar salud de las APIs externas
async function verificarConexiones() {
  const resultados = {
    inventario: false,
    banco: false,
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

module.exports = {
  crearTransaccion,
  confirmarTransaccion,
  registrarDetalle,
  verificarConexiones
};