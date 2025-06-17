
// === src/models/Cuotas.js ===
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Cuotas = sequelize.define('transbank_cuotas', {
  id_cuota: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_transaccion: { type: DataTypes.INTEGER },
  cantidad_cuotas: { type: DataTypes.INTEGER },
});

module.exports = Cuotas;