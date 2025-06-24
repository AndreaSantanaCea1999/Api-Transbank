const express = require('express');
const router = express.Router();

const webpayRoutes = require('./webpayRoutes');
const transbankRoutes = require('./transbankRoutes');

// Montar rutas
router.use('/webpay', webpayRoutes);
router.use('/transbank', transbankRoutes);

// Ruta raíz de información
router.get('/', (req, res) => {
  res.json({
    mensaje: 'API Transbank Simulada - FERREMAS',
    endpoints: {
      productos: '/api/productos',
      categorias: '/api/categorias',
      marcas: '/api/marcas',
      proveedores: '/api/proveedores',
      inventario: '/api/inventario',
      movimientos: '/api/movimientos',
      divisas: '/api/divisas',
      usuarios: '/api/usuarios',
      pedidos: '/api/pedidos',
      sucursales: '/api/sucursales',
      webpay: '/api/webpay',
      transbank: '/api/transbank'
    }
  });
});

module.exports = router;
