// src/models/TransbankDetalleTransacciones.js

const { sequelize } = require('../config/database');  // Ajusta la ruta si es necesario
const { DataTypes } = require('sequelize');

const TransbankDetalleTransacciones = sequelize.define('transbank_detalle_transacciones', {
  ID_Detalle: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ID_Transaccion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transbank_transacciones',
      key: 'ID_Transaccion'
    }
  },
  ID_Producto: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'productos',
      key: 'ID_Producto'
    }
  },
  Cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  Precio_Unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true
    }
  },
  Subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true
    }
  },
  Descripcion: {
    type: DataTypes.STRING(200),
    allowNull: true
  }
}, {
  tableName: 'transbank_detalle_transacciones',
  timestamps: false,
  indexes: [
    {
      fields: ['ID_Transaccion']
    },
    {
      fields: ['ID_Producto']
    }
  ]
});

module.exports = TransbankDetalleTransacciones;
