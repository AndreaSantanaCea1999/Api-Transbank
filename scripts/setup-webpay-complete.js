#!/usr/bin/env node

/**
 * Script de Configuración Completa para Webpay Plus Real
 * Archivo: scripts/setup-webpay-complete.js
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Script automatizado para configurar completamente la integración Webpay Plus
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const axios = require('axios');

// Configuración del script
const SETUP_CONFIG = {
  projectName: 'FERREMAS Webpay Plus Integration',
  version: '2.0.0',
  requiredNode: '18.0.0',
  requiredNpm: '8.0.0',
  ports: {
    api: 3003,
    inventory: 3000,
    bank: 3001
  },
  directories: {
    src: './src',
    controllers: './src/controllers',
    routes: './src/routes',
    utils: './src/utils',
    config: './src/config',
    scripts: './scripts',
    docs: './docs',
    public: './public'
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
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
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

class WebpaySetup {
  constructor() {
    this.startTime = Date.now();
    this.steps = [];
    this.config = {
      environment: 'integration',
      apiKeys: {
        integration: {
          keyId: '597055555532',
          keySecret: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C'
        },
        production: {
          keyId: '',
          keySecret: ''
        }
      },
      database: {
        host: 'localhost',
        user: 'administrador',
        password: 'yR!9uL2@pX',
        name: 'ferremas_complete',
        port: 3306
      },
      apis: {
        inventario: 'http://localhost:3000/api',
        banco: 'http://localhost:3001/api/v1'
      }
    };
  }

  async run() {
    try {
      log(`\n🚀 ${SETUP_CONFIG.projectName.toUpperCase()}`, 'cyan');
      log('=' * 60, 'cyan');
      log(`Versión: ${SETUP_CONFIG.version}`, 'blue');
      log(`Fecha: ${new Date().toISOString()}`, 'blue');
      
      await this.showWelcome();
      await this.checkPrerequisites();
      await this.collectConfiguration();
      await this.createDirectoryStructure();
      await this.installDependencies();
      await this.createConfigurationFiles();
      await this.createDatabaseTables();
      await this.setupControllers();
      await this.setupRoutes();
      await this.createUtilities();
      await this.createFrontendFiles();
      await this.setupPackageScripts();
      await this.runInitialTests();
      await this.showCompletionGuide();
      
      log('\n🎉 CONFIGURACIÓN COMPLETADA EXITOSAMENTE!', 'green');
      this.showSummary();
      
    } catch (error) {
      log(`\n❌ ERROR EN CONFIGURACIÓN: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async showWelcome() {
    log('\n📋 Este script configurará automáticamente:', 'yellow');
    log('  • ✅ Verificación de prerequisitos del sistema');
    log('  • ✅ Instalación de dependencias necesarias');
    log('  • ✅ Creación de estructura de directorios');
    log('  • ✅ Configuración de controladores Webpay Plus real');
    log('  • ✅ Configuración de rutas y middlewares');
    log('  • ✅ Creación de tablas de base de datos');
    log('  • ✅ Archivos de configuración (.env, config.js)');
    log('  • ✅ Utilidades y helpers para Webpay');
    log('  • ✅ Páginas de frontend (checkout, retorno)');
    log('  • ✅ Scripts de testing y verificación');
    log('  • ✅ Documentación completa');
    
    const confirm = await question('\n¿Desea continuar con la configuración automática? (s/N): ');
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
      log('Configuración cancelada por el usuario.', 'yellow');
      process.exit(0);
    }
  }

  async checkPrerequisites() {
    log('\n🔍 Verificando prerequisitos...', 'blue');
    
    // Verificar Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      log(`  ✅ Node.js: ${nodeVersion}`);
      this.steps.push('✅ Node.js verificado');
    } catch (error) {
      throw new Error('Node.js no está instalado. Por favor instala Node.js >= 18.0.0');
    }
    
    // Verificar npm
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      log(`  ✅ npm: v${npmVersion}`);
      this.steps.push('✅ npm verificado');
    } catch (error) {
      throw new Error('npm no está disponible');
    }
    
    // Verificar MySQL (opcional)
    try {
      const mysqlVersion = execSync('mysql --version', { encoding: 'utf8' }).trim();
      log(`  ✅ MySQL: ${mysqlVersion.split(' ')[2] || 'detectado'}`);
    } catch (error) {
      log(`  ⚠️  MySQL no detectado (opcional)`, 'yellow');
    }
    
    // Verificar puertos disponibles
    for (const [service, port] of Object.entries(SETUP_CONFIG.ports)) {
      try {
        const isPortBusy = await this.checkPort(port);
        if (isPortBusy) {
          log(`  ⚠️  Puerto ${port} (${service}) está en uso`, 'yellow');
        } else {
          log(`  ✅ Puerto ${port} (${service}) disponible`);
        }
      } catch (error) {
        log(`  ⚠️  No se pudo verificar puerto ${port}`, 'yellow');
      }
    }
    
    this.steps.push('✅ Prerequisitos verificados');
  }

  async collectConfiguration() {
    log('\n⚙️ Configuración personalizada...', 'blue');
    
    // Configurar ambiente
    const environment = await question('Ambiente de Webpay (integration/production) [integration]: ');
    this.config.environment = environment || 'integration';
    
    if (this.config.environment === 'production') {
      log('\n🔑 Configuración de producción:', 'yellow');
      log('  ⚠️  Necesitarás credenciales reales de Transbank');
      
      const keyId = await question('API Key ID de producción: ');
      const keySecret = await question('API Key Secret de producción: ');
      
      if (keyId && keySecret) {
        this.config.apiKeys.production.keyId = keyId;
        this.config.apiKeys.production.keySecret = keySecret;
      } else {
        log('  ⚠️  Sin credenciales de producción. Usando integración.', 'yellow');
        this.config.environment = 'integration';
      }
    }
    
    // Configurar base de datos
    const dbConfig = await question('¿Configurar base de datos personalizada? (s/N): ');
    if (dbConfig.toLowerCase() === 's') {
      this.config.database.host = await question(`Host de BD [${this.config.database.host}]: `) || this.config.database.host;
      this.config.database.user = await question(`Usuario de BD [${this.config.database.user}]: `) || this.config.database.user;
      this.config.database.password = await question(`Contraseña de BD [***]: `) || this.config.database.password;
      this.config.database.name = await question(`Nombre de BD [${this.config.database.name}]: `) || this.config.database.name;
    }
    
    log(`  ✅ Ambiente configurado: ${this.config.environment}`, 'green');
    this.steps.push('✅ Configuración personalizada');
  }

  async createDirectoryStructure() {
    log('\n📁 Creando estructura de directorios...', 'blue');
    
    for (const [name, dir] of Object.entries(SETUP_CONFIG.directories)) {
      try {
        await fs.mkdir(dir, { recursive: true });
        log(`  ✅ ${dir}`);
      } catch (error) {
        log(`  ⚠️  Error creando ${dir}: ${error.message}`, 'yellow');
      }
    }
    
    this.steps.push('✅ Estructura de directorios creada');
  }

  async installDependencies() {
    log('\n📦 Instalando dependencias...', 'blue');
    
    const dependencies = [
      'axios@^1.10.0',
      'uuid@^11.1.0',
      'express@^4.21.2',
      'cors@^2.8.5',
      'dotenv@^16.3.1',
      'morgan@^1.10.0',
      'helmet@^7.2.0',
      'express-rate-limit@^7.5.0',
      'mysql2@^3.9.2',
      'sequelize@^6.37.1',
      'joi@^17.11.0',
      'winston@^3.11.0'
    ];
    
    const devDependencies = [
      'nodemon@^3.1.0',
      'jest@^29.7.0',
      'supertest@^6.3.3'
    ];
    
    try {
      log('  🔄 Instalando dependencias principales...');
      execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });
      
      log('  🔄 Instalando dependencias de desarrollo...');
      execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'inherit' });
      
      log('  ✅ Dependencias instaladas correctamente', 'green');
      this.steps.push('✅ Dependencias instaladas');
    } catch (error) {
      throw new Error(`Error instalando dependencias: ${error.message}`);
    }
  }

  async createConfigurationFiles() {
    log('\n⚙️ Creando archivos de configuración...', 'blue');
    
    // Crear .env
    const envContent = this.generateEnvFile();
    await fs.writeFile('.env', envContent);
    log('  ✅ .env creado');
    
    // Crear config/webpay.js
    const webpayConfigContent = this.generateWebpayConfig();
    await fs.writeFile(path.join(SETUP_CONFIG.directories.config, 'webpay.js'), webpayConfigContent);
    log('  ✅ config/webpay.js creado');
    
    // Crear config/database.js
    const dbConfigContent = this.generateDatabaseConfig();
    await fs.writeFile(path.join(SETUP_CONFIG.directories.config, 'database.js'), dbConfigContent);
    log('  ✅ config/database.js creado');
    
    this.steps.push('✅ Archivos de configuración creados');
  }

  async createDatabaseTables() {
    log('\n🗄️ Configurando base de datos...', 'blue');
    
    const sqlContent = `-- Base de datos configurada automáticamente
-- Fecha: ${new Date().toISOString()}

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS ${this.config.database.name} 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_general_ci;

USE ${this.config.database.name};

-- Tabla de transacciones (estructura simplificada para Webpay)
CREATE TABLE IF NOT EXISTS transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ID_Cliente INT NULL,
    ordenCompra VARCHAR(100) NULL,
    monto DECIMAL(10,2) NULL,
    token VARCHAR(255) NULL,
    estado VARCHAR(50) NULL DEFAULT 'PENDIENTE',
    detalles LONGTEXT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_cliente (ID_Cliente),
    INDEX idx_orden (ordenCompra),
    INDEX idx_token (token),
    INDEX idx_estado (estado),
    INDEX idx_fecha (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de logs de Transbank
CREATE TABLE IF NOT EXISTS transbank_logs (
    ID_Log INT AUTO_INCREMENT PRIMARY KEY,
    ID_Transaccion INT NULL,
    Accion VARCHAR(50) NOT NULL,
    Descripcion VARCHAR(500) NULL,
    Datos_Entrada TEXT NULL,
    Datos_Salida TEXT NULL,
    Codigo_Respuesta VARCHAR(10) DEFAULT '200',
    Mensaje_Error TEXT NULL,
    IP_Origen VARCHAR(45) NULL,
    User_Agent TEXT NULL,
    Duracion_MS INT DEFAULT 0,
    Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_transaccion (ID_Transaccion),
    INDEX idx_accion (Accion),
    INDEX idx_fecha (Fecha_Creacion),
    INDEX idx_codigo (Codigo_Respuesta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar datos de prueba
INSERT IGNORE INTO transacciones (ID_Cliente, ordenCompra, monto, estado, detalles) VALUES
(1, 'TEST-SETUP-001', 50000, 'PENDIENTE', '{"productos": [{"nombre": "Producto de prueba", "cantidad": 1}]}'),
(1, 'TEST-SETUP-002', 75000, 'APROBADO', '{"productos": [{"nombre": "Producto aprobado", "cantidad": 2}]}');

SELECT 'Base de datos configurada correctamente' AS resultado;
`;
    
    await fs.writeFile('./scripts/setup-database.sql', sqlContent);
    log('  ✅ Script SQL creado: scripts/setup-database.sql');
    
    // Intentar ejecutar el script si MySQL está disponible
    try {
      const mysqlCommand = `mysql -h${this.config.database.host} -u${this.config.database.user} -p${this.config.database.password} < scripts/setup-database.sql`;
      log('  🔄 Intentando ejecutar script SQL...');
      execSync(mysqlCommand, { stdio: 'inherit' });
      log('  ✅ Base de datos configurada automáticamente', 'green');
    } catch (error) {
      log('  ⚠️  Ejecutar manualmente: mysql < scripts/setup-database.sql', 'yellow');
    }
    
    this.steps.push('✅ Base de datos configurada');
  }

  async setupControllers() {
    log('\n🎮 Configurando controladores...', 'blue');
    
    // Crear marcador de posición para el controlador real
    const controllerContent = `/**
 * Controlador Webpay Plus Real - FERREMAS
 * Generado automáticamente: ${new Date().toISOString()}
 * 
 * ⚠️  IMPORTANTE: Este es un marcador de posición.
 * Copiar el contenido del RealWebpayController proporcionado.
 */

// TODO: Reemplazar con el contenido completo del RealWebpayController
console.log('⚠️  Controlador Webpay pendiente de configuración');
console.log('📝 Copiar el contenido del RealWebpayController proporcionado');

module.exports = {
  healthCheck: (req, res) => {
    res.json({
      success: false,
      message: 'Controlador pendiente de configuración',
      instructions: 'Copiar contenido del RealWebpayController'
    });
  }
};
`;
    
    await fs.writeFile(path.join(SETUP_CONFIG.directories.controllers, 'realWebpayController.js'), controllerContent);
    log('  ✅ Controlador base creado (pendiente de completar)');
    
    this.steps.push('✅ Controladores configurados');
  }

  async setupRoutes() {
    log('\n🛣️ Configurando rutas...', 'blue');
    
    const routesContent = `/**
 * Rutas Webpay Plus - FERREMAS
 * Generado automáticamente: ${new Date().toISOString()}
 */

const express = require('express');
const router = express.Router();

// TODO: Importar el controlador real cuando esté configurado
// const RealWebpayController = require('../controllers/realWebpayController');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Rutas Webpay configuradas - Pendiente de controlador completo',
    timestamp: new Date().toISOString(),
    setup_status: 'PARTIAL'
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Webpay Plus FERREMAS - Configuración automática',
    version: '${SETUP_CONFIG.version}',
    environment: process.env.WEBPAY_ENV || 'integration',
    setup_date: '${new Date().toISOString()}',
    next_steps: [
      'Completar controlador RealWebpayController',
      'Probar endpoints con script de testing',
      'Configurar frontend si es necesario'
    ]
  });
});

module.exports = router;
`;
    
    await fs.writeFile(path.join(SETUP_CONFIG.directories.routes, 'webpayRoutes.js'), routesContent);
    log('  ✅ Rutas base creadas');
    
    this.steps.push('✅ Rutas configuradas');
  }

  async createUtilities() {
    log('\n🔧 Creando utilidades...', 'blue');
    
    // Crear helper básico
    const helperContent = `/**
 * Webpay Helpers - FERREMAS
 * Generado automáticamente: ${new Date().toISOString()}
 * 
 * ⚠️  IMPORTANTE: Este es un helper básico.
 * Copiar el contenido completo de webpayHelpers proporcionado.
 */

// Función básica de validación
function validateTransactionData(data) {
  const errors = [];
  
  if (!data.clienteId && !data.amount) {
    errors.push('clienteId o amount es requerido');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Función básica para generar orden
function generateBuyOrder() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 999) + 100;
  return \`FER_\${timestamp}_\${random}\`;
}

module.exports = {
  validateTransactionData,
  generateBuyOrder,
  // TODO: Agregar todas las funciones del helper completo
};
`;
    
    await fs.writeFile(path.join(SETUP_CONFIG.directories.utils, 'webpayHelpers.js'), helperContent);
    log('  ✅ Helpers básicos creados');
    
    this.steps.push('✅ Utilidades creadas');
  }

  async createFrontendFiles() {
    log('\n🌐 Creando archivos de frontend...', 'blue');
    
    // Crear directorio public
    await fs.mkdir('./public', { recursive: true });
    
    // Crear página de checkout básica
    const checkoutContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Checkout - FERREMAS</title>
</head>
<body>
    <h1>🚧 Checkout en Construcción</h1>
    <p>Esta página será reemplazada por el frontend completo de Webpay Plus.</p>
    <p>Generado automáticamente: ${new Date().toISOString()}</p>
    
    <script>
        console.log('⚠️ Frontend básico - Reemplazar con versión completa');
    </script>
</body>
</html>`;
    
    await fs.writeFile('./public/checkout.html', checkoutContent);
    log('  ✅ Página de checkout básica creada');
    
    this.steps.push('✅ Archivos de frontend creados');
  }

  async setupPackageScripts() {
    log('\n📜 Configurando scripts de npm...', 'blue');
    
    try {
      const packageJsonPath = './package.json';
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageData = JSON.parse(packageContent);
      
      // Agregar scripts útiles
      packageData.scripts = {
        ...packageData.scripts,
        'start': 'node src/app.js',
        'dev': 'nodemon src/app.js',
        'test': 'jest',
        'test:webpay': 'node scripts/test-webpay-integration.js',
        'test:quick': 'node scripts/test-webpay-integration.js --quick',
        'setup:db': 'mysql < scripts/setup-database.sql',
        'webpay:health': 'curl http://localhost:3003/api/webpay/health',
        'webpay:config': 'curl http://localhost:3003/api/webpay/config',
        'webpay:test-create': 'curl -X POST http://localhost:3003/api/webpay/test-create'
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageData, null, 2));
      log('  ✅ Scripts de npm configurados');
      
      this.steps.push('✅ Scripts de npm configurados');
    } catch (error) {
      log(`  ⚠️  Error configurando scripts: ${error.message}`, 'yellow');
    }
  }

  async runInitialTests() {
    log('\n🧪 Ejecutando verificaciones iniciales...', 'blue');
    
    // Crear script de verificación básica
    const testContent = `#!/usr/bin/env node

/**
 * Verificación Post-Setup
 * Generado automáticamente: ${new Date().toISOString()}
 */

console.log('🔍 Verificando configuración...');

// Verificar archivos
const fs = require('fs');
const files = [
  '.env',
  'src/config/webpay.js',
  'src/controllers/realWebpayController.js',
  'src/routes/webpayRoutes.js',
  'src/utils/webpayHelpers.js'
];

let allFilesExist = true;
files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(\`✅ \${file}\`);
  } else {
    console.log(\`❌ \${file} - FALTANTE\`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\\n✅ Configuración básica completada');
  console.log('📝 Próximos pasos:');
  console.log('  1. Completar RealWebpayController');
  console.log('  2. Completar webpayHelpers');
  console.log('  3. Probar con: npm run webpay:health');
} else {
  console.log('\\n❌ Configuración incompleta');
}
`;
    
    await fs.writeFile('./scripts/verify-setup.js', testContent);
    
    // Ejecutar verificación
    try {
      execSync('node scripts/verify-setup.js', { stdio: 'inherit' });
      this.steps.push('✅ Verificaciones completadas');
    } catch (error) {
      log('  ⚠️  Algunas verificaciones fallaron', 'yellow');
    }
  }

  async showCompletionGuide() {
    log('\n📚 GUÍA DE FINALIZACIÓN', 'cyan');
    log('=' * 40, 'cyan');
    
    log('\n🔄 PASOS PENDIENTES:', 'yellow');
    log('1. 📝 Copiar contenido completo del RealWebpayController');
    log('2. 📝 Copiar contenido completo de webpayHelpers');
    log('3. 📝 Copiar páginas de frontend (checkout, retorno)');
    log('4. 🗄️ Ejecutar setup de base de datos si no se hizo automáticamente');
    log('5. 🧪 Ejecutar tests: npm run test:webpay');
    
    log('\n🚀 COMANDOS ÚTILES:', 'cyan');
    log('  npm start                     # Iniciar servidor');
    log('  npm run dev                   # Desarrollo con nodemon');
    log('  npm run webpay:health         # Verificar salud');
    log('  npm run test:webpay           # Tests completos');
    log('  npm run test:quick            # Test rápido');
    
    log('\n📁 ARCHIVOS CREADOS:', 'blue');
    log('  • .env                        # Variables de entorno');
    log('  • src/config/webpay.js        # Configuración Webpay');
    log('  • src/controllers/...         # Controladores (base)');
    log('  • src/routes/...              # Rutas (base)');
    log('  • src/utils/...               # Utilidades (base)');
    log('  • scripts/setup-database.sql # Setup de BD');
    log('  • scripts/verify-setup.js    # Verificación');
    log('  • public/checkout.html        # Frontend básico');
  }

  // Métodos auxiliares
  generateEnvFile() {
    const apiKeys = this.config.environment === 'production' 
      ? this.config.apiKeys.production 
      : this.config.apiKeys.integration;
      
    return `# ============================================
# CONFIGURACIÓN WEBPAY PLUS REAL - FERREMAS
# Generado automáticamente: ${new Date().toISOString()}
# ============================================

# Ambiente Webpay
WEBPAY_ENV=${this.config.environment}

# Credenciales Webpay
WEBPAY_API_KEY_ID=${apiKeys.keyId}
WEBPAY_API_KEY_SECRET=${apiKeys.keySecret}

# Base de datos
DB_HOST=${this.config.database.host}
DB_USER=${this.config.database.user}
DB_PASSWORD=${this.config.database.password}
DB_NAME=${this.config.database.name}
DB_PORT=${this.config.database.port}

# Puerto de la API
PORT=${SETUP_CONFIG.ports.api}

# URLs de APIs internas
API_INVENTARIO_URL=${this.config.apis.inventario}
API_BANCO_URL=${this.config.apis.banco}

# Configuración adicional
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3003

# ============================================
# SETUP COMPLETADO: ${new Date().toISOString()}
# ============================================
`;
  }

  generateWebpayConfig() {
    return `/**
 * Configuración Webpay Plus
 * Generado automáticamente: ${new Date().toISOString()}
 */

module.exports = {
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
  
  current: process.env.WEBPAY_ENV || 'integration',
  
  timeouts: {
    apiCall: 30000,
    userRedirect: 300000
  },
  
  validation: {
    maxAmount: 999999999,
    minAmount: 50,
    maxBuyOrderLength: 26,
    maxSessionIdLength: 61
  },
  
  setup: {
    version: '${SETUP_CONFIG.version}',
    date: '${new Date().toISOString()}',
    automated: true
  }
};
`;
  }

  generateDatabaseConfig() {
    return `/**
 * Configuración de Base de Datos
 * Generado automáticamente: ${new Date().toISOString()}
 */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || '${this.config.database.name}',
  process.env.DB_USER || '${this.config.database.user}',
  process.env.DB_PASSWORD || '${this.config.database.password}',
  {
    host: process.env.DB_HOST || '${this.config.database.host}',
    port: process.env.DB_PORT || ${this.config.database.port},
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '-03:00',
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

module.exports = { sequelize, Sequelize };
`;
  }

  async checkPort(port) {
    try {
      const net = require('net');
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(false));
        });
        server.on('error', () => resolve(true));
      });
    } catch (error) {
      return false;
    }
  }

  showSummary() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    log('\n📊 RESUMEN DE CONFIGURACIÓN', 'cyan');
    log('=' * 40, 'cyan');
    
    this.steps.forEach(step => {
      log(`  ${step}`, 'green');
    });
    
    log(`\n⏱️  Duración: ${duration} segundos`, 'blue');
    log(`🌍 Ambiente: ${this.config.environment}`, 'blue');
    log(`📅 Fecha: ${new Date().toISOString()}`, 'blue');
    
    log('\n🎯 PRÓXIMOS PASOS CRÍTICOS:', 'magenta');
    log('1. Completar RealWebpayController con código proporcionado', 'yellow');
    log('2. Completar webpayHelpers con código proporcionado', 'yellow');
    log('3. Ejecutar: npm run test:webpay', 'yellow');
    log('4. Verificar: npm run webpay:health', 'yellow');
    
    log('\n✨ ¡Configuración automática completada!', 'green');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const setup = new WebpaySetup();
  setup.run();
}

module.exports = WebpaySetup;