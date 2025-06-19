// src/models/Cuotas.js
module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class Cuotas extends Model {
    // ⚠️ COMENTADO: Para evitar conflicto con Transaccion que no tiene estadoId
    /*
    static associate(models) {
      // Esta asociación causaba problemas porque esperaba que Transaccion tuviera estadoId
      this.belongsTo(models.Transaccion, {
        foreignKey: 'id_transaccion',
        as: 'transaccion'
      });
    }
    */

    // ✅ MÉTODO ALTERNATIVO: Para obtener transacción relacionada sin asociación FK
    async getTransaccionRelacionada() {
      const { Transaccion } = require('./index');
      return await Transaccion.findByPk(this.id_transaccion);
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener cuotas de una transacción
    static async findByTransaccion(idTransaccion) {
      return await this.findAll({
        where: { id_transaccion: idTransaccion }
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
      allowNull: false,
      comment: 'ID de la transacción relacionada'
    },
    cantidad_cuotas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 48
      },
      comment: 'Número de cuotas para el pago'
    },
    monto_cuota: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monto de cada cuota'
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del registro'
    }
  }, {
    sequelize,
    modelName: 'Cuotas',
    tableName: 'transbank_cuotas',
    timestamps: false,
    indexes: [
      {
        fields: ['id_transaccion']
      }
    ],
    comment: 'Tabla para almacenar información de cuotas de las transacciones'
  });

  return Cuotas;
};