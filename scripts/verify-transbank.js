const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const verificarTransbank = async () => {
  console.log('🔍 VERIFICACIÓN COMPLETA API TRANSBANK\n');

  // 1. Verificar variables de entorno
  console.log('1️⃣ Verificando configuración...');
  const configRequerida = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'TRANSBANK_COMMERCE_CODE', 'TRANSBANK_API_KEY',
    'API_INVENTARIO_URL', 'API_BANCO_URL'
  ];

  const configFaltante = configRequerida.filter(key => !process.env[key]);
  
  if (configFaltante.length > 0) {
    console.error('❌ Configuración faltante:', configFaltante.join(', '));
    return false;
  }
  console.log('✅ Configuración completa\n');

  // 2. Verificar conexión a base de datos
  console.log('2️⃣ Verificando base de datos...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Verificar tablas de Transbank
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME LIKE 'transbank_%'
    `, [process.env.DB_NAME]);

    console.log(`✅ Base de datos conectada - ${tables[0].count} tablas Transbank encontradas`);

    // Verificar datos básicos
    const queries = [
      { table: 'transbank_comercios', name: 'Comercios' },
      { table: 'transbank_estados_transaccion', name: 'Estados' },
      { table: 'transbank_cuotas', name: 'Configuración Cuotas' }
    ];

    for (const query of queries) {
      try {
        const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${query.table}`);
        console.log(`   ${query.name}: ${result[0].count} registros`);
      } catch (error) {
        console.log(`   ${query.name}: ❌ Error - ${error.message}`);
      }
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error de base de datos:', error.message);
    return false;
  }
  console.log();

  // 3. Verificar APIs externas
  console.log('3️⃣ Verificando conectividad con otras APIs...');
  
  // API de Inventario
  try {
    const response = await axios.get(`${process.env.API_INVENTARIO_URL}/health`, {
      timeout: 5000,
      headers: { 'X-API-Key': process.env.API_INVENTARIO_KEY }
    });
    console.log('✅ API Inventario: Conectada');
  } catch (error) {
    console.log('⚠️ API Inventario: No disponible (continuará en modo degradado)');
  }

  // API de Banco
  try {
    const response = await axios.get(`${process.env.API_BANCO_URL}/health`, {
      timeout: 5000,
      headers: { 'X-API-Key': process.env.API_BANCO_KEY }
    });
    console.log('✅ API Banco: Conectada');
  } catch (error) {
    console.log('⚠️ API Banco: No disponible (continuará en modo degradado)');
  }
  console.log();

  // 4. Verificar configuración Transbank
  console.log('4️⃣ Verificando configuración Transbank...');
  console.log(`   Ambiente: ${process.env.TRANSBANK_ENVIRONMENT || 'integration'}`);
  console.log(`   Código Comercio: ${process.env.TRANSBANK_COMMERCE_CODE}`);
  console.log(`   API Key: ${process.env.TRANSBANK_API_KEY?.substring(0, 8)}...`);
  
  if (process.env.TRANSBANK_ENVIRONMENT === 'integration') {
    console.log('✅ Configurado para modo integración (pruebas)');
  } else {
    console.log('🔥 Configurado para modo PRODUCCIÓN');
  }
  console.log();

  console.log('✅ VERIFICACIÓN COMPLETADA - API TRANSBANK LISTA PARA USAR\n');
  
  console.log('🚀 Para iniciar la API, ejecuta:');
  console.log('   npm run dev    (desarrollo)');
  console.log('   npm start      (producción)\n');
  
  return true;
};

// Ejecutar verificación
if (require.main === module) {
  verificarTransbank()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error durante verificación:', error);
      process.exit(1);
    });
}

module.exports = verificarTransbank;