module.exports = {
  apps: [
    {
      name: 'api-transbank-ferremas',
      script: 'src/app.js',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      // Configuración de logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Configuración de restart
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      
      // Configuración de watch (solo en desarrollo)
      watch: process.env.NODE_ENV !== 'production',
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log'
      ],
      
      // Variables de entorno específicas
      env_vars: {
        INSTANCE_ID: process.env.pm_id || 0
      }
    }
  ],
  
  // Configuración de despliegue
  deploy: {
    production: {
      user: 'deploy',
      host: ['192.168.1.100'],
      ref: 'origin/main',
      repo: 'https://github.com/AndreaSantanaCea1999/api-transbank-ferremas.git',
      path: '/var/www/api-transbank',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
