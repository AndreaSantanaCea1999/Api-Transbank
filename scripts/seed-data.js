const seedTransbankData = async () => {
  console.log('🌱 Insertando datos de prueba para Transbank...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Insertar productos de prueba si no existen
    console.log('📦 Verificando productos de prueba...');
    
    const productosTest = [
      {
        Codigo: 'MART-001',
        Nombre: 'Martillo Bosch Professional',
        Descripcion: 'Martillo de acero con mango ergonómico',
        ID_Categoria: 1,
        ID_Marca: 3, // Bosch
        Precio_Venta: 15000,
        ID_Divisa: 1,
        Estado: 'Activo'
      },
      {
        Codigo: 'TALD-002', 
        Nombre: 'Taladro Stanley 500W',
        Descripcion: 'Taladro eléctrico con portabrocas automático',
        ID_Categoria: 1,
        ID_Marca: 3,
        Precio_Venta: 45000,
        ID_Divisa: 1,
        Estado: 'Activo'
      }
    ];

    for (const producto of productosTest) {
      try {
        // Verificar si existe
        const [existing] = await connection.execute(
          'SELECT ID_Producto FROM productos WHERE Codigo = ?',
          [producto.Codigo]
        );

        if (existing.length === 0) {
          await connection.execute(`
            INSERT INTO productos (Codigo, Nombre, Descripcion, ID_Categoria, ID_Marca, Precio_Venta, ID_Divisa, Estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            producto.Codigo,
            producto.Nombre,
            producto.Descripcion,
            producto.ID_Categoria,
            producto.ID_Marca,
            producto.Precio_Venta,
            producto.ID_Divisa,
            producto.Estado
          ]);
          
          console.log(`✅ Producto creado: ${producto.Nombre}`);
        } else {
          console.log(`ℹ️ Producto ya existe: ${producto.Nombre}`);
        }
      } catch (error) {
        console.log(`⚠️ Error con producto ${producto.Codigo}: ${error.message}`);
      }
    }

    // Crear inventario para los productos
    console.log('\n📊 Verificando inventario...');
    
    const [productos] = await connection.execute(`
      SELECT ID_Producto, Codigo, Nombre 
      FROM productos 
      WHERE Codigo IN ('MART-001', 'TALD-002')
    `);

    for (const producto of productos) {
      try {
        // Verificar si existe inventario
        const [inventarioExistente] = await connection.execute(
          'SELECT ID_Inventario FROM inventario WHERE ID_Producto = ? AND ID_Sucursal = 1',
          [producto.ID_Producto]
        );

        if (inventarioExistente.length === 0) {
          await connection.execute(`
            INSERT INTO inventario (ID_Producto, ID_Sucursal, Stock_Actual, Stock_Minimo, Stock_Maximo, Stock_Reservado)
            VALUES (?, 1, 100, 10, 500, 0)
          `, [producto.ID_Producto]);
          
          console.log(`✅ Inventario creado: ${producto.Nombre} (100 unidades)`);
        } else {
          console.log(`ℹ️ Inventario ya existe: ${producto.Nombre}`);
        }
      } catch (error) {
        console.log(`⚠️ Error con inventario ${producto.Codigo}: ${error.message}`);
      }
    }

    await connection.end();
    console.log('\n✅ Datos de prueba insertados correctamente');

  } catch (error) {
    console.error('❌ Error al insertar datos de prueba:', error.message);
    throw error;
  }
};