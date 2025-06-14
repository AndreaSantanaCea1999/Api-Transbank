// src/models/TransbankEstadosTransaccion.js

const { sequelize } = require('../config/database'); // Importa la instancia de Sequelize
const { DataTypes } = require('sequelize');           // Importa DataTypes

const TransbankEstadosTransaccion = sequelize.define('transbank_estados_transaccion', {
  ID_Estado: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  Codigo_Estado: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 10]
    }
  },
  Nombre_Estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },
  Descripcion: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  Es_Final: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  Es_Exitoso: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'transbank_estados_transaccion',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['Codigo_Estado']
    }
  ]
});

module.exports = TransbankEstadosTransaccion;
