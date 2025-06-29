const express = require('express');
const router = express.Router();
const TransbankService = require('../services/transbank');

const transbank = new TransbankService();
const transactions = new Map();
const generateRandomNumber = () => Math.floor(Math.random() * 1000000);

router.get('/', async (req, res) => {
    try {
        // ✅ LEER PARÁMETROS DE LA URL
        const { monto, ordenCompra, cliente_id } = req.query;
        
        const buyOrder = ordenCompra || generateRandomNumber().toString();
        const sessionId = generateRandomNumber().toString();
        const amount = parseInt(monto) || 15000; // ← CORREGIDO: Leer monto de parámetros
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        console.log('📨 Parámetros recibidos:', { monto, ordenCompra, cliente_id });
        console.log('💰 Monto a procesar:', amount);

        const response = await transbank.createTransaction(buyOrder, sessionId, amount, returnUrl);
        
        transactions.set(response.token, {
            buyOrder, 
            sessionId, 
            amount,
            cliente_id, // ← Guardar cliente_id también
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
                amount, // ← Ahora será el monto correcto
                redirectUrl: `${req.protocol}://${req.get('host')}/api/transbank/redirect/${response.token}`
            }
        });

    } catch (error) {
        console.error('❌ Error creando transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la transacción',
            error: error.message
        });
    }
});

// ✅ NUEVA RUTA: Manejar cancelaciones
router.get('/cancel', (req, res) => {
    console.log('❌ Pago cancelado por el usuario');
    res.send(`
        <html>
        <head><title>Redirigiendo...</title></head>
        <body>
            <script>
                window.top.location.href = 'http://localhost:3004/payment-cancel';
            </script>
            <p>Pago cancelado. <a href="http://localhost:3004/payment-cancel">Volver al carrito</a></p>
        </body>
        </html>
    `);
});

// ✅ MEJORADO: Página de redirección con botón cancelar
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
                margin: 10px;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(107, 25, 107, 0.4);
            }
            .btn-cancel {
                background: linear-gradient(45deg, #dc2626, #ef4444);
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
            
            <a href="http://localhost:3004/payment-cancel" class="btn btn-cancel">❌ Cancelar</a>
            
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

// ✅ MEJORADO: Resultado del pago con manejo de cancelaciones
router.post('/result', async (req, res) => {
    try {
        const { token_ws } = req.body;
        
        console.log('📥 POST /result recibido:', req.body);
        
        // Si no hay token, asumir que fue cancelado
        if (!token_ws) {
            console.log('❌ Sin token - redirigiendo a cancelación');
            return res.send(`
                <html>
                <head><title>Redirigiendo...</title></head>
                <body>
                    <script>
                        window.top.location.href = 'http://localhost:3004/payment-cancel';
                    </script>
                    <p>Redirigiendo... <a href="http://localhost:3004/payment-cancel">Clic aquí si no rediriges automáticamente</a></p>
                </body>
                </html>
            `);
        }

        console.log(`📥 Confirmando transacción con token: ${token_ws}`);

        // Obtener transacción del almacén temporal
        const transaction = transactions.get(token_ws);
        if (!transaction) {
            console.error(`Transacción no encontrada: ${token_ws}`);
            return res.send(`
                <html>
                <head><title>Redirigiendo...</title></head>
                <body>
                    <script>
                        window.top.location.href = 'http://localhost:3004/payment-cancel';
                    </script>
                    <p>Transacción no encontrada. <a href="http://localhost:3004/payment-cancel">Volver al carrito</a></p>
                </body>
                </html>
            `);
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
        
        // Redirigir según el resultado usando HTML con JavaScript
        if (isSuccessful) {
            res.send(`
                <html>
                <head><title>Pago Exitoso</title></head>
                <body>
                    <script>
                        window.top.location.href = 'http://localhost:3004/payment-success?token_ws=${token_ws}&amount=${result.amount}';
                    </script>
                    <p>Pago exitoso. <a href="http://localhost:3004/payment-success">Continuar</a></p>
                </body>
                </html>
            `);
        } else {
            res.send(`
                <html>
                <head><title>Pago Fallido</title></head>
                <body>
                    <script>
                        window.top.location.href = 'http://localhost:3004/payment-cancel';
                    </script>
                    <p>Pago no autorizado. <a href="http://localhost:3004/payment-cancel">Volver al carrito</a></p>
                </body>
                </html>
            `);
        }

    } catch (error) {
        console.error('❌ Error confirmando transacción:', error);
        res.send(`
            <html>
            <head><title>Error</title></head>
            <body>
                <script>
                    window.top.location.href = 'http://localhost:3004/payment-cancel';
                </script>
                <p>Error en el pago. <a href="http://localhost:3004/payment-cancel">Volver al carrito</a></p>
            </body>
            </html>
        `);
    }
});

// ✅ NUEVA RUTA: Manejar GET a /result (cancelaciones)
router.get('/result', (req, res) => {
    console.log('❌ GET a /result - probablemente cancelación');
    res.send(`
        <html>
        <head><title>Redirigiendo...</title></head>
        <body>
            <script>
                window.top.location.href = 'http://localhost:3004/payment-cancel';
            </script>
            <p>Pago cancelado. <a href="http://localhost:3004/payment-cancel">Volver al carrito</a></p>
        </body>
        </html>
    `);
});

// ✅ NUEVA RUTA: Obtener información de una transacción local
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