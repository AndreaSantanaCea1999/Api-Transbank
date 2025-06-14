const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error);
    process.exit(1);
  }
}

testConnection();