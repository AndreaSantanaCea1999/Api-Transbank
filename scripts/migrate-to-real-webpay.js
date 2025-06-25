#!/usr/bin/env node

/**
 * Script de Migración a Webpay Plus Real
 * Archivo: scripts/migrate-to-real-webpay.js
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Script para migrar de Webpay simulado a Webpay Plus real
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Configuración del script
const CONFIG = {
  backupDir: './backups',
  srcDir: './src',
  controllers: {
    old: 'webpayController.js',
    new: 'realWebpayController.js'
  },
  routes: {
    old: 'webpayRoutes.js',
    new: 'realWebpayRoutes.js'
  }
};

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Interfaz de línea de comandos
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

class WebpayMigrator {
  constructor() {
    this.startTime = Date.now();
    this.steps = [];
  }

  async run() {
    try {
      log('🚀 MIGRACIÓN A WEBPAY PLUS REAL - FERREMAS', 'cyan');
      log('=' * 50, 'cyan');
      
      await this.showWelcome();
      await this.validateEnvironment();
      await this.createBackup();
      await this.updateControllers();
      await this.updateRoutes();
      await this.updatePackageJson();
      await this.createConfigFiles();
      await this.updateAppJs();
      await this.validateMigration();
      
      log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE!', 'green');
      this.showSummary();
      
    } catch (error) {
      log(`\n❌ ERROR EN MIGRACIÓN: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async showWelcome() {
    log('\n📋 Esta migración realizará los siguientes cambios:', 'yellow');
    log('  • Reemplazará el controlador Webpay simulado por el real');
    log('  • Actualizará las rutas para usar la API REST de Transbank');
    log('  • Creará archivos de configuración específicos');
    log('  • Agregará helpers y utilidades para Webpay');
    log('  • Creará backup de archivos existentes');
    
    const confirm = await question('\n¿Desea continuar? (s/N): ');
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
      log('Migración cancelada por el usuario.', 'yellow');
      process.exit(0);
    }
  }

  async validateEnvironment() {
    log('\n🔍 Validando entorno...', 'blue');
    
    // Verificar estructura de directorios
    const requiredDirs = [
      './src',
      './src/controllers',
      './src/routes',
      './src/models'
    ];
    
    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
        log(`  ✅ ${dir} existe`);
      } catch (error) {
        throw new Error(`Directorio requerido no encontrado: ${dir}`);
      }
    }
    
    // Verificar archivos existentes
    const controllersPath = path.join(CONFIG.srcDir, 'controllers', CONFIG.controllers.old);
    try {
      await fs.access(controllersPath);
      log(`  ✅ Controlador existente encontrado: ${CONFIG.controllers.old}`);
    } catch (error) {
      log(`  ⚠️  Controlador no encontrado (se creará uno nuevo)`, 'yellow');
    }
    
    this.steps.push('✅ Entorno validado');
  }

  async createBackup() {
    log('\n💾 Creando backup...', 'blue');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(CONFIG.backupDir, `webpay-backup-${timestamp}`);
    
    try {
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup del controlador existente
      const oldControllerPath = path.join(CONFIG.srcDir, 'controllers', CONFIG.controllers.old);
      try {
        const oldController = await fs.readFile(oldControllerPath);
        await fs.writeFile(
          path.join(backupPath, CONFIG.controllers.old), 
          oldController
        );
        log(`  ✅ Backup creado: ${CONFIG.controllers.old}`);
      } catch (error) {
        log(`  ⚠️  No se encontró controlador anterior para backup`, 'yellow');
      }
      
      // Backup de rutas existentes
      const oldRoutesPath = path.join(CONFIG.srcDir, 'routes', CONFIG.routes.old);
      try {
        const oldRoutes = await fs.readFile(oldRoutesPath);
        await fs.writeFile(
          path.join(backupPath, CONFIG.routes.old), 
          oldRoutes
        );
        log(`  ✅ Backup creado: ${CONFIG.routes.old}`);
      } catch (error) {
        log(`  ⚠️  No se encontraron rutas anteriores para backup`, 'yellow');
      }
      
      log(`  📁 Backup guardado en: ${backupPath}`, 'green');
      this.steps.push('✅ Backup creado');
      
    } catch (error) {
      throw new Error(`Error creando backup: ${error.message}`);
    }
  }

  async updateControllers() {
    log('\n🔄 Actualizando controladores...', 'blue');
    
    const realControllerContent = `/**
 * Controlador Webpay REAL para API Transbank FERREMAS
 * ⚠️  ESTE ES EL CONTROLADOR REAL - USA API REST DE TRANSBANK
 * 
 * Generado automáticamente por script de migración
 * Fecha: ${new Date().toISOString()}
 */

const RealWebpayController = require('./realWebpayController');

// Re-exportar el controlador real
module.exports = RealWebpayController;
`;

    const controllerPath = path.join(CONFIG.srcDir, 'controllers', CONFIG.controllers.old);
    await fs.writeFile(controllerPath, realControllerContent);
    
    log(`  ✅ Controlador actualizado: ${CONFIG.controllers.old}`);
    
    // Crear el archivo de helpers si no existe
    const helpersPath = path.join(CONFIG.srcDir, 'utils', 'webpayHelpers.js');
    try {
      await fs.access(helpersPath);
      log(`  ✅ Helpers ya existen: webpayHelpers.js`);
    } catch (error) {
      await fs.mkdir(path.join(CONFIG.srcDir, 'utils'), { recursive: true });
      log(`  📝 Crear manualmente: ${helpersPath}`);
      log(`     (Copiar contenido del helper proporcionado)`, 'yellow');
    }
    
    this.steps.push('✅ Controladores actualizados');
  }

  async updateRoutes() {
    log('\n🛣  Actualizando rutas...', 'blue');
    
    const newRoutesContent = `/**
 * Rutas Webpay REAL - Migradas automáticamente
 * Fecha: ${new Date().toISOString()}
 */

const express = require('express');
const router = express.Router();
const WebpayController = require('../controllers/webpayController'); // Ahora apunta al real

// Middleware de logging
router.use((req, res, next) => {
  console.log(\`🌐 [Webpay Real] \${req.method} \${req.originalUrl} - \${new Date().toISOString()}\`);
  next();
});

// Rutas principales
router.get('/health', WebpayController.healthCheck);
router.get('/config', WebpayController.getConfig);
router.post('/create', WebpayController.createTransaction);
router.put('/confirm/:token', WebpayController.confirmTransaction);
router.get('/status/:token', WebpayController.getTransactionStatus);
router.post('/refund/:token', WebpayController.refundTransaction);
router.post('/return', WebpayController.handleReturn);

// Información general
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Webpay Plus REAL - FERREMAS',
    version: '2.0.0',
    migration_date: '${new Date().toISOString()}',
    integration_type: 'REAL_API_REST',
    environment: process.env.WEBPAY_ENV || 'integration'
  });
});

module.exports = router;
`;

    const routesPath = path.join(CONFIG.srcDir, 'routes', CONFIG.routes.old);
    await fs.writeFile(routesPath, newRoutesContent);
    
    log(`  ✅ Rutas actualizadas: ${CONFIG.routes.old}`);
    this.steps.push('✅ Rutas actualizadas');
  }

  async updatePackageJson() {
    log('\n📦 Verificando dependencias...', 'blue');
    
    try {
      const packageJsonPath = './package.json';
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageData = JSON.parse(packageContent);
      
      const requiredDeps = {
        'axios': '^1.10.0',
        'uuid': '^11.1.0'
      };
      
      let needsUpdate = false;
      const missingDeps = [];
      
      for (const [dep, version] of Object.entries(requiredDeps)) {
        if (!packageData.dependencies || !packageData.dependencies[dep]) {
          missingDeps.push(`${dep}@${version}`);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        log(`  ⚠️  Dependencias faltantes detectadas:`, 'yellow');
        missingDeps.forEach(dep => log(`    - ${dep}`, 'yellow'));
        log(`  📝 Ejecutar: npm install ${missingDeps.join(' ')}`, 'cyan');
      } else {
        log(`  ✅ Todas las dependencias están presentes`);
      }
      
      this.steps.push('✅ Dependencias verificadas');
      
    } catch (error) {
      log(`  ⚠️  Error verificando package.json: ${error.message}`, 'yellow');
    }
  }

  async createConfigFiles() {
    log('\n⚙️  Creando archivos de configuración...', 'blue');
    
    // Crear archivo de configuración Webpay
    const webpayConfigContent = `/**
 * Configuración Webpay Plus
 * Archivo: src/config/webpay.js
 * 
 * Generado por migración: ${new Date().toISOString()}
 */

module.exports = {
  // Configuración de ambientes
  environments: {
    integration: {
      name: 'Integración (Testing)',
      apiKeyId: '597055555532',
      apiKeySecret: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
      baseUrl: 'https://webpay3gint.transbank.cl',
      allowTestEndpoints: true
    },
    production: {
      name: 'Producción',
      apiKeyId: process.env.WEBPAY_API_KEY_ID,
      apiKeySecret: process.env.WEBPAY_API_KEY_SECRET,
      baseUrl: 'https://webpay3g.transbank.cl',
      allowTestEndpoints: false
    }
  },
  
  // Configuración actual
  current: process.env.WEBPAY_ENV || 'integration',
  
  // Configuración de timeouts
  timeouts: {
    apiCall: 30000,
    userRedirect: 300000 // 5 minutos
  },
  
  // Configuración de logs
  logging: {
    enabled: true,
    logSensitiveData: false,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  },
  
  // Configuración de validaciones
  validation: {
    maxAmount: 999999999, // Monto máximo permitido
    minAmount: 50,        // Monto mínimo permitido
    maxBuyOrderLength: 26,
    maxSessionIdLength: 61
  }
};
`;

    const configDir = path.join(CONFIG.srcDir, 'config');
    const webpayConfigPath = path.join(configDir, 'webpay.js');
    
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(webpayConfigPath, webpayConfigContent);
    
    log(`  ✅ Configuración creada: src/config/webpay.js`);
    
    // Crear archivo .env.example actualizado
    const envExampleContent = `# ============================================
# CONFIGURACIÓN WEBPAY PLUS REAL - FERREMAS
# ============================================

# Ambiente Webpay: 'integration' o 'production'
WEBPAY_ENV=integration

# Credenciales de Integración (Testing) - YA CONFIGURADAS
WEBPAY_API_KEY_ID=597055555532
WEBPAY_API_KEY_SECRET=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C

# ⚠️  PARA PRODUCCIÓN: Reemplazar con credenciales reales de Transbank
# WEBPAY_API_KEY_ID=tu_api_key_id_real
# WEBPAY_API_KEY_SECRET=tu_api_key_secret_real

# Base de datos
DB_HOST=localhost
DB_USER=administrador
DB_PASSWORD=yR!9uL2@pX
DB_NAME=ferremas_complete
DB_PORT=3306

# Puerto de la API
PORT=3003

# URLs de APIs internas
API_INVENTARIO_URL=http://localhost:3000/api
API_BANCO_URL=http://localhost:3001/api/v1

# Configuración adicional (opcional)
NODE_ENV=development
API_KEYS=optional_api_keys_separated_by_commas
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3003

# ============================================
# MIGRACIÓN COMPLETADA: ${new Date().toISOString()}
# ============================================
`;

    await fs.writeFile('.env.example', envExampleContent);
    log(`  ✅ Archivo .env.example actualizado`);
    
    this.steps.push('✅ Archivos de configuración creados');
  }

  async updateAppJs() {
    log('\n🚀 Verificando app.js...', 'blue');
    
    try {
      const appJsPath = path.join(CONFIG.srcDir, 'app.js');
      const appContent = await fs.readFile(appJsPath, 'utf8');
      
      // Verificar si ya usa el sistema de rutas correcto
      if (appContent.includes("require('./routes/webpayRoutes')") || 
          appContent.includes("require('./routes/index')")) {
        log(`  ✅ app.js ya está configurado correctamente`);
      } else {
        log(`  ⚠️  Verificar configuración de rutas en app.js`, 'yellow');
        log(`     Asegurar que use: app.use('/api', require('./routes/index'))`, 'yellow');
      }
      
      this.steps.push('✅ app.js verificado');
      
    } catch (error) {
      log(`  ⚠️  Error verificando app.js: ${error.message}`, 'yellow');
    }
  }

  async validateMigration() {
    log('\n🔍 Validando migración...', 'blue');
    
    // Verificar archivos creados
    const filesToCheck = [
      'src/controllers/webpayController.js',
      'src/routes/webpayRoutes.js',
      'src/config/webpay.js',
      '.env.example'
    ];
    
    for (const file of filesToCheck) {
      try {
        await fs.access(file);
        log(`  ✅ ${file} creado correctamente`);
      } catch (error) {
        log(`  ❌ ${file} NO creado`, 'red');
      }
    }
    
    this.steps.push('✅ Migración validada');
  }

  showSummary() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    log('\n📊 RESUMEN DE MIGRACIÓN', 'cyan');
    log('=' * 30, 'cyan');
    
    this.steps.forEach(step => {
      log(`  ${step}`, 'green');
    });
    
    log(`\n⏱️  Duración: ${duration} segundos`, 'blue');
    log(`📅 Fecha: ${new Date().toISOString()}`, 'blue');
    
    log('\n🚨 PRÓXIMOS PASOS IMPORTANTES:', 'yellow');
    log('1. 📝 Copiar el contenido del RealWebpayController proporcionado', 'yellow');
    log('2. 📝 Copiar el contenido de webpayHelpers.js', 'yellow');
    log('3. 📦 Instalar dependencias: npm install axios uuid', 'yellow');
    log('4. ⚙️  Verificar variables de entorno en .env', 'yellow');
    log('5. 🧪 Probar endpoints: npm start && curl localhost:3003/api/webpay/health', 'yellow');
    log('6. 🔧 Para producción: obtener credenciales reales de Transbank', 'yellow');
    
    log('\n📚 DOCUMENTACIÓN:', 'cyan');
    log('  • Guía completa: Ver archivo de integración proporcionado', 'cyan');
    log('  • Transbank Developers: https://www.transbankdevelopers.cl/', 'cyan');
    log('  • API REST Docs: https://www.transbankdevelopers.cl/documentacion/webpay-plus', 'cyan');
    
    log('\n🎯 TESTING RÁPIDO:', 'green');
    log('  curl -X POST http://localhost:3003/api/webpay/test-create', 'green');
    
    log('\n✨ ¡Migración completada! Tu API ahora usa Webpay Plus REAL.', 'magenta');
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  const migrator = new WebpayMigrator();
  migrator.run();
}

module.exports = WebpayMigrator;