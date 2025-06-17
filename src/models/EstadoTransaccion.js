// src/models/EstadoTransaccion.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('EstadoTransaccion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'ID'
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'Nombre'
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'Descripcion'
    }
  }, {
    tableName: 'estados_transaccion',
    timestamps: false
  });
};
