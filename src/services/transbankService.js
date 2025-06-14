const axios = require('axios');
const logger = require('../utils/logger');

class TransbankService {
  constructor() {
    this.environment = process.env.TRANSBANK_ENVIRONMENT || 'integration';
    this.commerceCode = process.env.TRANSBANK_COMMERCE_CODE;
    this.apiKey = process.env.TRANSBANK_API_KEY;
    this.baseUrl = this.environment === 'production' 
      ? 'https://webpay3g.transbank.cl' 
      : 'https://webpay3gint.transbank.cl';
    this.apiVersion = process.env.TRANSBANK_API_VERSION || '1.2';
    this.timeout = parseInt(process.env.API_TIMEOUT_MS) || 30000;
  }

  /**
   * Crear una nueva transacción WebPay
   */
  async crearTransaccion(transactionData) {
    try {
      const { buyOrder, sessionId, amount, returnUrl } = transactionData;

      // Validar datos requeridos
      if (!buyOrder || !amount || !returnUrl) {
        throw new Error('Faltan datos requeridos para crear la transacción');
      }

      // En ambiente de integración, simular respuesta
      if (this.environment === 'integration') {
        logger.info('🧪 Modo integración: Simulando creación de transacción Transbank', {
          buyOrder,
          amount,
          returnUrl
        });

        const simulatedToken = `SIMU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          token: simulatedToken,
          url: `${this.baseUrl}/webpayserver/initTransaction?token_ws=${simulatedToken}`
        };
      }

      // En producción, llamar a la API real de Transbank
      const response = await axios.post(
        `${this.baseUrl}/rswebpaytransaction/api/webpay/v${this.apiVersion}/transactions`,
        {
          buy_order: buyOrder,
          session_id: sessionId,
          amount: amount,
          return_url: returnUrl
        },
        {
          headers: {
            'Tbk-Api-Key-Id': this.commerceCode,
            'Tbk-Api-Key-Secret': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      logger.info('✅ Transacción creada exitosamente en Transbank', {
        buyOrder,
        token: response.data.token
      });

      return {
        token: response.data.token,
        url: response.data.url
      };

    } catch (error) {
      logger.error('❌ Error al crear transacción en Transbank:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response?.status === 422) {
        throw new Error('Datos de transacción inválidos');
      } else if (error.response?.status === 401) {
        throw new Error('Credenciales de Transbank inválidas');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout al conectar con Transbank');
      }

      throw new Error('Error al comunicarse con Transbank');
    }
  }

  /**
   * Confirmar una transacción WebPay
   */
  async confirmarTransaccion(token) {
    try {
      if (!token) {
        throw new Error('Token requerido para confirmar transacción');
      }

      // En ambiente de integración, simular respuesta
      if (this.environment === 'integration') {
        logger.info('🧪 Modo integración: Simulando confirmación de transacción', { token });

        // Simular éxito o fallo basado en el token
        const isSuccess = !token.includes('FAIL');
        
        return {
          vci: 'TSY',
          amount: 50000,
          status: isSuccess ? 'AUTHORIZED' : 'FAILED',
          buy_order: `ORD-${Date.now()}`,
          session_id: `SES-${Date.now()}`,
          card_detail: {
            card_type: 'Visa',
            card_number: '************1234'
          },
          accounting_date: new Date().toISOString().split('T')[0],
          transaction_date: new Date().toISOString(),
          authorization_code: isSuccess ? `AUTH${Math.floor(Math.random() * 1000000)}` : null,
          payment_type_code: 'VN',
          response_code: isSuccess ? 0 : -1,
          installments_amount: 0,
          installments_number: 1,
          balance: 0
        };
      }

      // En producción, llamar a la API real
      const response = await axios.put(
        `${this.baseUrl}/rswebpaytransaction/api/webpay/v${this.apiVersion}/transactions/${token}`,
        {},
        {
          headers: {
            'Tbk-Api-Key-Id': this.commerceCode,
            'Tbk-Api-Key-Secret': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      logger.info('✅ Transacción confirmada en Transbank', {
        token,
        responseCode: response.data.response_code,
        authorizationCode: response.data.authorization_code
      });

      return response.data;

    } catch (error) {
      logger.error('❌ Error al confirmar transacción en Transbank:', {
        token,
        error: error.message,
        response: error.response?.data
      });

      if (error.response?.status === 404) {
        throw new Error('Transacción no encontrada en Transbank');
      } else if (error.response?.status === 422) {
        throw new Error('Estado de transacción inválido');
      }

      throw new Error('Error al confirmar transacción con Transbank');
    }
  }

  /**
   * Consultar estado de una transacción
   */
  async consultarTransaccion(token) {
    try {
      if (this.environment === 'integration') {
        logger.info('🧪 Modo integración: Consultando estado de transacción', { token });
        
        return {
          status: 'AUTHORIZED',
          response_code: 0,
          authorization_code: `AUTH${Math.floor(Math.random() * 1000000)}`
        };
      }

      const response = await axios.get(
        `${this.baseUrl}/rswebpaytransaction/api/webpay/v${this.apiVersion}/transactions/${token}`,
        {
          headers: {
            'Tbk-Api-Key-Id': this.commerceCode,
            'Tbk-Api-Key-Secret': this.apiKey
          },
          timeout: this.timeout
        }
      );

      return response.data;

    } catch (error) {
      logger.error('❌ Error al consultar transacción:', {
        token,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Procesar una devolución
   */
  async procesarDevolucion(refundData) {
    try {
      const { token, amount } = refundData;

      if (this.environment === 'integration') {
        logger.info('🧪 Modo integración: Procesando devolución', { token, amount });
        
        return {
          type: 'NULLIFIED',
          balance: 0,
          authorization_code: `REF${Math.floor(Math.random() * 1000000)}`,
          response_code: 0,
          nullification_id: `NULL${Date.now()}`
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/rswebpaytransaction/api/webpay/v${this.apiVersion}/transactions/${token}/refunds`,
        {
          amount: amount
        },
        {
          headers: {
            'Tbk-Api-Key-Id': this.commerceCode,
            'Tbk-Api-Key-Secret': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data;

    } catch (error) {
      logger.error('❌ Error al procesar devolución:', {
        error: error.message,
        token: refundData.token
      });
      throw error;
    }
  }

  /**
   * Verificar configuración del servicio
   */
  verificarConfiguracion() {
    const errores = [];

    if (!this.commerceCode) {
      errores.push('TRANSBANK_COMMERCE_CODE no configurado');
    }

    if (!this.apiKey) {
      errores.push('TRANSBANK_API_KEY no configurado');
    }

    if (errores.length > 0) {
      throw new Error(`Configuración incompleta: ${errores.join(', ')}`);
    }

    logger.info('✅ Configuración de Transbank verificada', {
      environment: this.environment,
      commerceCode: this.commerceCode,
      baseUrl: this.baseUrl
    });

    return true;
  }
}

module.exports = new TransbankService();