// transbank.js - Servicio para manejar la API de Transbank
const axios = require('axios');
require('dotenv').config();

class TransbankService {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        
        // Configuración basada en variables de entorno
        this.config = {
            apiKeyId: process.env.WEBPAY_API_KEY_ID,
            apiKeySecret: process.env.WEBPAY_API_KEY_SECRET,
            baseUrl: this.environment === 'production' 
                ? 'https://webpay3g.transbank.cl'  // Live
                : 'https://webpay3gint.transbank.cl', // Testing
            bankApiUrl: process.env.BANK_API_URL,
            frontendUrl: process.env.FRONTEND_URL
        };
        
        // Validar que las credenciales estén configuradas
        if (!this.config.apiKeyId || !this.config.apiKeySecret) {
            throw new Error('Credenciales de Webpay no configuradas en variables de entorno');
        }
    }

    async makeRequest(method, endpoint, data = null) {
        try {
            const response = await axios({
                method,
                url: `${this.config.baseUrl}${endpoint}`,
                data,
                headers: {
                    'Tbk-Api-Key-Id': this.config.apiKeyId,
                    'Tbk-Api-Key-Secret': this.config.apiKeySecret,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos
            });
            
            return response.data;
        } catch (error) {
            console.error('Error en la petición a Transbank:', error.response?.data || error.message);
            throw new Error(`Error de Transbank: ${error.response?.data?.error_message || error.message}`);
        }
    }

    // Comunicación con API del banco
    async notifyBankApi(action, data) {
        if (!this.config.bankApiUrl) {
            console.warn('BANK_API_URL no configurada, saltando notificación al banco');
            return null;
        }

        try {
            const response = await axios.post(`${this.config.bankApiUrl}/transbank/${action}`, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Source': 'transbank-service'
                },
                timeout: 10000 // 10 segundos
            });
            
            console.log(`✅ Notificación exitosa al banco API (${action}):`, response.data);
            return response.data;
        } catch (error) {
            console.error(`❌ Error al notificar al banco API (${action}):`, error.response?.data || error.message);
            // No fallar la transacción principal por errores de notificación
            return null;
        }
    }

    // Inicializar transacción
    async createTransaction(buyOrder, sessionId, amount, returnUrl) {
        const data = {
            buy_order: buyOrder,
            session_id: sessionId,
            amount: amount,
            return_url: returnUrl
        };

        const response = await this.makeRequest(
            'POST', 
            '/rswebpaytransaction/api/webpay/v1.0/transactions',
            data
        );

        // Notificar al banco API sobre la creación de la transacción
        await this.notifyBankApi('transaction-created', {
            token: response.token,
            buyOrder,
            sessionId,
            amount,
            status: 'created',
            transbankUrl: response.url,
            timestamp: new Date().toISOString()
        });

        return response;
    }

    // Confirmar transacción (después del pago)
    async confirmTransaction(token) {
        const response = await this.makeRequest(
            'PUT',
            `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`
        );

        // Notificar al banco API sobre la confirmación
        await this.notifyBankApi('transaction-confirmed', {
            token,
            ...response,
            timestamp: new Date().toISOString()
        });

        return response;
    }

    // Obtener estado de la transacción
    async getTransactionStatus(token) {
        const response = await this.makeRequest(
            'GET',
            `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`
        );

        // Notificar al banco API sobre la consulta de estado
        await this.notifyBankApi('transaction-status-checked', {
            token,
            status: response.status,
            timestamp: new Date().toISOString()
        });

        return response;
    }

    // Realizar reembolso
    async refundTransaction(token, amount) {
        const data = {
            amount: amount
        };

        const response = await this.makeRequest(
            'POST',
            `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}/refunds`,
            data
        );

        // Notificar al banco API sobre el reembolso
        await this.notifyBankApi('transaction-refunded', {
            token,
            refundAmount: amount,
            ...response,
            timestamp: new Date().toISOString()
        });

        return response;
    }

    // Método para validar con el banco si la transacción es válida
    async validateWithBank(buyOrder, amount) {
        if (!this.config.bankApiUrl) {
            return { valid: true, message: 'Validación bancaria deshabilitada' };
        }

        try {
            const response = await axios.post(`${this.config.bankApiUrl}/validate-transaction`, {
                buyOrder,
                amount,
                timestamp: new Date().toISOString()
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            return response.data;
        } catch (error) {
            console.error('Error validando con banco:', error.message);
            // En caso de error, permitir la transacción pero logear el problema
            return { valid: true, message: 'Error en validación bancaria, transacción permitida' };
        }
    }
}

module.exports = TransbankService;