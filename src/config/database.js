// src/config/database.js - API Transbank
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de logging personalizado
const logger = require('../utils/logger');

console.log('🔗 Configurando conexión a base de datos Transbank...');
console.log(`📊 Base de datos: ${process.env.DB_NAME}`);
console.log(`🏠 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ferremas_complete',
  process.env.DB_USER || 'administrador',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',

    // Configuración de logging
    logging: process.env.NODE_ENV === 'production' 
      ? false 
      : (sql, timing) => {
          logger.debug(`[DB] ${sql}${timing ? ` (${timing}ms)` : ''}`);
        },

    // Configuración de pool de conexiones
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    // Configuración de timezone y charset
    timezone: '-03:00', // Chile timezone
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      useUTC: false,
      dateStrings: true,
      typeCast: true
    },

    // Configuración de definición de modelos
    define: {
      timestamps: false,
      freezeTableName: true,
      underscored: false,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },

    // Configuración de retry
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /ER_LOCK_WAIT_TIMEOUT/,
        /ER_LOCK_DEADLOCK/
      ]
    }
  }
);

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conectado exitosamente a la base de datos MySQL');

    // Verificar tablas de Transbank
    const [results] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      AND TABLE_NAME LIKE 'transbank_%'
      ORDER BY TABLE_NAME
    `);

    logger.info(`📋 Tablas de Transbank encontradas: ${results.length}`);
    results.forEach(table => {
      logger.info(`   - ${table.TABLE_NAME}`);
    });

    return true;
  } catch (error) {
    logger.error('❌ Error al conectar con la base de datos:', {
      message: error.message,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
    });
    throw error;
  }
};

// Función para sincronizar modelos (solo en desarrollo)
const syncDatabase = async (force = false) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force, alter: false });
      logger.info('🔄 Modelos de Transbank sincronizados con la base de datos');
    }
  } catch (error) {
    logger.error('❌ Error al sincronizar modelos:', error.message);
    throw error;
  }
};

// Función para cerrar la conexión
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('🔒 Conexión a la base de datos cerrada');
  } catch (error) {
    logger.error('❌ Error al cerrar la conexión:', error.message);
  }
};

// No uses estos listeners porque no existen en Sequelize v6+
// sequelize.connectionManager.on('connect', () => {
//   logger.info('🔗 Nueva conexión establecida');
// });

// sequelize.connectionManager.on('disconnect', () => {
//   logger.warn('🔌 Conexión desconectada');
// });

// Manejo de errores de conexión al cerrar la app
process.on('SIGINT', async () => {
  logger.info('🛑 Cerrando aplicación...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Terminando aplicación...');
  await closeConnection();
  process.exit(0);
});

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection
};
