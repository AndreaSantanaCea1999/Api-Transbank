const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const EstadoTransaccion = sequelize.define('transbank_estados_transaccion', {
  estado_id: { type: DataTypes.INTEGER, primaryKey: true },
  descripcion: { type: DataTypes.STRING }
});

module.exports = EstadoTransaccion;