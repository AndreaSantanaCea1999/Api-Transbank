// src/models/WebpayTransaccion.js
module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class WebpayTransaccion extends Model {
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

    // ✅ MÉTODO ESTÁTICO: Para obtener WebPay por transacción
    static async findByTransaccion(idTransaccion) {
      return await this.findOne({
        where: { id_transaccion: idTransaccion }
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener por token WebPay
    static async findByToken(token) {
      return await this.findOne({
        where: { token: token }
      });
    }

    // ✅ MÉTODO INSTANCIA: Verificar si la transacción fue exitosa
    isExitosa() {
      if (!this.respuesta) return false;
      try {
        const resp = typeof this.respuesta === 'string' ? JSON.parse(this.respuesta) : this.respuesta;
        return resp.responseCode === '0' || resp.estado === 'APROBADO';
      } catch {
        return false;
      }
    }

    // ✅ MÉTODO INSTANCIA: Obtener código de autorización
    getCodigoAutorizacion() {
      if (!this.respuesta) return null;
      try {
        const resp = typeof this.respuesta === 'string' ? JSON.parse(this.respuesta) : this.respuesta;
        return resp.authorizationCode || resp.codigo_autorizacion || null;
      } catch {
        return null;
      }
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
      allowNull: false,
      comment: 'ID de la transacción relacionada'
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Token único de WebPay para esta transacción'
    },
    url_webpay: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL de redirección a WebPay'
    },
    respuesta: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Respuesta completa de WebPay en formato JSON',
      get() {
        const rawValue = this.getDataValue('respuesta');
        if (!rawValue) return null;
        try {
          return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        } catch {
          return rawValue;
        }
      },
      set(value) {
        this.setDataValue('respuesta', typeof value === 'object' ? JSON.stringify(value) : value);
      }
    },
    codigo_respuesta: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Código de respuesta de WebPay'
    },
    mensaje_respuesta: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Mensaje descriptivo de la respuesta'
    },
    codigo_autorizacion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Código de autorización del pago'
    },
    tipo_tarjeta: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Tipo de tarjeta utilizada (Visa, Mastercard, etc.)'
    },
    ultimos_4_digitos: {
      type: DataTypes.STRING(4),
      allowNull: true,
      comment: 'Últimos 4 dígitos de la tarjeta'
    },
    fecha_transaccion: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de la transacción en WebPay'
    },
    monto_transaccion: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monto de la transacción procesada'
    },
    estado_webpay: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'INICIADO',
      comment: 'Estado de la transacción en WebPay'
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del registro'
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización'
    }
  }, {
    sequelize,
    modelName: 'WebpayTransaccion',
    tableName: 'webpay_transacciones',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: 'fecha_actualizacion',
    indexes: [
      {
        unique: true,
        fields: ['token']
      },
      {
        fields: ['id_transaccion']
      },
      {
        fields: ['estado_webpay']
      },
      {
        fields: ['fecha_transaccion']
      }
    ],
    comment: 'Tabla para almacenar información de transacciones WebPay'
  });

  return WebpayTransaccion;
};