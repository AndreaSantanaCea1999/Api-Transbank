const webpayRoutes = require('./webpayRoutes');

router.use('/webpay', webpayRoutes);

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
      webpay: '/api/webpay' // NUEVO
    }
  });
});
