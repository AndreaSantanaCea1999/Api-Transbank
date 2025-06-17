const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WebPayTransacciones = sequelize.define('webpay_transacciones', {
  ID_Transaccion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ID_Pago: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Token: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  Orden_Compra: {
    type: DataTypes.STRING(26),
    allowNull: false
  },
  Monto_Transaccion: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  URL_Redireccion: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  Estado_Transaccion: {
    type: DataTypes.STRING(20),
    defaultValue: 'INICIADA',
    validate: {
      isIn: [['INICIADA', 'AUTORIZADA', 'RECHAZADA', 'ANULADA', 'CANCELADA']]
    }
  },
  Codigo_Respuesta: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  Codigo_Autorizacion: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  Tipo_Tarjeta: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  Ultimos_4_Digitos: {
    type: DataTypes.STRING(4),
    allowNull: true
  },
  Fecha_Transaccion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Fecha_Contable: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Cuotas: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  Respuesta_Raw: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'webpay_transacciones',
  timestamps: false
});

module.exports = WebPayTransacciones;