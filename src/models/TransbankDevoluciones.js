const TransbankDevoluciones = sequelize.define('transbank_devoluciones', {
  ID_Devolucion: {
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
  Tipo_Devolucion: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Anulacion', 'Devolucion_Parcial', 'Devolucion_Total']]
    }
  },
  Monto_Devolucion: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true
    }
  },
  Motivo: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  Token_Devolucion: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Codigo_Autorizacion_Devolucion: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Estado_Devolucion: {
    type: DataTypes.STRING(20),
    defaultValue: 'Pendiente',
    validate: {
      isIn: [['Pendiente', 'Procesada', 'Rechazada', 'Error']]
    }
  },
  Fecha_Solicitud: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Fecha_Procesamiento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  JSON_Respuesta: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ID_Usuario_Solicita: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuario',
      key: 'ID_Usuario'
    }
  }
}, {
  tableName: 'transbank_devoluciones',
  timestamps: false,
  indexes: [
    {
      fields: ['ID_Transaccion']
    },
    {
      fields: ['Estado_Devolucion']
    },
    {
      fields: ['Fecha_Solicitud']
    }
  ]
});

module.exports = TransbankDevoluciones;
