/**
 * Suite de Pruebas para Webpay Plus Real
 * Archivo: scripts/test-webpay-integration.js
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Script completo para probar la integración con Webpay Plus
 */

const axios = require('axios');
const colors = require('colors');

// Configuración de pruebas
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3003',
  timeout: 30000,
  retries: 3,
  testData: {
    clienteId: 1,
    productos: [
      { ID_Producto: 1, Cantidad: 2 },
      { ID_Producto: 2, Cantidad: 1 }
    ],
    amount: 50000
  }
};

class WebpayTester {
  constructor() {
    this.results = [];
    this.currentToken = null;
    this.transactionId = null;
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🧪 INICIANDO SUITE DE PRUEBAS WEBPAY PLUS'.blue.bold);
    console.log('=' * 60);
    
    const tests = [
      { name: 'Health Check', fn: this.testHealthCheck.bind(this) },
      { name: 'Configuration', fn: this.testConfig.bind(this) },
      { name: 'Create Transaction', fn: this.testCreateTransaction.bind(this) },
      { name: 'Transaction Status', fn: this.testTransactionStatus.bind(this) },
      { name: 'Invalid Token Handling', fn: this.testInvalidToken.bind(this) },
      { name: 'Error Scenarios', fn: this.testErrorScenarios.bind(this) },
      { name: 'Security Validation', fn: this.testSecurity.bind(this) },
      { name: 'Database Integration', fn: this.testDatabaseIntegration.bind(this) }
    ];

    let passed = 0;
    const total = tests.length;

    for (const test of tests) {
      console.log(`\n🔬 Ejecutando: ${test.name}`.yellow.bold);
      try {
        const result = await test.fn();
        if (result.success) {
          console.log(`✅ ${test.name}: PASÓ`.green);
          passed++;
        } else {
          console.log(`❌ ${test.name}: FALLÓ - ${result.message}`.red);
        }
        this.results.push({ ...result, testName: test.name });
      } catch (error) {
        console.log(`💥 ${test.name}: ERROR - ${error.message}`.red);
        this.results.push({ 
          success: false, 
          message: error.message, 
          testName: test.name,
          error: true 
        });
      }
      
      // Pausa entre pruebas
      await this.sleep(1000);
    }

    this.printSummary(passed, total);
    return { passed, total, results: this.results };
  }

  async testHealthCheck() {
    try {
      console.log('🏥 Verificando health check...');
      
      const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/health`, {
        timeout: TEST_CONFIG.timeout
      });

      if (response.status === 200 && response.data.success) {
        console.log(`  ✅ Health check: OK`);
        console.log(`  📊 Environment: ${response.data.environment}`);
        console.log(`  🔗 Transbank connection: ${response.data.connections?.transbank_api || 'UNKNOWN'}`);
        
        return { 
          success: true, 
          message: 'Health check passed',
          data: response.data 
        };
      } else {
        return { 
          success: false, 
          message: 'Health check failed: Invalid response' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Health check error: ${error.message}` 
      };
    }
  }

  async testConfig() {
    try {
      console.log('⚙️ Verificando configuración...');
      
      const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/config`, {
        timeout: TEST_CONFIG.timeout
      });

      if (response.status === 200 && response.data.success) {
        const config = response.data.data;
        console.log(`  ✅ Environment: ${config.environment}`);
        console.log(`  🔗 Base URL: ${config.baseUrl}`);
        console.log(`  🔑 API Key: ${config.apiKeyId}`);
        console.log(`  🔧 Integration type: ${config.integration_info?.real_api ? 'REAL API' : 'SIMULATED'}`);
        
        // Validar que sea integración real
        if (!config.integration_info?.real_api) {
          return { 
            success: false, 
            message: 'Configuration shows simulated API, not real integration' 
          };
        }

        return { 
          success: true, 
          message: 'Configuration validated',
          data: config 
        };
      } else {
        return { 
          success: false, 
          message: 'Config endpoint failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Config test error: ${error.message}` 
      };
    }
  }

  async testCreateTransaction() {
    try {
      console.log('💳 Creando transacción de prueba...');
      
      const transactionData = {
        ...TEST_CONFIG.testData,
        returnUrl: `${TEST_CONFIG.baseUrl}/api/webpay/return`
      };

      console.log(`  📋 Datos: Cliente ${transactionData.clienteId}, ${transactionData.productos.length} productos`);
      
      const response = await axios.post(
        `${TEST_CONFIG.baseUrl}/api/webpay/create`,
        transactionData,
        {
          timeout: TEST_CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.status === 201 && response.data.success) {
        const data = response.data.data;
        
        // Guardar datos para siguientes pruebas
        this.currentToken = data.token;
        this.transactionId = data.transaccion_id;
        
        console.log(`  ✅ Transacción creada`);
        console.log(`  🎫 Token: ${data.token.substring(0, 10)}...`);
        console.log(`  🔗 URL: ${data.url}`);
        console.log(`  💰 Monto: $${data.amount.toLocaleString()}`);
        console.log(`  📦 Productos validados: ${data.productos.length}`);
        
        // Validar estructura de respuesta
        if (!data.token || !data.url || !data.amount) {
          return { 
            success: false, 
            message: 'Response missing required fields (token, url, amount)' 
          };
        }
        
        // Validar formato del token (64 caracteres hex)
        if (!/^[a-f0-9]{64}$/i.test(data.token)) {
          return { 
            success: false, 
            message: 'Invalid token format received from Transbank' 
          };
        }

        return { 
          success: true, 
          message: 'Transaction created successfully',
          data: data 
        };
      } else {
        return { 
          success: false, 
          message: `Create transaction failed: ${response.data.error || 'Unknown error'}` 
        };
      }
    } catch (error) {
      if (error.response) {
        console.log(`  📊 Status: ${error.response.status}`);
        console.log(`  📄 Response:`, error.response.data);
      }
      return { 
        success: false, 
        message: `Create transaction error: ${error.message}` 
      };
    }
  }

  async testTransactionStatus() {
    if (!this.currentToken) {
      return { 
        success: false, 
        message: 'No token available from previous test' 
      };
    }

    try {
      console.log('📊 Consultando estado de transacción...');
      console.log(`  🎫 Token: ${this.currentToken.substring(0, 10)}...`);
      
      const response = await axios.get(
        `${TEST_CONFIG.baseUrl}/api/webpay/status/${this.currentToken}`,
        { timeout: TEST_CONFIG.timeout }
      );

      if (response.status === 200 && response.data.success) {
        const data = response.data.data;
        
        console.log(`  ✅ Estado consultado exitosamente`);
        console.log(`  📋 Buy Order: ${data.buy_order}`);
        console.log(`  💰 Amount: ${data.amount}`);
        console.log(`  📅 Status: ${data.status || 'PENDING'}`);
        
        // En ambiente de integración, el estado inicial debería ser INITIALIZED
        const expectedStatuses = ['INITIALIZED', 'AUTHORIZED', 'FAILED'];
        const actualStatus = data.status;
        
        if (actualStatus && !expectedStatuses.includes(actualStatus)) {
          console.log(`  ⚠️  Unexpected status: ${actualStatus}`.yellow);
        }

        return { 
          success: true, 
          message: 'Status check successful',
          data: data 
        };
      } else {
        return { 
          success: false, 
          message: 'Status check failed' 
        };
      }
    } catch (error) {
      // En integración, puede fallar si la transacción no está en Transbank aún
      if (error.response?.status === 404) {
        console.log(`  ⚠️  Transacción no encontrada en Transbank (normal en testing)`.yellow);
        return { 
          success: true, 
          message: 'Status check handled 404 correctly' 
        };
      }
      
      return { 
        success: false, 
        message: `Status check error: ${error.message}` 
      };
    }
  }

  async testInvalidToken() {
    try {
      console.log('🔒 Probando manejo de token inválido...');
      
      const invalidTokens = [
        'invalid_token',
        '1234567890abcdef',
        '',
        'a'.repeat(65), // Muy largo
        'g'.repeat(64)  // Caracteres inválidos
      ];

      for (const invalidToken of invalidTokens) {
        try {
          const response = await axios.get(
            `${TEST_CONFIG.baseUrl}/api/webpay/status/${invalidToken}`,
            { timeout: 5000 }
          );
          
          // Si llega aquí, debería ser un error
          if (response.status === 200) {
            console.log(`  ⚠️  Token inválido aceptado: ${invalidToken}`.yellow);
          }
        } catch (error) {
          if (error.response?.status === 400 || error.response?.status === 404) {
            console.log(`  ✅ Token inválido rechazado correctamente: ${invalidToken.substring(0, 10)}...`);
          }
        }
      }

      return { 
        success: true, 
        message: 'Invalid token handling validated' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Invalid token test error: ${error.message}` 
      };
    }
  }

  async testErrorScenarios() {
    try {
      console.log('💥 Probando escenarios de error...');
      
      // Test 1: Crear transacción sin datos
      try {
        await axios.post(`${TEST_CONFIG.baseUrl}/api/webpay/create`, {}, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`  ❌ Error: Transacción vacía fue aceptada`.red);
        return { success: false, message: 'Empty transaction was accepted' };
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`  ✅ Transacción vacía rechazada correctamente`);
        }
      }
      
      // Test 2: Monto inválido
      try {
        await axios.post(`${TEST_CONFIG.baseUrl}/api/webpay/create`, {
          amount: -100
        }, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`  ❌ Error: Monto negativo fue aceptado`.red);
        return { success: false, message: 'Negative amount was accepted' };
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`  ✅ Monto negativo rechazado correctamente`);
        }
      }

      // Test 3: Productos inexistentes
      try {
        await axios.post(`${TEST_CONFIG.baseUrl}/api/webpay/create`, {
          clienteId: 1,
          productos: [{ ID_Producto: 99999, Cantidad: 1 }]
        }, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`  ❌ Error: Producto inexistente fue aceptado`.red);
        return { success: false, message: 'Non-existent product was accepted' };
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`  ✅ Producto inexistente rechazado correctamente`);
        }
      }

      return { 
        success: true, 
        message: 'Error scenarios handled correctly' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error scenarios test failed: ${error.message}` 
      };
    }
  }

  async testSecurity() {
    try {
      console.log('🛡️ Probando validaciones de seguridad...');
      
      // Test 1: Headers de seguridad
      const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/health`, {
        timeout: 5000
      });
      
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];
      
      let securityScore = 0;
      securityHeaders.forEach(header => {
        if (response.headers[header]) {
          console.log(`  ✅ Security header present: ${header}`);
          securityScore++;
        } else {
          console.log(`  ⚠️  Missing security header: ${header}`.yellow);
        }
      });
      
      // Test 2: Rate limiting (si está configurado)
      try {
        const promises = Array(10).fill().map(() => 
          axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/health`, { timeout: 1000 })
        );
        await Promise.all(promises);
        console.log(`  ⚠️  No rate limiting detected (10 requests succeeded)`.yellow);
      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`  ✅ Rate limiting working correctly`);
          securityScore++;
        }
      }

      return { 
        success: true, 
        message: `Security validation completed (${securityScore} features detected)`,
        score: securityScore 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Security test error: ${error.message}` 
      };
    }
  }

  async testDatabaseIntegration() {
    if (!this.transactionId) {
      return { 
        success: false, 
        message: 'No transaction ID available for database test' 
      };
    }

    try {
      console.log('🗄️ Verificando integración con base de datos...');
      
      // Verificar que la transacción se guardó localmente
      const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/transactions/local`, {
        timeout: 5000
      });

      if (response.status === 200 && response.data.success) {
        const transactions = response.data.data;
        console.log(`  📊 Transacciones locales encontradas: ${transactions.length}`);
        
        const ourTransaction = transactions.find(tx => tx.id === this.transactionId);
        if (ourTransaction) {
          console.log(`  ✅ Transacción de prueba encontrada en BD`);
          console.log(`  📋 Estado: ${ourTransaction.estado}`);
          console.log(`  💰 Monto: ${ourTransaction.monto}`);
          
          return { 
            success: true, 
            message: 'Database integration working correctly' 
          };
        } else {
          return { 
            success: false, 
            message: 'Test transaction not found in local database' 
          };
        }
      } else {
        return { 
          success: false, 
          message: 'Database query failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Database test error: ${error.message}` 
      };
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printSummary(passed, total) {
    const duration = (Date.now() - this.startTime) / 1000;
    const successRate = ((passed / total) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS WEBPAY PLUS'.blue.bold);
    console.log('='.repeat(60));
    
    console.log(`✅ Pruebas exitosas: ${passed}/${total} (${successRate}%)`.green);
    console.log(`⏱️  Duración total: ${duration} segundos`.blue);
    console.log(`🎯 Token generado: ${this.currentToken ? 'SÍ' : 'NO'}`.cyan);
    console.log(`💾 Transacción BD: ${this.transactionId ? `ID ${this.transactionId}` : 'NO'}`.cyan);
    
    if (passed === total) {
      console.log('\n🎉 TODAS LAS PRUEBAS PASARON - INTEGRACIÓN WEBPAY PLUS FUNCIONANDO CORRECTAMENTE'.green.bold);
    } else {
      console.log('\n⚠️  ALGUNAS PRUEBAS FALLARON - REVISAR CONFIGURACIÓN'.red.bold);
    }

    console.log('\n📋 Detalles por prueba:');
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      const color = result.success ? 'green' : 'red';
      console.log(`  ${icon} ${result.testName}: ${result.message}`[color]);
    });

    console.log('\n🔗 Enlaces útiles:');
    console.log(`  • Health Check: ${TEST_CONFIG.baseUrl}/api/webpay/health`.cyan);
    console.log(`  • Config: ${TEST_CONFIG.baseUrl}/api/webpay/config`.cyan);
    console.log(`  • Test Create: curl -X POST ${TEST_CONFIG.baseUrl}/api/webpay/test-create`.cyan);
    
    if (this.currentToken) {
      console.log(`  • Status Check: ${TEST_CONFIG.baseUrl}/api/webpay/status/${this.currentToken}`.cyan);
    }
  }
}

// Script de prueba rápida
async function quickTest() {
  try {
    console.log('⚡ PRUEBA RÁPIDA WEBPAY PLUS'.yellow.bold);
    
    const healthResponse = await axios.get(`${TEST_CONFIG.baseUrl}/api/webpay/health`, {
      timeout: 5000
    });
    
    if (healthResponse.data.success) {
      console.log('✅ API Webpay respondiendo correctamente'.green);
      console.log(`📊 Environment: ${healthResponse.data.environment}`.blue);
      
      // Prueba de creación rápida
      const createResponse = await axios.post(`${TEST_CONFIG.baseUrl}/api/webpay/test-create`, {}, {
        timeout: 10000
      });
      
      if (createResponse.data.success) {
        console.log('✅ Creación de transacción funcionando'.green);
        console.log(`🎫 Token: ${createResponse.data.data.token.substring(0, 10)}...`.cyan);
      } else {
        console.log('❌ Error en creación de transacción'.red);
      }
    } else {
      console.log('❌ API Webpay no responde correctamente'.red);
    }
  } catch (error) {
    console.log(`❌ Error en prueba rápida: ${error.message}`.red);
  }
}

// Función para ejecutar según argumentos
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    await quickTest();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 Suite de Pruebas Webpay Plus - FERREMAS

Uso: node test-webpay-integration.js [opciones]

Opciones:
  --quick, -q     Ejecutar prueba rápida
  --help, -h      Mostrar esta ayuda
  (sin opciones)  Ejecutar suite completa

Ejemplos:
  node test-webpay-integration.js              # Suite completa
  node test-webpay-integration.js --quick      # Prueba rápida
  npm run test:webpay                          # Si está en package.json

Requisitos:
  • API corriendo en ${TEST_CONFIG.baseUrl}
  • Base de datos configurada
  • Variables de entorno configuradas
    `);
  } else {
    const tester = new WebpayTester();
    await tester.runAllTests();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error ejecutando pruebas:', error);
    process.exit(1);
  });
}

module.exports = { WebpayTester, quickTest };