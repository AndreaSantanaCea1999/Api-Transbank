// src/models/Transaccion.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Transaccion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'ID_Cliente'
    },
    ordenCompra: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'ordenCompra'
    },
    monto: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true,
      field: 'monto'
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'token'
    },
    estadoTexto: {  // ⚠️ CAMBIADO: de 'estado' a 'estadoTexto' para evitar conflicto
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'PENDIENTE',
      field: 'estado'  // El campo en la BD sigue siendo 'estado'
    },
    detalles: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'detalles',
      get() {
        const rawValue = this.getDataValue('detalles');
        if (!rawValue) return null;
        try {
          return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        } catch {
          return rawValue;
        }
      },
      set(value) {
        this.setDataValue('detalles', typeof value === 'object' ? JSON.stringify(value) : value);
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'createdAt'
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updatedAt'
    }
  }, {
    tableName: 'transacciones',  // Usando la tabla 'transacciones' que tienes
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });
};