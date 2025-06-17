// Importar nuevos modelos
const Pagos = require('./pagos');
const WebPayTransacciones = require('./webpayTransacciones');

// Relaciones para pagos
Pedidos.hasMany(Pagos, {
  foreignKey: 'ID_Pedido',
  as: 'pagos'
});
Pagos.belongsTo(Pedidos, {
  foreignKey: 'ID_Pedido',
  as: 'pedido'
});

// Relaciones para transacciones WebPay
Pagos.hasMany(WebPayTransacciones, {
  foreignKey: 'ID_Pago',
  as: 'transaccionesWebpay'
});
WebPayTransacciones.belongsTo(Pagos, {
  foreignKey: 'ID_Pago',
  as: 'pago'
});

// Exportar nuevos modelos (agregar a la exportación existente)
module.exports = {
  sequelize,
  
  // Modelos existentes
  Productos,
  Inventario,
  MovimientosInventario,
  Categorias,
  Marcas,
  Proveedores,
  Usuario,
  Pedidos,
  DetallesPedido,
  Sucursales,
  
  // Nuevos modelos
  Pagos,
  WebPayTransacciones
};