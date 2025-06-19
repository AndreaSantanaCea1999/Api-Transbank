// src/models/EstadoTransaccion.js
module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');

  class EstadoTransaccion extends Model {
    // ⚠️ SIN ASOCIACIONES: Para evitar conflictos con el modelo Transaccion
    // Este modelo existe independientemente para mantener un catálogo de estados
    // pero NO se asocia automáticamente con Transaccion

    // ✅ MÉTODO ESTÁTICO: Para obtener estado por código
    static async findByCodigo(codigo) {
      return await this.findOne({
        where: { codigoEstado: codigo }
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener estado por nombre
    static async findByNombre(nombre) {
      return await this.findOne({
        where: { nombreEstado: nombre }
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener todos los estados activos
    static async findActivos() {
      return await this.findAll({
        where: { activo: true },
        order: [['orden', 'ASC'], ['nombreEstado', 'ASC']]
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener estados finales
    static async findFinales() {
      return await this.findAll({
        where: { esFinal: true, activo: true },
        order: [['nombreEstado', 'ASC']]
      });
    }

    // ✅ MÉTODO ESTÁTICO: Para obtener estados exitosos
    static async findExitosos() {
      return await this.findAll({
        where: { esExitoso: true, activo: true },
        order: [['nombreEstado', 'ASC']]
      });
    }

    // ✅ MÉTODO INSTANCIA: Verificar si es estado final
    isFinal() {
      return this.esFinal === true;
    }

    // ✅ MÉTODO INSTANCIA: Verificar si es estado exitoso
    isExitoso() {
      return this.esExitoso === true;
    }

    // ✅ MÉTODO ESTÁTICO: Para crear estados por defecto
    static async crearEstadosPorDefecto() {
      const estadosDefecto = [
        {
          codigoEstado: 'PEND',
          nombreEstado: 'Pendiente',
          descripcion: 'Transacción creada, esperando confirmación',
          esFinal: false,
          esExitoso: false,
          orden: 1,
          color: '#FFA500'
        },
        {
          codigoEstado: 'PROC',
          nombreEstado: 'Procesando',
          descripcion: 'Transacción en proceso de validación',
          esFinal: false,
          esExitoso: false,
          orden: 2,
          color: '#2196F3'
        },
        {
          codigoEstado: 'APRO',
          nombreEstado: 'Aprobado',
          descripcion: 'Transacción aprobada y procesada exitosamente',
          esFinal: true,
          esExitoso: true,
          orden: 3,
          color: '#4CAF50'
        },
        {
          codigoEstado: 'RECH',
          nombreEstado: 'Rechazado',
          descripcion: 'Transacción rechazada por error de pago o validación',
          esFinal: true,
          esExitoso: false,
          orden: 4,
          color: '#F44336'
        },
        {
          codigoEstado: 'CANC',
          nombreEstado: 'Cancelado',
          descripcion: 'Transacción cancelada por el usuario',
          esFinal: true,
          esExitoso: false,
          orden: 5,
          color: '#FF9800'
        },
        {
          codigoEstado: 'REEM',
          nombreEstado: 'Reembolsado',
          descripcion: 'Transacción reembolsada exitosamente',
          esFinal: true,
          esExitoso: false,
          orden: 6,
          color: '#9C27B0'
        },
        {
          codigoEstado: 'EXPI',
          nombreEstado: 'Expirado',
          descripcion: 'Transacción expirada por tiempo límite',
          esFinal: true,
          esExitoso: false,
          orden: 7,
          color: '#607D8B'
        }
      ];

      const resultados = [];
      for (const estadoData of estadosDefecto) {
        const [estado, created] = await this.findOrCreate({
          where: { codigoEstado: estadoData.codigoEstado },
          defaults: estadoData
        });
        resultados.push({ estado, created });
      }

      return resultados;
    }
  }

  EstadoTransaccion.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigoEstado: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      comment: 'Código único del estado (ej: PEND, APRO, RECH)'
    },
    nombreEstado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Nombre descriptivo del estado'
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Descripción detallada del estado'
    },
    esFinal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si es un estado final (no puede cambiar)'
    },
    esExitoso: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si representa un resultado exitoso'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si el estado está activo para uso'
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Orden de visualización del estado'
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      comment: 'Color hexadecimal para representar el estado'
    },
    icono: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Nombre del icono para representar el estado'
    },
    fechaCreacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del estado'
    },
    fechaActualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización'
    }
  }, {
    sequelize,
    modelName: 'EstadoTransaccion',
    tableName: 'estados_transaccion',
    timestamps: true,
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion',
    indexes: [
      {
        unique: true,
        fields: ['codigoEstado']
      },
      {
        unique: true,
        fields: ['nombreEstado']
      },
      {
        fields: ['activo']
      },
      {
        fields: ['esFinal']
      },
      {
        fields: ['esExitoso']
      },
      {
        fields: ['orden']
      }
    ],
    comment: 'Catálogo de estados para las transacciones'
  });

  return EstadoTransaccion;
};