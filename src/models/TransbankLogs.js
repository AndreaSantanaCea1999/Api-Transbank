const TransbankLogs = sequelize.define('transbank_logs', {
  ID_Log: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ID_Transaccion: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'transbank_transacciones',
      key: 'ID_Transaccion'
    }
  },
  Accion: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  Descripcion: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  Datos_Entrada: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Datos_Salida: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Codigo_Respuesta: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  Mensaje_Error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  IP_Origen: {
    type: DataTypes.STRING(45),
    allowNull: true,
    validate: {
      isIP: true
    }
  },
  User_Agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Fecha_Log: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Duracion_MS: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'transbank_logs',
  timestamps: false,
  indexes: [
    {
      fields: ['ID_Transaccion']
    },
    {
      fields: ['Accion']
    },
    {
      fields: ['Fecha_Log']
    },
    {
      fields: ['Codigo_Respuesta']
    }
  ]
});

module.exports = TransbankLogs;