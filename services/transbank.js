const axios = require('axios');
require('dotenv').config();

class TransbankService {
    constructor() {
        this.config = {
            apiKeyId: '597055555532',
            apiKeySecret: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
            baseUrl: 'https://webpay3gint.transbank.cl'
        };
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
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('Error en Transbank:', error.response?.data || error.message);
            throw new Error(`Error de Transbank: ${error.response?.data?.error_message || error.message}`);
        }
    }

    async createTransaction(buyOrder, sessionId, amount, returnUrl) {
        const data = {
            buy_order: buyOrder,
            session_id: sessionId,
            amount: amount,
            return_url: returnUrl
        };

        return await this.makeRequest('POST', '/rswebpaytransaction/api/webpay/v1.0/transactions', data);
    }

    async confirmTransaction(token) {
        return await this.makeRequest('PUT', `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`);
    }

    async getTransactionStatus(token) {
        return await this.makeRequest('GET', `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`);
    }

    async refundTransaction(token, amount) {
        const data = { amount: amount };
        return await this.makeRequest('POST', `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}/refunds`, data);
    }

    async notifyBankApi(action, data) {
        console.log(`📤 Notificación banco API: ${action}`, data);
        return null;
    }

    async validateWithBank(buyOrder, amount) {
        return { valid: true, message: 'Validación bancaria OK' };
    }
}

module.exports = TransbankService;