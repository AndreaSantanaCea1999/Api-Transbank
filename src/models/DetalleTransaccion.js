// src/models/DetalleTransaccion.js
module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class DetalleTransaccion extends Model {
    // ⚠️ COMENTADO: Para evitar conflicto con Transaccion que no tiene estadoId
    /*
    static associate(models) {
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

    // ✅ MÉTODO ESTÁTICO: Para obtener detalles de una transacción
    static async findByTransaccion(idTransaccion) {
      return await this.findAll({
        where: { id_transaccion: idTransaccion },
        order: [['id_detalle', 'ASC']]
      });
    }

    // ✅ MÉTODO INSTANCIA: Calcular subtotal
    getSubtotal() {
      return this.cantidad * this.precio_unitario;
    }

    // ✅ MÉTODO ESTÁTICO: Calcular total de una transacción
    static async calcularTotalTransaccion(idTransaccion) {
      const detalles = await this.findByTransaccion(idTransaccion);
      return detalles.reduce((total, detalle) => {
        return total + detalle.getSubtotal();
      }, 0);
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
      allowNull: false,
      comment: 'ID de la transacción relacionada'
    },
    producto_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID del producto (si existe en inventario)'
    },
    producto: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Nombre del producto'
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada del producto'
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      },
      comment: 'Cantidad del producto'
    },
    precio_unitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Precio unitario del producto'
    },
    subtotal: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.cantidad * this.precio_unitario;
      }
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del registro'
    }
  }, {
    sequelize,
    modelName: 'DetalleTransaccion',
    tableName: 'transbank_detalles_transaccion',
    timestamps: false,
    indexes: [
      {
        fields: ['id_transaccion']
      },
      {
        fields: ['producto_id']
      }
    ],
    comment: 'Tabla para almacenar los detalles de productos en cada transacción'
  });

  return DetalleTransaccion;
};