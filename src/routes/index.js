const webpayRoutes = require('./webpayRoutes');
const transbankRoutes = require('./transbankRoutes'); // Importar transbankRoutes

router.use('/webpay', webpayRoutes);
router.use('/transbank', transbankRoutes); // Montar transbankRoutes bajo /transbank

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
      sucursales: '/api/sucursales', // Asumiendo que tienes más rutas
      webpay: '/api/webpay',
      transbank: '/api/transbank' // Indicar la base para las rutas de Transbank
    }
  });
});
