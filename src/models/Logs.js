module.exports = (sequelize, DataTypes) => {
  return sequelize.define('TransbankLog', {
    ID_Log: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ID_Transaccion: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    Accion: {
      type: DataTypes.STRING(50),
      allowNull: false
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
      allowNull: true
    },
    User_Agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    Fecha_Log: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    Duracion_MS: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'transbank_logs',
    timestamps: false
  });
};