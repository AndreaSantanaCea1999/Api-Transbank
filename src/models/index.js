'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config();

const basename = path.basename(__filename);
const db = {};

// Crear instancia Sequelize con variables de entorno
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    timezone: '-03:00', // Chile timezone
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
      timestamps: true
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Importar modelos dinámicamente
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    try {
      const modelPath = path.join(__dirname, file);
      let model;
      
      // Intentar importar el modelo - manejar diferentes formatos de exportación
      const modelModule = require(modelPath);
      
      if (typeof modelModule === 'function') {
        // Formato: module.exports = (sequelize, DataTypes) => { ... }
        model = modelModule(sequelize, Sequelize.DataTypes);
      } else if (modelModule.default && typeof modelModule.default === 'function') {
        // Formato ES6: export default function(sequelize, DataTypes) { ... }
        model = modelModule.default(sequelize, Sequelize.DataTypes);
      } else if (modelModule.name) {
        // Modelo ya definido: const Model = sequelize.define(...)
        model = modelModule;
      } else {
        console.warn(`⚠️ Modelo en ${file} no pudo ser importado correctamente`);
        return;
      }
      
      if (model && model.name) {
        db[model.name] = model;
        console.log(`✅ Modelo ${model.name} cargado desde ${file}`);
      } else {
        console.warn(`⚠️ Modelo en ${file} no tiene nombre válido`);
      }
    } catch (error) {
      console.error(`❌ Error cargando modelo ${file}:`, error.message);
    }
  });

// Configurar asociaciones si existen
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    try {
      db[modelName].associate(db);
      console.log(`🔗 Asociaciones configuradas para ${modelName}`);
    } catch (error) {
      console.error(`❌ Error configurando asociaciones para ${modelName}:`, error.message);
    }
  }
});

// Configurar relaciones específicas de Transbank
if (db.Transaccion && db.EstadoTransaccion) {
  db.Transaccion.belongsTo(db.EstadoTransaccion, {
    foreignKey: 'estadoId',
    as: 'estado'
  });
  db.EstadoTransaccion.hasMany(db.Transaccion, {
    foreignKey: 'estadoId',
    as: 'transacciones'
  });
  console.log('🔗 Relación Transaccion <-> EstadoTransaccion configurada');
}

if (db.TransbankLog && db.Transaccion) {
  db.TransbankLog.belongsTo(db.Transaccion, {
    foreignKey: 'ID_Transaccion',
    as: 'transaccion'
  });
  db.Transaccion.hasMany(db.TransbankLog, {
    foreignKey: 'ID_Transaccion',
    as: 'logs'
  });
  console.log('🔗 Relación TransbankLog <-> Transaccion configurada');
}

// Añadir instancia de Sequelize y constructor al objeto db
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Función para sincronizar la base de datos
db.sync = async (options = {}) => {
  try {
    console.log('🔄 Sincronizando base de datos...');
    await sequelize.sync(options);
    console.log('✅ Base de datos sincronizada correctamente');
    
    // Crear estados por defecto si no existen
    if (db.EstadoTransaccion) {
      await crearEstadosPorDefecto();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error sincronizando base de datos:', error);
    throw error;
  }
};

// Función para crear estados de transacción por defecto
async function crearEstadosPorDefecto() {
  try {
    const estadosDefecto = [
      { nombre: 'Pendiente', descripcion: 'Transacción creada, esperando confirmación' },
      { nombre: 'Aprobado', descripcion: 'Transacción aprobada y procesada exitosamente' },
      { nombre: 'Rechazado', descripcion: 'Transacción rechazada por error de pago o validación' },
      { nombre: 'Cancelado', descripcion: 'Transacción cancelada por el usuario' },
      { nombre: 'Reembolsado', descripcion: 'Transacción reembolsada exitosamente' }
    ];

    for (const estado of estadosDefecto) {
      await db.EstadoTransaccion.findOrCreate({
        where: { nombre: estado.nombre },
        defaults: estado
      });
    }
    
    console.log('✅ Estados de transacción por defecto verificados/creados');
  } catch (error) {
    console.error('❌ Error creando estados por defecto:', error.message);
  }
}

// Función para verificar conexión
db.testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ No se pudo conectar a MySQL:', error);
    return false;
  }
};

// Función para cerrar conexión
db.close = async () => {
  try {
    await sequelize.close();
    console.log('✅ Conexión a MySQL cerrada correctamente');
  } catch (error) {
    console.error('❌ Error cerrando conexión a MySQL:', error);
  }
};

module.exports = db;