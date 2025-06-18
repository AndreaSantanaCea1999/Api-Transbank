// ====================================
// SCRIPT DE TESTING INTEGRAL
// ====================================

const axios = require('axios');
const colors = require('colors');

// Configuración de URLs
const APIS = {
  inventario: 'http://localhost:3000/api',
  banco: 'http://localhost:3001/api/v1',
  transbank: 'http://localhost:3003/api/transbank'
};

// Datos de prueba
const TEST_DATA = {
  cliente: {
    clienteId: 1,
    ordenCompra: `TEST-${Date.now()}`,
    monto: 75000,
    divisa: 'CLP',
    detalles: [
      { ID_Producto: 1, Cantidad: 2, Precio_Unitario: 25000 },
      { ID_Producto: 2, Cantidad: 1, Precio_Unitario: 25000 }
    ]
  }
};

class IntegrationTester {
  constructor() {
    this.results = [];
    this.transactionId = null;
  }

  async log(step, message, status = 'info') {
    const timestamp = new Date().toISOString();
    const statusIcon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'warning' ? '⚠️' : 'ℹ️';
    
    console.log(`${statusIcon} [${step}] ${message}`);
    
    this.results.push({
      timestamp,
      step,
      message,
      status
    });
  }

  async testApiHealth(apiName, url) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      await this.log(`HEALTH-${apiName.toUpperCase()}`, `API ${apiName} respondiendo correctamente`, 'success');
      return true;
    } catch (error) {
      await this.log(`HEALTH-${apiName.toUpperCase()}`, `API ${apiName} no responde: ${error.message}`, 'error');
      return false;
    }
  }

  async testInventoryStock() {
    try {
      // Verificar stock de productos de prueba
      for (const item of TEST_DATA.cliente.detalles) {
        const response = await axios.get(`${APIS.inventario}/inventario/producto/${item.ID_Producto}`);
        
        if (response.data && response.data.Stock_Actual >= item.Cantidad) {
          await this.log('STOCK-CHECK', `Producto ${item.ID_Producto}: Stock OK (${response.data.Stock_Actual} disponible)`, 'success');
        } else {
          await this.log('STOCK-CHECK', `Producto ${item.ID_Producto}: Stock insuficiente (${response.data?.Stock_Actual || 0} disponible, ${item.Cantidad} requerido)`, 'warning');
        }
      }
      return true;
    } catch (error) {
      await this.log('STOCK-CHECK', `Error verificando stock: ${error.message}`, 'error');
      return false;
    }
  }

  async testCreateTransaction() {
    try {
      const response = await axios.post(`${APIS.transbank}/iniciar`, TEST_DATA.cliente, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.data.success && response.data.transaccion) {
        this.transactionId = response.data.transaccion.id;
        await this.log('CREATE-TX', `Transacción creada exitosamente con ID: ${this.transactionId}`, 'success');
        return true;
      } else {
        await this.log('CREATE-TX', 'Error en respuesta de creación de transacción', 'error');
        return false;
      }
    } catch (error) {
      await this.log('CREATE-TX', `Error creando transacción: ${error.message}`, 'error');
      return false;
    }
  }

  async testTransactionDetails() {
    if (!this.transactionId) {
      await this.log('TX-DETAILS', 'No hay ID de transacción para registrar detalles', 'error');
      return false;
    }

    try {
      const response = await axios.post(`${APIS.transbank}/detalle`, {
        id_transaccion: this.transactionId,
        detalles: TEST_DATA.cliente.detalles
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.data.success) {
        await this.log('TX-DETAILS', 'Detalles de transacción registrados exitosamente', 'success');
        return true;
      } else {
        await this.log('TX-DETAILS', 'Error registrando detalles de transacción', 'error');
        return false;
      }
    } catch (error) {
      await this.log('TX-DETAILS', `Error registrando detalles: ${error.message}`, 'error');
      return false;
    }
  }

  async testConfirmTransaction() {
    if (!this.transactionId) {
      await this.log('CONFIRM-TX', 'No hay ID de transacción para confirmar', 'error');
      return false;
    }

    try {
      const response = await axios.post(`${APIS.transbank}/confirmar`, {
        id_transaccion: this.transactionId
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 // Más tiempo para confirmar
      });

      if (response.data.success) {
        await this.log('CONFIRM-TX', 'Transacción confirmada exitosamente', 'success');
        await this.log('CONFIRM-TX', `Pago registrado: ${response.data.data.pago_registrado ? 'Sí' : 'No'}`, 'info');
        await this.log('CONFIRM-TX', `Pedido creado: ${response.data.data.pedido_creado ? 'Sí' : 'No'}`, 'info');
        return true;
      } else {
        await this.log('CONFIRM-TX', 'Error confirmando transacción', 'error');
        return false;
      }
    } catch (error) {
      await this.log('CONFIRM-TX', `Error confirmando transacción: ${error.message}`, 'error');
      return false;
    }
  }

  async testTransactionStatus() {
    if (!this.transactionId) {
      await this.log('TX-STATUS', 'No hay ID de transacción para verificar estado', 'error');
      return false;
    }

    try {
      const response = await axios.get(`${APIS.transbank}/estado/${this.transactionId}`);

      if (response.data.success && response.data.transaccion) {
        const tx = response.data.transaccion;
        await this.log('TX-STATUS', `Estado: ${tx.estado?.nombre || 'Desconocido'}`, 'info');
        await this.log('TX-STATUS', `Monto: ${tx.monto} ${tx.divisa}`, 'info');
        await this.log('TX-STATUS', `Items: ${tx.total_items || 0}`, 'info');
        return true;
      } else {
        await this.log('TX-STATUS', 'Error obteniendo estado de transacción', 'error');
        return false;
      }
    } catch (error) {
      await this.log('TX-STATUS', `Error obteniendo estado: ${error.message}`, 'error');
      return false;
    }
  }

  async testSystemHealth() {
    try {
      const response = await axios.get(`${APIS.transbank}/health`);
      
      if (response.data.success) {
        await this.log('SYSTEM-HEALTH', 'Sistema completamente saludable', 'success');
      } else {
        await this.log('SYSTEM-HEALTH', 'Algunas integraciones fallan', 'warning');
      }

      // Mostrar detalles de cada servicio
      if (response.data.servicios) {
        Object.entries(response.data.servicios).forEach(([service, info]) => {
          const status = info.status === 'UP' ? 'success' : 'error';
          this.log('HEALTH-DETAIL', `${service}: ${info.status}`, status);
        });
      }

      return true;
    } catch (error) {
      await this.log('SYSTEM-HEALTH', `Error verificando salud del sistema: ${error.message}`, 'error');
      return false;
    }
  }

  async testSystemStats() {
    try {
      const response = await axios.get(`${APIS.transbank}/stats`);
      
      if (response.data.success && response.data.estadisticas) {
        const stats = response.data.estadisticas;
        await this.log('STATS', `Total transacciones: ${stats.total_transacciones}`, 'info');
        await this.log('STATS', `Transacciones aprobadas: ${stats.transacciones_aprobadas}`, 'info');
        await this.log('STATS', `Tasa de aprobación: ${stats.tasa_aprobacion}`, 'info');
        await this.log('STATS', `Monto total aprobado: $${stats.monto_total_aprobado}`, 'info');
        return true;
      } else {
        await this.log('STATS', 'Error obteniendo estadísticas', 'error');
        return false;
      }
    } catch (error) {
      await this.log('STATS', `Error obteniendo estadísticas: ${error.message}`, 'error');
      return false;
    }
  }

  async runFullTest() {
    console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN FERREMAS'.blue.bold);
    console.log('=' * 60);
    
    const tests = [
      { name: 'APIs Health Check', fn: this.testApisHealth.bind(this) },
      { name: 'Inventory Stock Check', fn: this.testInventoryStock.bind(this) },
      { name: 'Create Transaction', fn: this.testCreateTransaction.bind(this) },
      { name: 'Transaction Details', fn: this.testTransactionDetails.bind(this) },
      { name: 'Confirm Transaction', fn: this.testConfirmTransaction.bind(this) },
      { name: 'Transaction Status', fn: this.testTransactionStatus.bind(this) },
      { name: 'System Health', fn: this.testSystemHealth.bind(this) },
      { name: 'System Statistics', fn: this.testSystemStats.bind(this) }
    ];

    let passed = 0;
    let total = tests.length;

    for (const test of tests) {
      console.log(`\n🧪 Ejecutando: ${test.name}`.yellow.bold);
      try {
        const result = await test.fn();
        if (result) {
          passed++;
        }
      } catch (error) {
        await this.log(test.name, `Error inesperado: ${error.message}`, 'error');
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre tests
    }

    this.printSummary(passed, total);
  }

  async testApisHealth() {
    const healthChecks = [
      { name: 'inventario', url: `${APIS.inventario}/productos` },
      { name: 'banco', url: `${APIS.banco}/` },
      { name: 'transbank', url: `${APIS.transbank}/` }
    ];

    let healthyApis = 0;
    for (const api of healthChecks) {
      const isHealthy = await this.testApiHealth(api.name, api.url);
      if (isHealthy) healthyApis++;
    }

    return healthyApis === healthChecks.length;
  }

  printSummary(passed, total) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS'.blue.bold);
    console.log('='.repeat(60));
    
    const successRate = ((passed / total) * 100).toFixed(1);
    console.log(`✅ Pruebas exitosas: ${passed}/${total} (${successRate}%)`);
    
    if (passed === total) {
      console.log('🎉 TODAS LAS PRUEBAS PASARON - SISTEMA INTEGRADO CORRECTAMENTE'.green.bold);
    } else {
      console.log('⚠️  ALGUNAS PRUEBAS FALLARON - REVISAR CONFIGURACIÓN'.red.bold);
    }

    if (this.transactionId) {
      console.log(`\n💳 ID de transacción de prueba: ${this.transactionId}`);
    }

    console.log('\n📋 Log detallado:');
    this.results.forEach(result => {
      const color = result.status === 'success' ? 'green' : 
                   result.status === 'error' ? 'red' : 
                   result.status === 'warning' ? 'yellow' : 'white';
      console.log(`  ${result.timestamp} [${result.step}] ${result.message}`[color]);
    });
  }
}

// Ejecutar pruebas si se llama directamente
async function main() {
  const tester = new IntegrationTester();
  
  // Manejar argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Uso: node test_integration.js [opciones]

Opciones:
  --health    Solo verificar salud de APIs
  --quick     Prueba rápida (sin confirmación completa)
  --help      Mostrar esta ayuda

Ejemplos:
  node test_integration.js              # Prueba completa
  node test_integration.js --health     # Solo health check
  node test_integration.js --quick      # Prueba rápida
    `);
    return;
  }

  if (args.includes('--health')) {
    console.log('🏥 Verificando salud de APIs...'.blue.bold);
    await tester.testApisHealth();
    await tester.testSystemHealth();
    return;
  }

  if (args.includes('--quick')) {
    console.log('⚡ Ejecutando prueba rápida...'.blue.bold);
    await tester.testApisHealth();
    await tester.testInventoryStock();
    await tester.testCreateTransaction();
    await tester.testTransactionStatus();
    return;
  }

  // Prueba completa por defecto
  await tester.runFullTest();
}

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando pruebas:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTester;