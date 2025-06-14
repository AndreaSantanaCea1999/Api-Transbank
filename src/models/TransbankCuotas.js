const TransbankCuotas = sequelize.define('transbank_cuotas', {
  ID_Cuota: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ID_Comercio: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transbank_comercios',
      key: 'ID_Comercio'
    }
  },
  Numero_Cuotas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 24
    }
  },
  Monto_Minimo: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  Monto_Maximo: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 999999999,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  Activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  Fecha_Creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'transbank_cuotas',
  timestamps: false,
  indexes: [
    {
      fields: ['ID_Comercio', 'Numero_Cuotas'],
      unique: true
    },
    {
      fields: ['Activo']
    }
  ]
});

module.exports = TransbankCuotas;