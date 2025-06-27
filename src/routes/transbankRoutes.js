// routes/transbank.js - Rutas para manejar el flujo de pagos con Transbank
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const TransbankService = require('../services/transbank');
require('dotenv').config();

const transbank = new TransbankService();

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para generar números aleatorios (como rand() en PHP)
const generateRandomNumber = () => Math.floor(Math.random() * 1000000);

// Función para guardar transacción en BD
async function saveTransaction(transactionData) {
    try {
        const query = `
            INSERT INTO transbank_transactions 
            (token, buy_order, session_id, amount, status, transbank_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        const [result] = await pool.execute(query, [
            transactionData.token,
            transactionData.buyOrder,
            transactionData.sessionId,
            transactionData.amount,
            transactionData.status,
            transactionData.url
        ]);
        
        return result.insertId;
    } catch (error) {
        console.error('Error guardando transacción en BD:', error);
        throw error;
    }
}

// Función para actualizar transacción en BD
async function updateTransaction(token, updateData) {
    try {
        const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateData);
        
        const query = `
            UPDATE transbank_transactions 
            SET ${fields}, updated_at = NOW()
            WHERE token = ?
        `;
        
        const [result] = await pool.execute(query, [...values, token]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error actualizando transacción en BD:', error);
        throw error;
    }
}

// Función para obtener transacción de BD
async function getTransaction(token) {
    try {
        const query = 'SELECT * FROM transbank_transactions WHERE token = ?';
        const [rows] = await pool.execute(query, [token]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error obteniendo transacción de BD:', error);
        throw error;
    }
}

// Página inicial - crear nueva transacción
router.post('/create', async (req, res) => {
    try {
        const { amount = 15000, buyOrder, sessionId, userId } = req.body;
        
        const finalBuyOrder = buyOrder || generateRandomNumber().toString();
        const finalSessionId = sessionId || generateRandomNumber().toString();
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        // Validar con API del banco antes de proceder
        const bankValidation = await transbank.validateWithBank(finalBuyOrder, amount);
        if (!bankValidation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Transacción rechazada por el banco',
                error: bankValidation.message
            });
        }

        // Crear transacción en Transbank
        const response = await transbank.createTransaction(finalBuyOrder, finalSessionId, amount, returnUrl);
        
        // Guardar en base de datos
        const transactionData = {
            token: response.token,
            buyOrder: finalBuyOrder,
            sessionId: finalSessionId,
            amount,
            status: 'created',
            url: response.url,
            userId: userId || null
        };
        
        await saveTransaction(transactionData);

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

// Método GET alternativo para compatibilidad (como en el PHP original)
router.get('/', async (req, res) => {
    // Redirigir al método POST o crear transacción simple
    try {
        const amount = 15000;
        const buyOrder = generateRandomNumber().toString();
        const sessionId = generateRandomNumber().toString();
        const returnUrl = `${req.protocol}://${req.get('host')}/api/transbank/result`;

        const response = await transbank.createTransaction(buyOrder, sessionId, amount, returnUrl);
        
        const transactionData = {
            token: response.token,
            buyOrder,
            sessionId,
            amount,
            status: 'created',
            url: response.url
        };
        
        await saveTransaction(transactionData);

        res.json({
            success: true,
            message: 'Transacción creada exitosamente',
            data: {
                token: response.token,
                url: response.url,
                buyOrder,
                sessionId,
                amount
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

// Endpoint para redirigir al formulario de pago de Transbank
router.get('/redirect/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const transaction = await getTransaction(token);
        
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
                .logo {
                    width: 200px;
                    height: auto;
                    margin-bottom: 30px;
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
                .transaction-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    text-align: left;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    padding: 5px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                .info-label {
                    font-weight: 600;
                    color: #6c757d;
                }
                .info-value {
                    color: #495057;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🏦 Transbank Webpay</h2>
                
                <div class="transaction-info">
                    <h3>Información de la transacción</h3>
                    <div class="info-row">
                        <span class="info-label">Orden de Compra:</span>
                        <span class="info-value">${transaction.buy_order}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Monto:</span>
                        <span class="info-value">${transaction.amount.toLocaleString('es-CL')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">Pendiente de pago</span>
                    </div>
                </div>
                
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Serás redirigido al formulario de pago seguro de Transbank...</p>
                </div>
                
                <form id="webpayForm" method="POST" action="${transaction.transbank_url}">
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
        
    } catch (error) {
        console.error('Error en redirección:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la redirección',
            error: error.message
        });
    }
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

        // Obtener transacción de la base de datos
        const transaction = await getTransaction(token_ws);
        if (!transaction) {
            console.error(`Transacción no encontrada en BD: ${token_ws}`);
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Confirmar la transacción con Transbank
        const result = await transbank.confirmTransaction(token_ws);
        
        // Actualizar estado en la base de datos
        await updateTransaction(token_ws, {
            status: 'confirmed',
            response_code: result.response_code || null,
            authorization_code: result.authorization_code || null,
            transaction_date: result.transaction_date || null,
            amount_confirmed: result.amount || null,
            installments_number: result.installments_number || null,
            card_detail: JSON.stringify(result.card_detail || {}),
            raw_response: JSON.stringify(result)
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
        
        // Obtener de Transbank y de la BD
        const [transbankStatus, dbTransaction] = await Promise.all([
            transbank.getTransactionStatus(token),
            getTransaction(token)
        ]);
        
        // Actualizar BD con la información más reciente
        if (dbTransaction) {
            await updateTransaction(token, {
                status: transbankStatus.status,
                last_status_check: new Date()
            });
        }
        
        res.json({
            success: true,
            message: 'Estado obtenido exitosamente',
            data: {
                transbank: transbankStatus,
                database: dbTransaction,
                combined: {
                    ...transbankStatus,
                    localData: dbTransaction
                }
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

        // Verificar que la transacción existe y está confirmada
        const transaction = await getTransaction(token);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        if (transaction.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden reembolsar transacciones confirmadas'
            });
        }

        // Procesar reembolso en Transbank
        const refund = await transbank.refundTransaction(token, amount);
        
        // Actualizar en BD
        await updateTransaction(token, {
            status: 'refunded',
            refund_amount: amount,
            refund_date: new Date(),
            refund_response: JSON.stringify(refund)
        });
        
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

// Obtener información de una transacción desde BD
router.get('/transaction/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const transaction = await getTransaction(token);
        
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
        
    } catch (error) {
        console.error('Error obteniendo transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la transacción',
            error: error.message
        });
    }
});

// Endpoint para webhooks del banco API
router.post('/webhook/bank', async (req, res) => {
    try {
        const { action, token, data } = req.body;
        
        console.log(`📨 Webhook del banco API: ${action} para token: ${token}`);
        
        // Procesar según el tipo de acción
        switch (action) {
            case 'validate-payment':
                // El banco puede validar o rechazar un pago
                if (data.approved) {
                    await updateTransaction(token, { bank_validation: 'approved' });
                } else {
                    await updateTransaction(token, { bank_validation: 'rejected' });
                }
                break;
                
            case 'update-balance':
                // El banco actualiza el balance después de un pago
                await updateTransaction(token, { 
                    bank_balance_updated: true,
                    bank_balance_date: new Date()
                });
                break;
                
            default:
                console.warn(`Acción desconocida del webhook: ${action}`);
        }
        
        res.json({ success: true, message: 'Webhook procesado' });
        
    } catch (error) {
        console.error('Error procesando webhook del banco:', error);
        res.status(500).json({
            success: false,
            message: 'Error procesando webhook',
            error: error.message
        });
    }
});

// Endpoint para obtener todas las transacciones (admin)
router.get('/admin/transactions', async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM transbank_transactions';
        let params = [];
        
        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await pool.execute(query, params);
        
        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM transbank_transactions';
        if (status) {
            countQuery += ' WHERE status = ?';
            params = [status];
        } else {
            params = [];
        }
        
        const [countResult] = await pool.execute(countQuery, params);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            data: {
                transactions: rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo transacciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las transacciones',
            error: error.message
        });
    }
});

module.exports = router;