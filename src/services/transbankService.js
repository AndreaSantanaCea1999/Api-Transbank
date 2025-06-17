const axios = require('axios');
const { Transaccion, Logs, EstadoTransaccion } = require('../models');

const INVENTORY_API = process.env.INVENTORY_API_URL;
const BANK_API = process.env.BANK_API_URL;

async function crearTransaccion(data) {
  try {
    console.log('🟢 [crearTransaccion] Datos recibidos:', data);

    // 1️⃣ Obtener estado “Pendiente”
    const estadoPendiente = await EstadoTransaccion.findOne({ where: { nombre: 'Pendiente' } });
    if (!estadoPendiente) throw new Error('Estado "Pendiente" no encontrado');

    // 2️⃣ Crear transacción
    const tx = await Transaccion.create({
      clienteId: data.clienteId,
      ordenCompra: data.ordenCompra,
      monto: data.monto,
      divisa: data.divisa,
      estadoId: estadoPendiente.id,
      detalles: data.detalles
    });

    // 3️⃣ Registrar log
    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'CREAR_TRANSACCION',
      Descripcion: 'Transacción creada localmente',
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

    // 2️⃣ Actualizar estado
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

    // 3️⃣ Llamar API Banco
    const pagoResp = await axios.post(`${BANK_API}/payments`, {
      clienteId: tx.clienteId,
      ordenId: tx.ordenCompra,
      monto: tx.monto,
      divisa: tx.divisa
    });

    if (!pagoResp.data.success) {
      throw new Error(`Banco: ${pagoResp.data.message || 'Error al registrar pago'}`);
    }

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'REGISTRAR_PAGO_BANCO',
      Descripcion: 'Pago registrado en microservicio Banco',
      Datos_Entrada: JSON.stringify({
        clienteId: tx.clienteId,
        ordenId: tx.ordenCompra,
        monto: tx.monto,
        divisa: tx.divisa
      }),
      Datos_Salida: JSON.stringify(pagoResp.data),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    // 4️⃣ Llamar API Inventario
    const pedidoResp = await axios.post(`${INVENTORY_API}/pedidos`, {
      clienteId: tx.clienteId,
      items: tx.detalles,
      total: tx.monto
    });

    if (!pedidoResp.data.success) {
      throw new Error(`Inventario: ${pedidoResp.data.message || 'Error al crear pedido'}`);
    }

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'CREAR_PEDIDO_INVENTARIO',
      Descripcion: 'Pedido creado en microservicio Inventario',
      Datos_Entrada: JSON.stringify({
        clienteId: tx.clienteId,
        items: tx.detalles,
        total: tx.monto
      }),
      Datos_Salida: JSON.stringify(pedidoResp.data),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });

    console.log('✅ Transacción confirmada');
    return {
      transaccion: tx,
      pago: pagoResp.data,
      pedido: pedidoResp.data
    };

  } catch (error) {
    console.error('❌ Error en confirmarTransaccion:', error.message);

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

async function registrarDetalle(id_transaccion, detalles) {
  try {
    const tx = await Transaccion.findByPk(id_transaccion);
    if (!tx) throw new Error('Transacción no encontrada');

    tx.detalles = detalles;
    await tx.save();

    await Logs.create({
      ID_Transaccion: tx.id,
      Accion: 'REGISTRAR_DETALLE',
      Descripcion: 'Detalles registrados en transacción',
      Datos_Entrada: JSON.stringify({ id_transaccion, detalles }),
      Datos_Salida: JSON.stringify(tx),
      Codigo_Respuesta: '200',
      Mensaje_Error: null,
      IP_Origen: null,
      User_Agent: null,
      Duracion_MS: null
    });
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

module.exports = {
  crearTransaccion,
  confirmarTransaccion,
  registrarDetalle
};
