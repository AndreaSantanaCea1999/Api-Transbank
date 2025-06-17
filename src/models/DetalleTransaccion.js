const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const DetalleTransaccion = sequelize.define('transbank_detalles_transaccion', {
  id_detalle: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_transaccion: { type: DataTypes.INTEGER },
  producto: { type: DataTypes.STRING },
  cantidad: { type: DataTypes.INTEGER },
  precio_unitario: { type: DataTypes.FLOAT },
});

module.exports = DetalleTransaccion;