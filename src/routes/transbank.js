// routes/transbank.js - Rutas para manejar el flujo de pagos con Transbank
const express = require('express');
const router = express.Router();
const TransbankService = require('../services/transbank');
require('dotenv').config();

const transbank = new TransbankService();

// Almacén temporal para las transacciones (cambiar por BD después)
const transactions = new Map();

// Función para generar números aleatorios (como rand() en PHP)
const generateRandomNumber = () => Math.floor(Math.random() * 1000000);

// Página inicial - crear nueva transacción
router.get('/', async (req, res) => {
    try {
        const buyOrder = generateRandomNumber().toString();
        const sessionId = generateRandomNumber().toString();
        const amount = 15000; // Monto fijo de ejemplo
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        // Crear transacción en Transbank
        const response = await transbank.createTransaction(buyOrder, sessionId, amount, returnUrl);
        
        // Guardar información de la transacción
        transactions.set(response.token, {
            buyOrder,
            sessionId,
            amount,
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
                buyOrder,
                sessionId,
                amount,
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

// Crear transacción con POST
router.post('/create', async (req, res) => {
    try {
        const { amount = 15000, buyOrder, sessionId, userId } = req.body;
        
        const finalBuyOrder = buyOrder || generateRandomNumber().toString();
        const finalSessionId = sessionId || generateRandomNumber().toString();
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        // Crear transacción en Transbank
        const response = await transbank.createTransaction(finalBuyOrder, finalSessionId, amount, returnUrl);
        
        // Guardar información de la transacción
        transactions.set(response.token, {
            buyOrder: finalBuyOrder,
            sessionId: finalSessionId,
            amount,
            token: response.token,
            url: response.url,
            status: 'created',
            userId: userId || null
        });

        res.json({
            success: true,
            message: 'Transacción creada exitosamente',
            data: {
                token: response.token,
                url: response.url,
                buyOrder: finalBuyOrder,
                sessionId: finalSessionId,
                amount,
                redirectUrl: `${req.protocol}://${req.get('host')}/api/transbank/redirect/${response.token}`
            }
        });

    } catch (error) {
        console.error('Error creando transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la transacción',
            error: error.message
        });
    }
});

// Endpoint para redirigir al formulario de pago de Transbank
router.get('/redirect/:token', (req, res) => {
    const { token } = req.params;
    const transaction = transactions.get(token);
    
    if (!transaction) {
        return res.status(404).json({
            success: false,
            message: 'Transacción no encontrada'
        });
    }

    // Página HTML con formulario que redirige a Transbank
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redirigiendo a Webpay...</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center; 
                padding: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                max-width: 450px;
                width: 90%;
            }
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #6b196b;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .btn {
                background: linear-gradient(45deg, #6b196b, #8e2485);
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                text-decoration: none;
                display: inline-block;
                transition: all 0.3s ease;
                margin-top: 20px;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(107, 25, 107, 0.4);
            }
            .info {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: left;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🏦 Transbank Webpay</h2>
            
            <div class="info">
                <h3>Información de la transacción</h3>
                <p><strong>Orden:</strong> ${transaction.buyOrder}</p>
                <p><strong>Monto:</strong> $${transaction.amount.toLocaleString('es-CL')}</p>
                <p><strong>Estado:</strong> Pendiente de pago</p>
            </div>
            
            <div class="loading">
                <div class="spinner"></div>
                <p>Serás redirigido al formulario de pago seguro de Transbank...</p>
            </div>
            
            <form id="webpayForm" method="POST" action="${transaction.url}">
                <input type="hidden" name="token_ws" value="${token}" />
                <button type="submit" class="btn">🔒 Continuar al Pago Seguro</button>
            </form>
            
            <script>
                // Auto-submit después de 3 segundos
                let countdown = 3;
                const countdownElement = document.createElement('p');
                countdownElement.style.marginTop = '20px';
                countdownElement.style.fontSize = '14px';
                countdownElement.style.color = '#6c757d';
                document.querySelector('.container').appendChild(countdownElement);
                
                const timer = setInterval(() => {
                    countdownElement.textContent = \`Redirección automática en \${countdown} segundos...\`;
                    countdown--;
                    
                    if (countdown < 0) {
                        clearInterval(timer);
                        document.getElementById('webpayForm').submit();
                    }
                }, 1000);
                
                // Cancelar redirección automática si el usuario hace clic
                document.getElementById('webpayForm').addEventListener('submit', () => {
                    clearInterval(timer);
                    countdownElement.textContent = 'Redirigiendo...';
                });
            </script>
        </div>
    </body>
    </html>`;
    
    res.send(html);
});

// Resultado del pago - Transbank redirige aquí después del pago
router.post('/result', async (req, res) => {
    try {
        const { token_ws } = req.body;
        
        if (!token_ws) {
            console.error('Token no proporcionado en /result');
            return res.status(400).json({
                success: false,
                message: 'Token no proporcionado'
            });
        }

        console.log(`📥 Confirmando transacción con token: ${token_ws}`);

        // Obtener transacción del almacén temporal
        const transaction = transactions.get(token_ws);
        if (!transaction) {
            console.error(`Transacción no encontrada: ${token_ws}`);
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Confirmar la transacción con Transbank
        const result = await transbank.confirmTransaction(token_ws);
        
        // Actualizar estado en el almacén temporal
        transactions.set(token_ws, {
            ...transaction,
            status: 'confirmed',
            result
        });

        // Determinar si el pago fue exitoso
        const isSuccessful = result.status === 'AUTHORIZED' && result.response_code === 0;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3004';
        
        // Redirigir al frontend con los resultados
        const redirectUrl = `${frontendUrl}/payment-result?` + 
            `token=${token_ws}&` +
            `status=${result.status}&` +
            `success=${isSuccessful}&` +
            `amount=${result.amount}&` +
            `buyOrder=${result.buy_order}&` +
            `authCode=${result.authorization_code || ''}&` +
            `responseCode=${result.response_code || ''}`;

        // Si es una petición desde navegador, redirigir directamente
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect(redirectUrl);
        }

        // Si es una petición API, retornar JSON
        res.json({
            success: isSuccessful,
            message: isSuccessful ? 'Transacción confirmada exitosamente' : 'Transacción fallida',
            data: {
                ...result,
                redirectUrl,
                paymentSuccessful: isSuccessful
            }
        });

    } catch (error) {
        console.error('Error confirmando transacción:', error);
        
        // En caso de error, redirigir al frontend con error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3004';
        const errorRedirectUrl = `${frontendUrl}/payment-result?` +
            `token=${req.body.token_ws || 'unknown'}&` +
            `status=ERROR&` +
            `success=false&` +
            `error=${encodeURIComponent(error.message)}`;

        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect(errorRedirectUrl);
        }

        res.status(500).json({
            success: false,
            message: 'Error al confirmar la transacción',
            error: error.message,
            redirectUrl: errorRedirectUrl
        });
    }
});

// Obtener estado de una transacción
router.get('/status/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const status = await transbank.getTransactionStatus(token);
        const localTransaction = transactions.get(token);
        
        res.json({
            success: true,
            message: 'Estado obtenido exitosamente',
            data: {
                transbank: status,
                local: localTransaction
            }
        });

    } catch (error) {
        console.error('Error obteniendo estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el estado',
            error: error.message
        });
    }
});

// Realizar reembolso
router.post('/refund/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { amount } = req.body;
        
        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'Monto del reembolso requerido'
            });
        }

        const refund = await transbank.refundTransaction(token, amount);
        
        // Actualizar en almacén temporal
        const transaction = transactions.get(token);
        if (transaction) {
            transactions.set(token, {
                ...transaction,
                status: 'refunded',
                refund
            });
        }
        
        res.json({
            success: true,
            message: 'Reembolso procesado exitosamente',
            data: refund
        });

    } catch (error) {
        console.error('Error procesando reembolso:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el reembolso',
            error: error.message
        });
    }
});

// Obtener información de una transacción local
router.get('/transaction/:token', (req, res) => {
    const { token } = req.params;
    const transaction = transactions.get(token);
    
    if (!transaction) {
        return res.status(404).json({
            success: false,
            message: 'Transacción no encontrada'
        });
    }
    
    res.json({
        success: true,
        data: transaction
    });
});

module.exports = router;