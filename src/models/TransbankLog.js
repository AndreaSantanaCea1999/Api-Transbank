// src/models/TransbankLog.js
module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class TransbankLog extends Model {
    // ✅ ESTA ASOCIACIÓN SÍ FUNCIONA porque usa ID_Transaccion que existe
    static associate(models) {
      this.belongsTo(models.Transaccion, {
        foreignKey: 'ID_Transaccion',
        as: 'transaccion'
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener logs de una transacción
    static async findByTransaccion(idTransaccion) {
      return await this.findAll({
        where: { ID_Transaccion: idTransaccion },
        order: [['Fecha_Creacion', 'DESC']]
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener logs por acción
    static async findByAccion(accion, limite = 100) {
      return await this.findAll({
        where: { Accion: accion },
        order: [['Fecha_Creacion', 'DESC']],
        limit: limite
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener logs de errores
    static async findErrores(limite = 50) {
      return await this.findAll({
        where: {
          Mensaje_Error: {
            [sequelize.Sequelize.Op.not]: null
          }
        },
        order: [['Fecha_Creacion', 'DESC']],
        limit: limite
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para crear log de actividad
    static async crearLog(data) {
      return await this.create({
        ID_Transaccion: data.idTransaccion || null,
        Accion: data.accion,
        Descripcion: data.descripcion,
        Datos_Entrada: data.datosEntrada ? JSON.stringify(data.datosEntrada) : null,
        Datos_Salida: data.datosSalida ? JSON.stringify(data.datosSalida) : null,
        Codigo_Respuesta: data.codigoRespuesta || '200',
        Mensaje_Error: data.mensajeError || null,
        IP_Origen: data.ipOrigen || null,
        User_Agent: data.userAgent || null,
        Duracion_MS: data.duracionMs || 0,
        Usuario_ID: data.usuarioId || null
      });
    }

    // ✅ MÉTODO INSTANCIA: Verificar si es un error
    isError() {
      return this.Mensaje_Error !== null && this.Mensaje_Error !== '';
    }

    // ✅ MÉTODO INSTANCIA: Obtener datos de entrada parseados
    getDatosEntrada() {
      if (!this.Datos_Entrada) return null;
      try {
        return JSON.parse(this.Datos_Entrada);
      } catch {
        return this.Datos_Entrada;
      }
    }

    // ✅ MÉTODO INSTANCIA: Obtener datos de salida parseados
    getDatosSalida() {
      if (!this.Datos_Salida) return null;
      try {
        return JSON.parse(this.Datos_Salida);
      } catch {
        return this.Datos_Salida;
      }
    }

    // ✅ MÉTODO INSTANCIA: Formatear para respuesta
    toResponse() {
      return {
        id: this.ID_Log,
        transaccion_id: this.ID_Transaccion,
        accion: this.Accion,
        descripcion: this.Descripcion,
        codigo_respuesta: this.Codigo_Respuesta,
        es_error: this.isError(),
        mensaje_error: this.Mensaje_Error,
        ip_origen: this.IP_Origen,
        duracion_ms: this.Duracion_MS,
        fecha_creacion: this.Fecha_Creacion,
        datos_entrada: this.getDatosEntrada(),
        datos_salida: this.getDatosSalida()
      };
    }
  }

  TransbankLog.init({
    ID_Log: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ID_Transaccion: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la transacción relacionada (si aplica)'
    },
    Accion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Acción realizada (ej: CREAR_TRANSACCION, CONFIRMAR_PAGO, etc.)'
    },
    Descripcion: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Descripción detallada de la acción'
    },
    Datos_Entrada: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Datos de entrada en formato JSON'
    },
    Datos_Salida: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Datos de salida en formato JSON'
    },
    Codigo_Respuesta: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: '200',
      comment: 'Código de respuesta HTTP'
    },
    Mensaje_Error: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mensaje de error si ocurrió algún problema'
    },
    IP_Origen: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Dirección IP de origen de la solicitud'
    },
    User_Agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'User Agent del cliente'
    },
    Duracion_MS: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Duración de la operación en milisegundos'
    },
    Usuario_ID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID del usuario que realizó la acción (si aplica)'
    },
    Metodo_HTTP: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Método HTTP utilizado (GET, POST, PUT, etc.)'
    },
    URL_Endpoint: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Endpoint de la API que fue llamado'
    },
    Fecha_Creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de creación del log'
    }
  }, {
    sequelize,
    modelName: 'TransbankLog',
    tableName: 'transbank_logs',
    timestamps: false,
    indexes: [
      {
        fields: ['ID_Transaccion']
      },
      {
        fields: ['Accion']
      },
      {
        fields: ['Codigo_Respuesta']
      },
      {
        fields: ['Fecha_Creacion']
      },
      {
        fields: ['Mensaje_Error']
      },
      {
        fields: ['IP_Origen']
      }
    ],
    comment: 'Tabla para auditoría y logs de todas las operaciones de Transbank'
  });

  return TransbankLog;
};