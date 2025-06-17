// src/models/Transaccion.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Transaccion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'ID_Transaccion'
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ID_Cliente'
    },
    ordenCompra: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'Orden_Compra'
    },
    monto: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      field: 'Monto'
    },
    divisa: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'Divisa'
    },
    estadoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'Estado_Id'
    },
    detalles: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'Detalles'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'Fecha_Creacion'
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'Fecha_Actualizacion'
    }
  }, {
    tableName: 'transbank_transacciones',
    timestamps: true,
    createdAt: 'Fecha_Creacion',
    updatedAt: 'Fecha_Actualizacion'
  });
};
