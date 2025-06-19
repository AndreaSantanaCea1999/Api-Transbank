module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class WebpayTransaccion extends Model {
    static associate(models) {
      this.belongsTo(models.Transaccion, {
        foreignKey: 'id_transaccion',
        as: 'transaccion'
      });
    }
  }

  WebpayTransaccion.init({
    id_webpay: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_transaccion: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false
    },
    respuesta: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'WebpayTransaccion',
    tableName: 'webpay_transacciones',
    timestamps: false
  });

  return WebpayTransaccion;
};
