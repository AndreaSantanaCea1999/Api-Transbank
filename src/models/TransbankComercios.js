const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransbankComercios = sequelize.define('transbank_comercios', {
  ID_Comercio: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  Codigo_Comercio: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 20]
    }
  },
  Nombre_Comercio: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  RUT_Comercio: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  API_Key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  API_Secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  Ambiente: {
    type: DataTypes.STRING(20),
    defaultValue: 'integration',
    validate: {
      isIn: [['integration', 'production']]
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
  Estado: {
    type: DataTypes.STRING(20),
    defaultValue: 'Activo',
    validate: {
      isIn: [['Activo', 'Inactivo', 'Suspendido']]
    }
  },
  Fecha_Registro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'transbank_comercios',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['Codigo_Comercio']
    },
    {
      fields: ['Estado']
    }
  ]
});

module.exports = TransbankComercios;