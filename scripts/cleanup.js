const limpiarDatosPrueba = async () => {
  console.log('🧹 Limpiando datos de prueba...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Limpiar transacciones de prueba (que contengan 'TEST' o 'SIMU')
    const [transacciones] = await connection.execute(`
      DELETE FROM transbank_logs 
      WHERE ID_Transaccion IN (
        SELECT ID_Transaccion FROM transbank_transacciones 
        WHERE Session_ID LIKE '%TEST%' OR Token_Transbank LIKE '%SIMU%'
      )
    `);

    const [detalles] = await connection.execute(`
      DELETE FROM transbank_detalle_transacciones 
      WHERE ID_Transaccion IN (
        SELECT ID_Transaccion FROM transbank_transacciones 
        WHERE Session_ID LIKE '%TEST%' OR Token_Transbank LIKE '%SIMU%'
      )
    `);

    const [transaccionesMain] = await connection.execute(`
      DELETE FROM transbank_transacciones 
      WHERE Session_ID LIKE '%TEST%' OR Token_Transbank LIKE '%SIMU%'
    `);

    console.log(`✅ ${transaccionesMain.affectedRows} transacciones de prueba eliminadas`);
    console.log(`✅ ${detalles.affectedRows} detalles eliminados`);
    console.log(`✅ ${transacciones.affectedRows} logs eliminados`);

    await connection.end();
    console.log('\n✅ Limpieza completada');

  } catch (error) {
    console.error('❌ Error durante limpieza:', error.message);
    throw error;
  }
};

// Exportar funciones
module.exports = {
  verificarTransbank,
  testIntegracionCompleta,
  seedTransbankData,
  limpiarDatosPrueba
};

// Ejecutar según el comando
if (require.main === module) {
  const comando = process.argv[2];
  
  switch (comando) {
    case 'verify':
      verificarTransbank();
      break;
    case 'test':
      testIntegracionCompleta();
      break;
    case 'seed':
      seedTransbankData();
      break;
    case 'cleanup':
      limpiarDatosPrueba();
      break;
    default:
      console.log('Comandos disponibles:');
      console.log('  node scripts/verify-transbank.js verify   - Verificar configuración');
      console.log('  node scripts/verify-transbank.js test     - Probar integración');
      console.log('  node scripts/verify-transbank.js seed     - Insertar datos de prueba');
      console.log('  node scripts/verify-transbank.js cleanup  - Limpiar datos de prueba');
  }
}