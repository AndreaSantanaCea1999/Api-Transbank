const express = require('express');
const router = express.Router();
const TransbankService = require('../services/transbank');

const transbank = new TransbankService();
const transactions = new Map();
const generateRandomNumber = () => Math.floor(Math.random() * 1000000);

router.get('/', async (req, res) => {
    try {
        const buyOrder = generateRandomNumber().toString();
        const sessionId = generateRandomNumber().toString();
        const amount = 15000;
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        const response = await transbank.createTransaction(buyOrder, sessionId, amount, returnUrl);
        
        transactions.set(response.token, {
            buyOrder, sessionId, amount,
            token: response.token,
            url: response.url,
            status: 'created'
        });

        res.json({
            success: true,
            message: 'Transacción creada exitosamente',
            data: {
                token: response.token,
                url: response.url,
                buyOrder, sessionId, amount,
                redirectUrl: `${req.protocol}://${req.get('host')}/api/transbank/redirect/${response.token}`
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear la transacción',
            error: error.message
        });
    }
});

router.get('/redirect/:token', (req, res) => {
    const { token } = req.params;
    const transaction = transactions.get(token);
    
    if (!transaction) {
        return res.status(404).json({
            success: false,
            message: 'Transacción no encontrada'
        });
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Redirigiendo a Webpay...</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
            .btn { background: #6b196b; color: white; padding: 12px 24px; border: none; border-radius: 4px; font-size: 16px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🏦 Transbank Webpay</h2>
            <p><strong>Orden:</strong> ${transaction.buyOrder}</p>
            <p><strong>Monto:</strong> $${transaction.amount.toLocaleString('es-CL')}</p>
            <form id="webpayForm" method="POST" action="${transaction.url}">
                <input type="hidden" name="token_ws" value="${token}" />
                <button type="submit" class="btn">Continuar al Pago</button>
            </form>
            <script>
                setTimeout(() => {
                    document.getElementById('webpayForm').submit();
                }, 3000);
            </script>
        </div>
    </body>
    </html>`;
    
    res.send(html);
});

router.post('/result', async (req, res) => {
    try {
        const { token_ws } = req.body;
        
        if (!token_ws) {
            return res.status(400).json({
                success: false,
                message: 'Token no proporcionado'
            });
        }

        const result = await transbank.confirmTransaction(token_ws);
        
        res.json({
            success: true,
            message: 'Transacción confirmada',
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al confirmar la transacción',
            error: error.message
        });
    }
});

module.exports = router;