/**
 * Controlador Webpay para API Transbank FERREMAS
 * Archivo: src/controllers/webpayController.js
 * 
 * @author Equipo FERREMAS
 * @date Junio 2025
 * @description Controlador para manejar transacciones Webpay Plus
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuración de Webpay
const WEBPAY_CONFIG = {
  sandbox: {
    apiKeyId: '597055555532',
    apiKeySecret: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
    baseUrl: 'https://webpay3gint.transbank.cl'
  },
  live: {
    apiKeyId: process.env.WEBPAY_API_KEY_ID || '597055555532',
    apiKeySecret: process.env.WEBPAY_API_KEY_SECRET || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
    baseUrl: 'https://webpay3g.transbank.cl'
  }
};

// Ambiente actual (cambiar a 'live' para producción)
const ENVIRONMENT = process.env.WEBPAY_ENV || 'sandbox';
const config = WEBPAY_CONFIG[ENVIRONMENT];

// URLs de las otras APIs
const API_URLS = {
  inventario: process.env.API_INVENTARIO_URL || 'http://localhost:3000/api',
  ventas: process.env.API_VENTAS_URL || 'http://localhost:3001/api'
};

/**
 * Clase para manejar transacciones de Webpay
 */
class WebpayController {
  
  /**
   * Función auxiliar para generar orden de compra única
   */static generateBuyOrder() {
  const timestamp = Date.now().toString().slice(-8); // Últimos 8 dígitos del timestamp
  const random = Math.floor(Math.random() * 999) + 100; // 3 dígitos
  return `FER_${timestamp}_${random}`; // Máximo 18 caracteres
}
  /**
   * Función auxiliar para generar session ID único
   */
 static generateSessionId() {
  return `SES_${uuidv4().replace(/-/g, '').slice(0, 16)}`; // Total 20 caracteres
}
  /**
   * Función para realizar peticiones a Webpay
   */
  static async callWebpayAPI(endpoint, method, data = null) {
    try {
      const url = `${config.baseUrl}${endpoint}`;
      
      const headers = {
        'Tbk-Api-Key-Id': config.apiKeyId,
        'Tbk-Api-Key-Secret': config.apiKeySecret,
        'Content-Type': 'application/json'
      };

      console.log(`🔄 Llamando a Webpay: ${method} ${url}`);
      
      const axiosConfig = {
        method,
        url,
        headers,
        timeout: 30000,
        ...(data && { data })
      };

      const response = await axios(axiosConfig);
      
      console.log(`✅ Respuesta Webpay: ${response.status}`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };

    } catch (error) {
      console.error(`❌ Error Webpay:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || { message: error.message },
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Crear nueva transacción
   * POST /api/webpay/transactions
   */
  static async createTransaction(req, res) {
    try {
      const { amount, buyOrder, sessionId, returnUrl } = req.body;

      // Validar datos requeridos
      if (!amount || amount <= 0) {
        return res.status(400).json({
          error: 'Monto inválido',
          message: 'El monto debe ser mayor a 0'
        });
      }

      // Generar datos únicos si no se proporcionan
      const transactionData = {
        buy_order: buyOrder || WebpayController.generateBuyOrder(),
        session_id: sessionId || WebpayController.generateSessionId(),
        amount: parseInt(amount),
        return_url: returnUrl || `${req.protocol}://${req.get('host')}/api/webpay/return`
      };

      console.log('📋 Creando transacción:', transactionData);

      // Llamar a Webpay
      const result = await WebpayController.callWebpayAPI(
        '/rswebpaytransaction/api/webpay/v1.0/transactions',
        'POST',
        transactionData
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          error: 'Error al crear transacción',
          details: result.error
        });
      }

      // Respuesta exitosa
      res.status(201).json({
        success: true,
        message: 'Transacción creada exitosamente',
        data: {
          ...result.data,
          buy_order: transactionData.buy_order,
          session_id: transactionData.session_id,
          amount: transactionData.amount,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en createTransaction:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * Confirmar transacción
   * PUT /api/webpay/transactions/:token
   */
  static async confirmTransaction(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          error: 'Token requerido',
          message: 'Debe proporcionar un token válido'
        });
      }

      console.log('🔍 Confirmando transacción:', token);

      // Llamar a Webpay para confirmar
      const result = await WebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`,
        'PUT'
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          error: 'Error al confirmar transacción',
          details: result.error
        });
      }

      const transactionData = result.data;

      // Si la transacción fue autorizada, registrar en API de Ventas
      if (transactionData.status === 'AUTHORIZED') {
        console.log('💰 Transacción autorizada, registrando venta...');
        
        try {
          await WebpayController.registerSale(transactionData);
        } catch (saleError) {
          console.error('⚠️ Error al registrar venta:', saleError.message);
          // No fallar la confirmación por error en registro de venta
        }
      }

      res.json({
        success: true,
        message: 'Transacción confirmada',
        data: {
          ...transactionData,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en confirmTransaction:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * Consultar estado de transacción
   * GET /api/webpay/transactions/:token
   */
  static async getTransactionStatus(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          error: 'Token requerido',
          message: 'Debe proporcionar un token válido'
        });
      }

      console.log('📊 Consultando estado:', token);

      const result = await WebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`,
        'GET'
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          error: 'Error al consultar estado',
          details: result.error
        });
      }

      res.json({
        success: true,
        message: 'Estado consultado exitosamente',
        data: {
          ...result.data,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en getTransactionStatus:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * Realizar reembolso
   * POST /api/webpay/transactions/:token/refunds
   */
  static async refundTransaction(req, res) {
    try {
      const { token } = req.params;
      const { amount } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'Token requerido',
          message: 'Debe proporcionar un token válido'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          error: 'Monto inválido',
          message: 'El monto del reembolso debe ser mayor a 0'
        });
      }

      console.log('💸 Procesando reembolso:', { token, amount });

      const result = await WebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}/refunds`,
        'POST',
        { amount: parseInt(amount) }
      );

      if (!result.success) {
        return res.status(result.status || 500).json({
          error: 'Error al procesar reembolso',
          details: result.error
        });
      }

      res.json({
        success: true,
        message: 'Reembolso procesado exitosamente',
        data: {
          ...result.data,
          environment: ENVIRONMENT
        }
      });

    } catch (error) {
      console.error('❌ Error en refundTransaction:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * Endpoint para manejar retorno desde Webpay
   * POST /api/webpay/return
   */
  static async handleReturn(req, res) {
    try {
      const { token_ws } = req.body;

      console.log('🔄 Retorno desde Webpay:', { token_ws });

      if (!token_ws) {
        return res.status(400).json({
          error: 'Token no encontrado',
          message: 'No se recibió token desde Webpay'
        });
      }

      // Confirmar automáticamente la transacción
      const confirmResult = await WebpayController.callWebpayAPI(
        `/rswebpaytransaction/api/webpay/v1.0/transactions/${token_ws}`,
        'PUT'
      );

      if (!confirmResult.success) {
        return res.status(500).json({
          error: 'Error al confirmar transacción de retorno',
          details: confirmResult.error
        });
      }

      res.json({
        success: true,
        message: 'Retorno procesado exitosamente',
        data: confirmResult.data
      });

    } catch (error) {
      console.error('❌ Error en handleReturn:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
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
          createTransaction: '/api/webpay/transactions',
          confirmTransaction: '/api/webpay/transactions/:token',
          getStatus: '/api/webpay/transactions/:token',
          refund: '/api/webpay/transactions/:token/refunds',
          return: '/api/webpay/return'
        }
      }
    });
  }

  /**
   * Health check para Webpay
   * GET /api/webpay/health
   */
  static healthCheck(req, res) {
    res.json({
      success: true,
      message: 'API Webpay FERREMAS funcionando correctamente',
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
      status: 'healthy'
    });
  }

  /**
   * Registrar venta en API de Ventas
   */
  static async registerSale(transactionData) {
    try {
      const saleData = {
        buy_order: transactionData.buy_order,
        amount: transactionData.amount,
        authorization_code: transactionData.authorization_code,
        payment_method: 'webpay',
        status: transactionData.status,
        transaction_date: new Date().toISOString(),
        card_detail: transactionData.card_detail
      };

      const response = await axios.post(`${API_URLS.ventas}/ventas`, saleData, {
        timeout: 5000
      });

      console.log('✅ Venta registrada en API Ventas:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Error registrando venta:', error.message);
      throw error;
    }
  }

  /**
   * Actualizar inventario después de venta
   */
  static async updateInventory(productos) {
    try {
      for (const producto of productos) {
        await axios.put(`${API_URLS.inventario}/productos/${producto.id}/stock`, {
          cantidad: -producto.cantidad
        }, {
          timeout: 5000
        });
      }

      console.log('✅ Inventario actualizado');

    } catch (error) {
      console.error('❌ Error actualizando inventario:', error.message);
      throw error;
    }
  }
}

module.exports = WebpayController;