// src/models/Transaccion.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Transaccion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'  // ✅ CORREGIDO: Coincide con tu tabla real
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ Permite NULL como tu tabla
      field: 'ID_Cliente'  // ✅ Coincide con tu tabla real
    },
    ordenCompra: {
      type: DataTypes.STRING(100),  // ✅ VARCHAR(100) como tu tabla
      allowNull: true,
      field: 'ordenCompra'  // ✅ Coincide con tu tabla real
    },
    monto: {
      type: DataTypes.DECIMAL(10,2),  // ✅ DECIMAL(10,2) como tu tabla
      allowNull: true,
      field: 'monto'  // ✅ Coincide con tu tabla real
    },
    token: {
      type: DataTypes.STRING(255),  // ✅ Nueva columna que tienes
      allowNull: true,
      field: 'token'
    },
    estadoTexto: {  // ✅ RENOMBRADO: para evitar conflicto con asociaciones
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'PENDIENTE',
      field: 'estado'  // ✅ Mapea al campo 'estado' VARCHAR(50) de tu tabla
    },
    detalles: {
      type: DataTypes.TEXT('long'),  // ✅ LONGTEXT como tu tabla
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
      field: 'createdAt'  // ✅ Coincide con tu tabla real
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updatedAt'  // ✅ Coincide con tu tabla real
    }
  }, {
    tableName: 'transacciones',  // ✅ CORREGIDO: Tu tabla real es 'transacciones'
    timestamps: true,
    createdAt: 'createdAt',    // ✅ Coincide con tu tabla
    updatedAt: 'updatedAt'     // ✅ Coincide con tu tabla
  });
};