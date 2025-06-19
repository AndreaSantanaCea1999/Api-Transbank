// src/models/EstadoTransaccion.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('EstadoTransaccion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'ID_Estado'
    },
    codigoEstado: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      field: 'Codigo_Estado'
    },
    nombreEstado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'Nombre_Estado'
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'Descripcion'
    },
    esFinal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'Es_Final'
    },
    esExitoso: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'Es_Exitoso'
    }
  }, {
    tableName: 'transbank_estados_transaccion',
    timestamps: false
  });
};
