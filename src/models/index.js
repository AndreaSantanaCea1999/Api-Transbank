const sequelize = require('../database');
const Transaccion = require('./Transaccion');
const DetalleTransaccion = require('./DetalleTransaccion');
const EstadoTransaccion = require('./EstadoTransaccion');
const Cuotas = require('./Cuotas');
const WebpayTransaccion = require('./WebpayTransaccion');
const Logs = require('./Logs');

Transaccion.hasMany(DetalleTransaccion, { foreignKey: 'id_transaccion' });
DetalleTransaccion.belongsTo(Transaccion, { foreignKey: 'id_transaccion' });

Transaccion.belongsTo(EstadoTransaccion, { foreignKey: 'estado_id' });
EstadoTransaccion.hasMany(Transaccion, { foreignKey: 'estado_id' });

Transaccion.hasOne(Cuotas, { foreignKey: 'id_transaccion' });
Cuotas.belongsTo(Transaccion, { foreignKey: 'id_transaccion' });

Transaccion.hasOne(WebpayTransaccion, { foreignKey: 'id_transaccion' });
WebpayTransaccion.belongsTo(Transaccion, { foreignKey: 'id_transaccion' });

module.exports = {
  sequelize,
  Transaccion,
  DetalleTransaccion,
  EstadoTransaccion,
  Cuotas,
  WebpayTransaccion,
  Logs,
};