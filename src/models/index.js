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

      const modelModule = require(modelPath);

      if (typeof modelModule === 'function') {
        model = modelModule(sequelize, Sequelize.DataTypes);
      } else if (modelModule.default && typeof modelModule.default === 'function') {
        model = modelModule.default(sequelize, Sequelize.DataTypes);
      } else if (modelModule.name) {
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

// Configurar asociaciones si existen (PERO SALTANDO LAS PROBLEMÁTICAS)
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    try {
      // ⚠️ SALTAR SOLO PARA MODELOS PROBLEMÁTICOS
      if (['Cuotas', 'DetalleTransaccion', 'WebpayTransaccion'].includes(modelName)) {
        console.log(`⚠️ Saltando asociaciones para ${modelName} (para evitar conflictos)`);
        return;
      }
      
      db[modelName].associate(db);
      console.log(`🔗 Asociaciones configuradas para ${modelName}`);
    } catch (error) {
      console.error(`❌ Error configurando asociaciones para ${modelName}:`, error.message);
    }
  }
});

// ⚠️ COMENTADO: Relación Transaccion <-> EstadoTransaccion (CAUSA EL ERROR)
/*
// Relación Transaccion <-> EstadoTransaccion
if (db.Transaccion && db.EstadoTransaccion) {
  db.Transaccion.belongsTo(db.EstadoTransaccion, {
    foreignKey: 'estadoId',    // ← ESTE 'estadoId' NO EXISTE EN TU TABLA
    as: 'estado'
  });
  db.EstadoTransaccion.hasMany(db.Transaccion, {
    foreignKey: 'estadoId',
    as: 'transacciones'
  });
  console.log('🔗 Relación Transaccion <-> EstadoTransaccion configurada');
}
*/

// ✅ MANTENER: Relación TransbankLog <-> Transaccion (ESTA FUNCIONA)
if (db.TransbankLog && db.Transaccion) {
  db.TransbankLog.belongsTo(db.Transaccion, {
    foreignKey: 'ID_Transaccion',
   // as: 'transaccion'
  });
  db.Transaccion.hasMany(db.TransbankLog, {
    foreignKey: 'ID_Transaccion',
    as: 'logs'
  });
  console.log('🔗 Relación TransbankLog <-> Transaccion configurada');
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// 🔄 Sincronizar base de datos
db.sync = async (options = {}) => {
  try {
    console.log('🔄 Sincronizando base de datos...');
    await sequelize.sync(options);
    console.log('✅ Base de datos sincronizada correctamente');

    // ⚠️ COMENTADO: No crear estados por defecto (evita conflictos)
    /*
    if (db.EstadoTransaccion) {
      await crearEstadosPorDefecto();
    }
    */

    return true;
  } catch (error) {
    console.error('❌ Error sincronizando base de datos:', error);
    throw error;
  }
};

// ⚠️ COMENTADO: Función que crea estados por defecto (EVITA CONFLICTOS)
/*
// ✅ Crear estados de transacción por defecto (corregido)
async function crearEstadosPorDefecto() {
  try {
    const estadosDefecto = [
      {
        codigoEstado: 'PEND',
        nombreEstado: 'Pendiente',
        descripcion: 'Transacción creada, esperando confirmación',
        esFinal: false,
        esExitoso: false
      },
      {
        codigoEstado: 'APRO',
        nombreEstado: 'Aprobado',
        descripcion: 'Transacción aprobada y procesada exitosamente',
        esFinal: true,
        esExitoso: true
      },
      {
        codigoEstado: 'RECH',
        nombreEstado: 'Rechazado',
        descripcion: 'Transacción rechazada por error de pago o validación',
        esFinal: true,
        esExitoso: false
      },
      {
        codigoEstado: 'CANC',
        nombreEstado: 'Cancelado',
        descripcion: 'Transacción cancelada por el usuario',
        esFinal: true,
        esExitoso: false
      },
      {
        codigoEstado: 'REEM',
        nombreEstado: 'Reembolsado',
        descripcion: 'Transacción reembolsada exitosamente',
        esFinal: true,
        esExitoso: false
      }
    ];

    for (const estadoData of estadosDefecto) {
      await db.EstadoTransaccion.findOrCreate({
        where: { codigoEstado: estadoData.codigoEstado },
        defaults: estadoData
      });
    }

    console.log('✅ Estados de transacción por defecto verificados');
  } catch (error) {
    console.error('❌ Error creando estados por defecto:', error);
  }
}
*/

console.log('📝 Usando Transacciones con campo estadoTexto (sin FK a EstadoTransaccion)');

module.exports = db;