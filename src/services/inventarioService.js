const inventarioAxios = axios.create({
  baseURL: process.env.API_INVENTARIO_URL,
  timeout: parseInt(process.env.API_TIMEOUT_MS) || 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_INVENTARIO_KEY
  }
});

class InventarioService {
  /**
   * Verificar stock disponible
   */
  async verificarStock(idProducto, cantidad, idSucursal = 1) {
    try {
      const response = await inventarioAxios.get(
        `/inventario/producto/${idProducto}/sucursal/${idSucursal}`
      );

      const stockActual = response.data.Stock_Actual || 0;
      const stockReservado = response.data.Stock_Reservado || 0;
      const stockDisponible = stockActual - stockReservado;

      return {
        disponible: stockDisponible >= cantidad,
        stock: stockDisponible,
        stockTotal: stockActual,
        stockReservado: stockReservado
      };

    } catch (error) {
      logger.error('Error al verificar stock:', {
        error: error.message,
        idProducto,
        cantidad,
        idSucursal
      });

      // En caso de error, permitir continuar (modo degradado)
      return {
        disponible: true,
        stock: cantidad,
        error: true,
        message: 'API de inventario no disponible'
      };
    }
  }

  /**
   * Descontar stock después de una venta exitosa
   */
  async descontarStock(idProducto, cantidad, idSucursal = 1) {
    try {
      const response = await inventarioAxios.post('/movimientos-inventario', {
        ID_Producto: idProducto,
        ID_Sucursal: idSucursal,
        Tipo_Movimiento: 'Salida',
        Cantidad: cantidad,
        Comentario: 'Venta procesada por Transbank WebPay'
      });

      logger.info('Stock descontado exitosamente', {
        idProducto,
        cantidad,
        idSucursal
      });

      return response.data;

    } catch (error) {
      logger.error('Error al descontar stock:', {
        error: error.message,
        idProducto,
        cantidad,
        idSucursal
      });

      // No lanzar error para no afectar la transacción principal
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reponer stock en caso de devolución
   */
  async reponerStock(idProducto, cantidad, idSucursal = 1) {
    try {
      const response = await inventarioAxios.post('/movimientos-inventario', {
        ID_Producto: idProducto,
        ID_Sucursal: idSucursal,
        Tipo_Movimiento: 'Entrada',
        Cantidad: cantidad,
        Comentario: 'Devolución procesada desde Transbank'
      });

      return response.data;

    } catch (error) {
      logger.error('Error al reponer stock:', {
        error: error.message,
        idProducto,
        cantidad
      });
      throw error;
    }
  }

  /**
   * Obtener información de un producto
   */
  async obtenerProducto(idProducto) {
    try {
      const response = await inventarioAxios.get(`/productos/${idProducto}`);
      return response.data;
    } catch (error) {
      logger.error('Error al obtener producto:', {
        error: error.message,
        idProducto
      });
      return null;
    }
  }
}

module.exports = new InventarioService();

// ===============================================
// src/services/bancoService.js - Integración con API de Banco
// ===============================================
const bancoAxios = axios.create({
  baseURL: process.env.API_BANCO_URL,
  timeout: parseInt(process.env.API_TIMEOUT_MS) || 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_BANCO_KEY
  }
});

class BancoService {
  /**
   * Registrar un pago exitoso
   */
  async registrarPago(datosPago) {
    try {
      const response = await bancoAxios.post('/pagos', {
        ID_Pedido: datosPago.idPedido,
        Metodo_Pago: datosPago.metodoPago || 'Crédito',
        Procesador_Pago: datosPago.procesadorPago || 'Transbank WebPay',
        Numero_Transaccion: datosPago.numeroTransaccion,
        Monto: datosPago.monto,
        ID_Divisa: 1, // CLP por defecto
        Estado: 'Completado',
        Observaciones: `Pago procesado por Transbank. Código autorización: ${datosPago.codigoAutorizacion}`
      });

      logger.info('Pago registrado en API de banco', {
        idPedido: datosPago.idPedido,
        monto: datosPago.monto,
        numeroTransaccion: datosPago.numeroTransaccion
      });

      return response.data;

    } catch (error) {
      logger.error('Error al registrar pago:', {
        error: error.message,
        datosPago
      });

      // No lanzar error para no afectar transacción principal
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar estado de un pedido
   */
  async actualizarEstadoPedido(idPedido, nuevoEstado) {
    try {
      const response = await bancoAxios.patch(`/pedidos/${idPedido}/estado`, {
        estado: nuevoEstado
      });

      return response.data;

    } catch (error) {
      logger.error('Error al actualizar estado del pedido:', {
        error: error.message,
        idPedido,
        nuevoEstado
      });
      return null;
    }
  }

  /**
   * Obtener información de un pedido
   */
  async obtenerPedido(idPedido) {
    try {
      const response = await bancoAxios.get(`/pedidos/${idPedido}`);
      return response.data;
    } catch (error) {
      logger.error('Error al obtener pedido:', {
        error: error.message,
        idPedido
      });
      return null;
    }
  }
}

module.exports = new BancoService();