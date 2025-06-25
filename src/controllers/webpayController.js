/**
 * Controlador Webpay REAL para API Transbank FERREMAS
 * Conexión directa a API REST de Webpay Plus sin SDK
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Controlador para integración real con Transbank Webpay Plus
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Transaccion, TransbankLog } = require('../models');

// ============================================
// CONFIGURACIÓN WEBPAY PLUS
// ============================================
const WEBPAY_CONFIG = {
  // Ambiente Integración (Testing)
  integration: {
    apiKeyId: '597055555532',
    apiKeySecret: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
    baseUrl: 'https://webpay3gint.transbank.cl'
  },
  // Ambiente Producción (cambiar credenciales por las reales)
  production: {
    apiKeyId: process.env.WEBPAY_API_KEY_ID || 'TU_API_KEY_ID_PRODUCCION',
    apiKeySecret: process.env.WEBPAY_API_KEY_SECRET || 'TU_API_KEY_SECRET_PRODUCCION',
    baseUrl: 'https://webpay3g.transbank.cl'
  }
};

// Ambiente actual (cambiar a 'production' para producción)
const ENVIRONMENT = process.env.WEBPAY_ENV || 'integration';
const config = WEBPAY_CONFIG[ENVIRONMENT];

// URLs de APIs internas
const API_URLS = {
  inventario: process.env.API_INVENTARIO_URL || 'http://localhost:3000/api',
  banco: process.env.API_BANCO_URL || 'http://localhost:3001/api/v1'
};

/**
 * Clase para manejar transacciones reales de Webpay
 */
class RealWebpayController {

  /**
   * Generar orden de compra única para Transbank
   */
  static generateBuyOrder() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 999) + 100;
    return `FER_${timestamp}_${random}`;
  }

  /**
   * Generar session ID único
   */
  static generateSessionId() {
    return `SES_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  }

  /**
   * Función para realizar peticiones a Webpay Plus API REST
   */
  static async callWebpayAPI(endpoint, method, data = null) {
    try {
      const url = `${config.baseUrl}${endpoint}`;
      
      const headers = {
        'Tbk-Api-Key-Id': config.apiKeyId,
        'Tbk-Api-Key-Secret': config.apiKeySecret,
        'Content-Type': 'application/json'
      };

      console.log(`🔄 [Webpay API] ${method} ${url}`);
      console.log(`🔑 Environment: ${ENVIRONMENT}`);
      
      const axiosConfig = {
        method,
        url,
        headers,
        timeout: 30000,
        ...(data && { data })
      };

      const response = await axios(axiosConfig);
      
      console.log(`✅ [Webpay API] Response: ${response.status}`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };

    } catch (error) {
      console.error(`❌ [Webpay API Error]:`, {
        endpoint,
        method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        error: error.response?.data || { message: error.message },
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Crear nueva transacción en Webpay Plus
   * POST /api/webpay/create
   */
  static async createTransaction(req, res) {
    const startTime = Date.now();
    
    try {
      console.log('💳 [createTransaction] Iniciando transacción Webpay Plus...');
      
      const { 
        clienteId, 
        productos, 
        amount,
        buyOrder, 
        sessionId, 
        returnUrl 
      } = req.body;

      let calculatedAmount = amount;
      let validatedProducts = [];

      // Si vienen productos, validar con inventario
      if (productos && Array.isArray(productos) && productos.length > 0) {
        console.log(`📦 Validando ${productos.length} productos...`);
        
        calculatedAmount = 0;
        
        for (const item of productos) {
          if (!item.ID_Producto || !item.Cantidad || item.Cantidad <= 0) {
            return res.status(400).json({
              success: false,
              error: 'Producto inválido',
              details: `Datos faltantes en producto: ${JSON.stringify(item)}`
            });
          }

          try {
            // Validar producto existe
            const prodResponse = await axios.get(
              `${API_URLS.inventario}/productos/${item.ID_Producto}`,
              { timeout: 5000 }
            );
            const productoInfo = prodResponse.data;

            // Validar stock
            const stockResponse = await axios.get(
              `${API_URLS.inventario}/inventario`,
              { timeout: 5000 }
            );
            
            const inventarios = stockResponse.data.filter(inv => 
              inv.ID_Producto === parseInt(item.ID_Producto)
            );
            
            const stockTotal = inventarios.reduce((total, inv) => 
              total + (parseInt(inv.Stock_Actual) || 0), 0
            );

            if (stockTotal < item.Cantidad) {
              return res.status(400).json({
                success: false,
                error: 'Stock insuficiente',
                details: `${productoInfo.Nombre}: Disponible ${stockTotal}, Solicitado ${item.Cantidad}`
              });
            }

            const precioUnitario = parseFloat(productoInfo.Precio_Venta);
            const subtotal = precioUnitario * item.Cantidad;
            calculatedAmount += subtotal;

            validatedProducts.push({
              ID_Producto: item.ID_Producto,
              Nombre: productoInfo.Nombre,
              Precio_Unitario: precioUnitario,
              Cantidad: item.Cantidad,
              Subtotal: subtotal
            });

          } catch (apiError) {
            console.error(`❌ Error validando producto ${item.ID_Producto}:`, apiError.message);
            return res.status(400).json({
              success: false,
              error: 'Error validando productos',
              details: `Producto ID ${item.ID_Producto}: ${apiError.message}`
            });
          }
        }
      }

      // Validar monto final
      if (!calculatedAmount || calculatedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto inválido',
          message: 'El monto debe ser mayor a 0'
        });
      }

      // Generar datos únicos si no se proporcionan
      const finalBuyOrder = buyOrder || RealWebpayController.generateBuyOrder();
      const finalSessionId = sessionId || RealWebpayController.generateSessionId();
      const finalReturnUrl = returnUrl || `${req.protocol}://${req.get('host')}/api/webpay/return`;

      // Datos para enviar a Transbank
      const transactionData = {
        buy_order: finalBuyOrder,
        session_id: finalSessionId,
        amount: Math.round(calculatedAmount), // Transbank requiere entero
        return_url: finalReturnUrl
      };

      console.log('📋 Datos transacción Transbank:', transactionData);

      // 🚀 LLAMADA REAL A TRANSBANK API
      const result = await RealWebpayController.callWebpayAPI(
        '/rswebpaytransaction/api/webpay/v1.0/transactions',
        'POST',
        transactionData
      );

      if (!result.success) {
        // Log error de Transbank
        await RealWebpayController.logAction(
          req,
          'ERROR_CREATE_WEBPAY',
          'Error al crear transacción en Transbank',
          transactionData,
          result.error,
          result.status?.toString(),
          result.error?.message || 'Error desconocido',
          null,
          Date.now() - startTime
        );

        return res.status(result.status || 500).json({
          success: false,
          error: 'Error al crear transacción en Transbank',
          details: result.error,
          environment: ENVIRONMENT
        });
      }

      // ✅ GUARDAR TRANSACCIÓN EN BD LOCAL
      console.log('💾 Guardando transacción en BD local...');
      
      const transaccion = await Transaccion.create({
        clienteId: clienteId || null,
        ordenCompra: finalBuyOrder,
        monto: calculatedAmount,
        token: result.data.token, // Token real de Transbank
        estadoTexto: 'PENDIENTE',
        detalles: validatedProducts.length > 0 ? validatedProducts : null
      });

      // Log exitoso
      await RealWebpayController.logAction(
        req,
        'CREATE_WEBPAY_SUCCESS',
        'Transacción Webpay creada exitosamente',
        transactionData,
        result.data,
        '201',
        null,
        transaccion.id,
        Date.now() - startTime
      );

      // Respuesta exitosa
      res.status(201).json({
        success: true,
        message: 'Transacción creada exitosamente en Transbank',
        data: {
          // Datos de Transbank
          token: result.data.token,
          url: result.data.url,
          // Datos internos
          transaccion_id: transaccion.id,
          buy_order: finalBuyOrder,
          session_id: finalSessionId,
          amount: calculatedAmount,
          environment: ENVIRONMENT,
          // Productos validados
          productos: validatedProducts
        },
        // Instrucciones para el frontend
        instructions: {
          next_step: 'Redirigir usuario a result.data.url con form POST',
          form_data: {
            token_ws: result.data.token
          }
        }
      });

    } catch (error) {
      console.error('❌ Error en createTransaction:', error);
      
      // Log error general
      await RealWebpayController.logAction(
        req,
        'ERROR_CREATE_TRANSACTION',
        'Error interno al crear transacción',
        req.body,
        null,
        '500',
        error.message,
        null,
        Date.now() - startTime
      );

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Confirmar transacción desde retorno de Webpay
   * PUT /api/webpay/confirm/:token
   */
  static async confirmTransaction(req, res) {
    const startTime = Date.now();
    
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token requerido',
          message: 'Debe proporcionar un token válido'
        });
      }

      console.log('🔍 [confirmTransaction] Confirmando con Transbank:', token.substring(0, 10) + '...');

      // 🚀 LLAMADA REAL A TRANSBANK PARA CONFIRMAR
      const result = await RealWebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`,
        'PUT'
      );

      if (!result.success) {
        await RealWebpayController.logAction(
          req,
          'ERROR_CONFIRM_WEBPAY',
          'Error al confirmar transacción en Transbank',
          { token },
          result.error,
          result.status?.toString(),
          result.error?.message,
          null,
          Date.now() - startTime
        );

        return res.status(result.status || 500).json({
          success: false,
          error: 'Error al confirmar transacción en Transbank',
          details: result.error,
          environment: ENVIRONMENT
        });
      }

      const transactionData = result.data;
      console.log('📊 Respuesta de Transbank:', transactionData);

      // Buscar transacción en BD local
      const transaccion = await Transaccion.findOne({ where: { token } });
      
      if (!transaccion) {
        console.warn('⚠️ Transacción no encontrada en BD local');
      }

      // Determinar estado según respuesta de Transbank
      let estadoFinal = 'RECHAZADO';
      let transaccionExitosa = false;

      if (transactionData.status === 'AUTHORIZED' && 
          transactionData.response_code === 0) {
        estadoFinal = 'APROBADO';
        transaccionExitosa = true;
      }

      // Actualizar transacción local si existe
      if (transaccion) {
        transaccion.estadoTexto = estadoFinal;
        await transaccion.save();
        
        console.log(`✅ Transacción local actualizada a: ${estadoFinal}`);

        // Si fue exitosa, actualizar inventario
        if (transaccionExitosa && transaccion.detalles) {
          await RealWebpayController.updateInventory(transaccion);
        }
      }

      // Log de confirmación
      await RealWebpayController.logAction(
        req,
        'CONFIRM_WEBPAY_SUCCESS',
        `Transacción confirmada: ${estadoFinal}`,
        { token },
        transactionData,
        '200',
        null,
        transaccion?.id,
        Date.now() - startTime
      );

      res.json({
        success: true,
        message: 'Transacción confirmada exitosamente',
        data: {
          // Datos de Transbank
          ...transactionData,
          // Estado procesado
          estado_procesado: estadoFinal,
          transaccion_exitosa: transaccionExitosa,
          // Datos locales
          transaccion_local_id: transaccion?.id,
          orden_compra: transaccion?.ordenCompra,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en confirmTransaction:', error);
      
      await RealWebpayController.logAction(
        req,
        'ERROR_CONFIRM_TRANSACTION',
        'Error interno al confirmar transacción',
        req.params,
        null,
        '500',
        error.message,
        null,
        Date.now() - startTime
      );

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Consultar estado de transacción
   * GET /api/webpay/status/:token
   */
  static async getTransactionStatus(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token requerido'
        });
      }

      console.log('📊 [getTransactionStatus] Consultando estado:', token.substring(0, 10) + '...');

      // 🚀 CONSULTAR ESTADO EN TRANSBANK
      const result = await RealWebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`,
        'GET'
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          success: false,
          error: 'Error al consultar estado en Transbank',
          details: result.error,
          environment: ENVIRONMENT
        });
      }

      // Buscar transacción local
      const transaccionLocal = await Transaccion.findOne({ where: { token } });

      res.json({
        success: true,
        message: 'Estado consultado exitosamente',
        data: {
          // Datos de Transbank
          ...result.data,
          // Datos locales
          transaccion_local: transaccionLocal ? {
            id: transaccionLocal.id,
            orden_compra: transaccionLocal.ordenCompra,
            cliente_id: transaccionLocal.clienteId,
            monto_local: transaccionLocal.monto,
            estado_local: transaccionLocal.estadoTexto,
            productos: transaccionLocal.detalles
          } : null,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en getTransactionStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Realizar reembolso (anulación)
   * POST /api/webpay/refund/:token
   */
  static async refundTransaction(req, res) {
    try {
      const { token } = req.params;
      const { amount } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token requerido'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto inválido',
          message: 'El monto del reembolso debe ser mayor a 0'
        });
      }

      console.log('💸 [refundTransaction] Procesando reembolso:', { token: token.substring(0, 10) + '...', amount });

      // 🚀 LLAMADA REAL A TRANSBANK PARA REEMBOLSO
      const result = await RealWebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}/refunds`,
        'POST',
        { amount: parseInt(amount) }
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          success: false,
          error: 'Error al procesar reembolso en Transbank',
          details: result.error,
          environment: ENVIRONMENT
        });
      }

      // Actualizar transacción local
      const transaccion = await Transaccion.findOne({ where: { token } });
      if (transaccion) {
        transaccion.estadoTexto = 'REEMBOLSADO';
        await transaccion.save();
      }

      res.json({
        success: true,
        message: 'Reembolso procesado exitosamente',
        data: {
          ...result.data,
          transaccion_local_id: transaccion?.id,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en refundTransaction:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Manejar retorno desde Webpay (webhook/callback)
   * POST /api/webpay/return
   */
  static async handleReturn(req, res) {
    try {
      const { token_ws } = req.body;

      console.log('🔄 [handleReturn] Retorno desde Webpay:', { token_ws: token_ws?.substring(0, 10) + '...' });

      if (!token_ws) {
        return res.status(400).json({
          success: false,
          error: 'Token no encontrado',
          message: 'No se recibió token desde Webpay'
        });
      }

      // Confirmar automáticamente la transacción
      const confirmResult = await RealWebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token_ws}`,
        'PUT'
      );

      if (!confirmResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Error al confirmar transacción de retorno',
          details: confirmResult.error
        });
      }

      // Procesar resultado igual que en confirmTransaction
      const transactionData = confirmResult.data;
      const transaccion = await Transaccion.findOne({ where: { token: token_ws } });
      
      let estadoFinal = 'RECHAZADO';
      if (transactionData.status === 'AUTHORIZED' && transactionData.response_code === 0) {
        estadoFinal = 'APROBADO';
      }

      if (transaccion) {
        transaccion.estadoTexto = estadoFinal;
        await transaccion.save();

        if (estadoFinal === 'APROBADO' && transaccion.detalles) {
          await RealWebpayController.updateInventory(transaccion);
        }
      }

      res.json({
        success: true,
        message: 'Retorno procesado exitosamente',
        data: {
          ...transactionData,
          estado_procesado: estadoFinal,
          transaccion_local_id: transaccion?.id,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en handleReturn:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Obtener configuración actual
   * GET /api/webpay/config
   */
  static getConfig(req, res) {
    res.json({
      success: true,
      data: {
        environment: ENVIRONMENT,
        baseUrl: config.baseUrl,
        apiKeyId: config.apiKeyId.slice(0, 4) + '...' + config.apiKeyId.slice(-4),
        endpoints: {
          createTransaction: 'POST /api/webpay/create',
          confirmTransaction: 'PUT /api/webpay/confirm/:token',
          getStatus: 'GET /api/webpay/status/:token',
          refund: 'POST /api/webpay/refund/:token',
          return: 'POST /api/webpay/return'
        },
        integration_info: {
          real_api: true,
          sdk_used: false,
          direct_rest_calls: true
        }
      }
    });
  }

  /**
   * Health check para Webpay
   * GET /api/webpay/health
   */
  static async healthCheck(req, res) {
    try {
      // Test simple a Transbank (sin crear transacción)
      let transbankStatus = 'UNKNOWN';
      
      try {
        // Intentar una petición simple (esto podría fallar si no hay endpoint de health)
        await axios.get(config.baseUrl, { timeout: 5000 });
        transbankStatus = 'CONNECTED';
      } catch (error) {
        transbankStatus = 'ERROR';
      }

      res.json({
        success: true,
        message: 'API Webpay FERREMAS funcionando correctamente',
        timestamp: new Date().toISOString(),
        environment: ENVIRONMENT,
        status: 'healthy',
        connections: {
          transbank_api: transbankStatus,
          database: 'CONNECTED' // Asumimos que llegó aquí
        },
        config: {
          real_api: true,
          base_url: config.baseUrl
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en health check',
        error: error.message,
        environment: ENVIRONMENT
      });
    }
  }

  /**
   * Actualizar inventario después de venta exitosa
   */
  static async updateInventory(transaccion) {
    try {
      console.log('📦 [updateInventory] Actualizando inventario...');
      
      if (!transaccion.detalles || !Array.isArray(transaccion.detalles)) {
        console.log('⚠️ No hay productos para actualizar inventario');
        return false;
      }

      for (const producto of transaccion.detalles) {
        if (producto.ID_Producto && producto.Cantidad) {
          try {
            const movimientoData = {
              Tipo_Movimiento: 'Salida',
              Cantidad: parseInt(producto.Cantidad),
              ID_Bodeguero: 1,
              Comentario: `Venta Webpay Plus - Orden ${transaccion.ordenCompra}`
            };

            await axios.post(
              `${API_URLS.inventario}/inventario/${producto.ID_Producto}/movimiento`,
              movimientoData,
              { timeout: 5000 }
            );

            console.log(`✅ Stock actualizado: ${producto.Nombre} (-${producto.Cantidad})`);
          } catch (error) {
            console.error(`❌ Error actualizando stock para ${producto.Nombre}:`, error.message);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error general actualizando inventario:', error);
      return false;
    }
  }

  /**
   * Función auxiliar para logs
   */
  static async logAction(req, accion, descripcion, datosEntrada, datosSalida, codigoRespuesta, mensajeError = null, idTransaccion = null, duracion = 0) {
    try {
      await TransbankLog.create({
        ID_Transaccion: idTransaccion,
        Accion: accion,
        Descripcion: descripcion,
        Datos_Entrada: JSON.stringify(datosEntrada),
        Datos_Salida: datosSalida ? JSON.stringify(datosSalida) : null,
        Codigo_Respuesta: codigoRespuesta,
        Mensaje_Error: mensajeError,
        IP_Origen: req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress,
        User_Agent: req.headers['user-agent'] || 'Unknown',
        Duracion_MS: duracion
      });
    } catch (logError) {
      console.error('❌ Error creando log:', logError.message);
    }
  }
}

module.exports = RealWebpayController;