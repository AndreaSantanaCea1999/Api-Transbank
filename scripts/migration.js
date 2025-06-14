const { sequelize } = require('../src/config/database');
const logger = require('../src/utils/logger');

/**
 * Migrar datos de versiones anteriores
 */
const migrarDatos = async () => {
  console.log('🔄 Iniciando migración de datos...\n');

  try {
    // Verificar si es necesario migrar
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'transbank_transacciones'
    `, {
      replacements: [process.env.DB_NAME]
    });

    if (results[0].count === 0) {
      console.log('❌ Tablas de Transbank no encontradas. Ejecute primero el script de creación.');
      return false;
    }

    // Migración 1: Actualizar estados de transacciones antiguas
    console.log('1️⃣ Actualizando estados de transacciones...');
    await sequelize.query(`
      UPDATE transbank_transacciones t
      JOIN transbank_estados_transaccion e ON e.Codigo_Estado = 'EXPR'
      SET t.ID_Estado = e.ID_Estado
      WHERE t.Fecha_Vencimiento < NOW() 
      AND t.ID_Estado IN (
        SELECT ID_Estado FROM transbank_estados_transaccion 
        WHERE Codigo_Estado IN ('INIT', 'PEND')
      )
    `);

    // Migración 2: Limpiar transacciones de prueba obsoletas
    console.log('2️⃣ Limpiando transacciones de prueba obsoletas...');
    await sequelize.query(`
      DELETE FROM transbank_logs 
      WHERE Fecha_Log < DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND Accion LIKE '%TEST%'
    `);

    // Migración 3: Optimizar índices
    console.log('3️⃣ Optimizando índices...');
    try {
      await sequelize.query(`
        ALTER TABLE transbank_transacciones 
        ADD INDEX idx_fecha_estado (Fecha_Creacion, ID_Estado)
      `);
    } catch (error) {
      // Índice ya existe, continuar
    }

    console.log('✅ Migración completada exitosamente\n');
    return true;

  } catch (error) {
    logger.error('Error durante migración:', error);
    console.error('❌ Error durante migración:', error.message);
    return false;
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrarDatos()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { migrarDatos };
