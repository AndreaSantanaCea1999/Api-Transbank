module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class Cuotas extends Model {
    static associate(models) {
      this.belongsTo(models.Transaccion, {
        foreignKey: 'id_transaccion',
        as: 'transaccion'
      });
    }
  }

  Cuotas.init({
    id_cuota: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_transaccion: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cantidad_cuotas: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Cuotas',
    tableName: 'transbank_cuotas',
    timestamps: false
  });

  return Cuotas;
};
