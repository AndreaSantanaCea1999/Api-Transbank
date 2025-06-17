const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const WebpayTransaccion = sequelize.define('webpay_transacciones', {
  id_webpay: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_transaccion: { type: DataTypes.INTEGER },
  token: { type: DataTypes.STRING },
  respuesta: { type: DataTypes.STRING },
});

module.exports = WebpayTransaccion;