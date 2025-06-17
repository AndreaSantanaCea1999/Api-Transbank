const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Logs = sequelize.define('transbank_logs', {
  id_log: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  mensaje: { type: DataTypes.STRING },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Logs;
