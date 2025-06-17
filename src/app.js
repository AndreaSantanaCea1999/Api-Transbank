// === src/app.js ===
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const sequelize = require('./database');
const transbankRoutes = require('./routes/transbankRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Ruta raíz
app.get('/', (req, res) => {
  res.status(200).json({
    message: '📦 API de Transbank FERREMAS funcionando correctamente',
    version: '1.0.0',
    documentation: '/api/transbank',
    status: 'active'
  });
});

// Rutas principales
app.use('/api/transbank', transbankRoutes);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    availableEndpoints: '/api/transbank'
  });
});

// Conexión a base de datos y lanzamiento del servidor
const startServer = async () => {
  try {
    // Autenticar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    // Sincronizar modelos (si tienes modelos definidos)
    await sequelize.sync({ alter: false });
    console.log('📦 Modelos sincronizados correctamente');

    // Arrancar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor o conectar a la base de datos:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
