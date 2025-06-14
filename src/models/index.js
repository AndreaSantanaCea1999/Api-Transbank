const { sequelize } = require('../config/database');

// Importa modelos (ya usan sequelize internamente)
const TransbankComercios = require('./TransbankComercios');
const TransbankEstadosTransaccion = require('./TransbankEstadosTransaccion');
const TransbankTransacciones = require('./TransbankTransacciones');
const TransbankDetalleTransacciones = require('./TransbankDetalleTransacciones');
const TransbankCuotas = require('./TransbankCuotas');
const TransbankDevoluciones = require('./TransbankDevoluciones');
const TransbankLogs = require('./TransbankLogs');

// Definir relaciones
const definirRelaciones = () => {
  // Comercios - Transacciones
  TransbankComercios.hasMany(TransbankTransacciones, {
    foreignKey: 'ID_Comercio',
    as: 'transacciones'
  });
  TransbankTransacciones.belongsTo(TransbankComercios, {
    foreignKey: 'ID_Comercio',
    as: 'comercio'
  });

  // Estados - Transacciones
  TransbankEstadosTransaccion.hasMany(TransbankTransacciones, {
    foreignKey: 'ID_Estado',
    as: 'transacciones'
  });
  TransbankTransacciones.belongsTo(TransbankEstadosTransaccion, {
    foreignKey: 'ID_Estado',
    as: 'estado'
  });

  // Transacciones - Detalles
  TransbankTransacciones.hasMany(TransbankDetalleTransacciones, {
    foreignKey: 'ID_Transaccion',
    as: 'detalles'
  });
  TransbankDetalleTransacciones.belongsTo(TransbankTransacciones, {
    foreignKey: 'ID_Transaccion',
    as: 'transaccion'
  });

  // Comercios - Cuotas
  TransbankComercios.hasMany(TransbankCuotas, {
    foreignKey: 'ID_Comercio',
    as: 'cuotas'
  });
  TransbankCuotas.belongsTo(TransbankComercios, {
    foreignKey: 'ID_Comercio',
    as: 'comercio'
  });

  // Transacciones - Devoluciones
  TransbankTransacciones.hasMany(TransbankDevoluciones, {
    foreignKey: 'ID_Transaccion',
    as: 'devoluciones'
  });
  TransbankDevoluciones.belongsTo(TransbankTransacciones, {
    foreignKey: 'ID_Transaccion',
    as: 'transaccion'
  });

  // Transacciones - Logs
  TransbankTransacciones.hasMany(TransbankLogs, {
    foreignKey: 'ID_Transaccion',
    as: 'logs'
  });
  TransbankLogs.belongsTo(TransbankTransacciones, {
    foreignKey: 'ID_Transaccion',
    as: 'transaccion'
  });
};

// Ejecuta las relaciones al cargar el módulo
definirRelaciones();

// Exportar todos los modelos y sequelize
module.exports = {
  sequelize,
  TransbankComercios,
  TransbankEstadosTransaccion,
  TransbankTransacciones,
  TransbankDetalleTransacciones,
  TransbankCuotas,
  TransbankDevoluciones,
  TransbankLogs,
};
