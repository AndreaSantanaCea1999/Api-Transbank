// src/models/TransbankTransacciones.js

const { sequelize } = require('../config/database'); // Instancia de Sequelize
const { DataTypes } = require('sequelize');           // Tipos de datos

const TransbankTransacciones = sequelize.define('transbank_transacciones', {
  ID_Transaccion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  Token_Transbank: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  ID_Comercio: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transbank_comercios',
      key: 'ID_Comercio'
    }
  },
  ID_Pedido: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'pedidos',
      key: 'ID_Pedido'
    }
  },
  Orden_Compra: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  Session_ID: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true
    }
  },
  ID_Divisa: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    references: {
      model: 'divisas',
      key: 'ID_Divisa'
    }
  },
  ID_Estado: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transbank_estados_transaccion',
      key: 'ID_Estado'
    }
  },
  URL_Retorno: {
    type: DataTypes.STRING(255),
    validate: {
      isUrl: true
    }
  },
  URL_Final: {
    type: DataTypes.STRING(255),
    validate: {
      isUrl: true
    }
  },
  Fecha_Creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Fecha_Autorizacion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Codigo_Autorizacion: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Tipo_Tarjeta: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  Ultimos_4_Digitos: {
    type: DataTypes.STRING(4),
    allowNull: true,
    validate: {
      len: [4, 4],
      isNumeric: true
    }
  },
  Numero_Cuotas: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 24
    }
  },
  JSON_Respuesta_Init: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  JSON_Respuesta_Commit: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Fecha_Vencimiento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  IP_Cliente: {
    type: DataTypes.STRING(45),
    allowNull: true,
    validate: {
      isIP: true
    }
  },
  User_Agent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'transbank_transacciones',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['Token_Transbank']
    },
    {
      fields: ['ID_Pedido']
    },
    {
      fields: ['Orden_Compra']
    },
    {
      fields: ['Fecha_Creacion']
    },
    {
      fields: ['ID_Estado']
    }
  ]
});

module.exports = TransbankTransacciones;
