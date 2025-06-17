const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Transaccion = sequelize.define('transbank_transacciones', {
  id_transaccion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  metodo_pago: { type: DataTypes.STRING, allowNull: false },
  estado_id: { type: DataTypes.INTEGER },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Transaccion;