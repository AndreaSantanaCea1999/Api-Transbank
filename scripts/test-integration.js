const testIntegracionCompleta = async () => {
  console.log('🧪 PRUEBA DE INTEGRACIÓN COMPLETA\n');
  
  const baseUrl = `http://localhost:${process.env.PORT || 3002}/api`;
  
  try {
    // 1. Verificar salud de la API
    console.log('1️⃣ Verificando salud de la API...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✅ API Transbank funcionando correctamente\n');

    // 2. Probar creación de transacción
    console.log('2️⃣ Probando creación de transacción...');
    const transactionData = {
      monto: 50000,
      productos: [
        {
          idProducto: 1,
          cantidad: 2,
          precioUnitario: 15000,
          descripcion: 'Martillo Bosch'
        },
        {
          idProducto: 2,
          cantidad: 1,
          precioUnitario: 20000,
          descripcion: 'Taladro Stanley'
        }
      ],
      returnUrl: 'http://localhost:4200/payment/return',
      finalUrl: 'http://localhost:4200/payment/final',
      sessionId: `TEST-${Date.now()}`
    };

    const initResponse = await axios.post(`${baseUrl}/transbank/init`, transactionData);
    
    if (initResponse.data.success) {
      console.log('✅ Transacción iniciada exitosamente');
      console.log(`   Token: ${initResponse.data.data.token}`);
      console.log(`   URL: ${initResponse.data.data.url}`);
      
      const token = initResponse.data.data.token;

      // 3. Probar consulta de estado
      console.log('\n3️⃣ Probando consulta de estado...');
      const statusResponse = await axios.get(`${baseUrl}/transbank/status/${token}`);
      
      if (statusResponse.data.success) {
        console.log('✅ Consulta de estado exitosa');
        console.log(`   Estado: ${statusResponse.data.data.estado.nombre}`);
      }

      // 4. Simular confirmación (solo en modo integración)
      if (process.env.TRANSBANK_ENVIRONMENT === 'integration') {
        console.log('\n4️⃣ Simulando confirmación de transacción...');
        
        const commitResponse = await axios.post(`${baseUrl}/transbank/commit`, {
          token_ws: token
        });
        
        if (commitResponse.data.success) {
          console.log('✅ Confirmación simulada exitosa');
          console.log(`   Código Autorización: ${commitResponse.data.data.codigoAutorizacion}`);
        }
      }

    } else {
      console.error('❌ Error al iniciar transacción:', initResponse.data.message);
    }

    // 5. Probar listado de transacciones
    console.log('\n5️⃣ Probando listado de transacciones...');
    const listResponse = await axios.get(`${baseUrl}/transbank/transactions?limit=5`);
    
    if (listResponse.data.success) {
      console.log(`✅ Listado obtenido: ${listResponse.data.data.transacciones.length} transacciones`);
    }

    console.log('\n✅ PRUEBA DE INTEGRACIÓN COMPLETADA EXITOSAMENTE');

  } catch (error) {
    console.error('❌ Error durante prueba de integración:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return false;
  }

  return true;
};
