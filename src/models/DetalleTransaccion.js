module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class DetalleTransaccion extends Model {
    static associate(models) {
      this.belongsTo(models.Transaccion, {
        foreignKey: 'id_transaccion',
        as: 'transaccion'
      });
    }
  }

  DetalleTransaccion.init({
    id_detalle: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_transaccion: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    producto: {
      type: DataTypes.STRING,
      allowNull: false
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    precio_unitario: {
      type: DataTypes.FLOAT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'DetalleTransaccion',
    tableName: 'transbank_detalles_transaccion',
    timestamps: false
  });

  return DetalleTransaccion;
};
