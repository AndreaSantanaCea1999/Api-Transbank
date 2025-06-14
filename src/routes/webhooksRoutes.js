const crypto = require('crypto');
const { TransbankLogs } = require('../models');

const webhooksRouter = express.Router();

// Middleware para verificar signature del webhook
const verificarSignature = (req, res, next) => {
  const signature = req.headers['x-transbank-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).json({
      success: false,
      message: 'Signature no válida'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      message: 'Signature no válida'
    });
  }

  next();
};

// Webhook de notificaciones de Transbank
webhooksRouter.post('/transbank', verificarSignature, async (req, res) => {
  try {
    const { token, status, amount, authorization_code } = req.body;

    // Registrar webhook en logs
    await TransbankLogs.create({
      Accion: 'WEBHOOK_RECEIVED',
      Descripcion: 'Webhook recibido desde Transbank',
      Datos_Entrada: JSON.stringify(req.body),
      IP_Origen: req.ip,
      User_Agent: req.get('User-Agent')
    });

    // Procesar notificación según sea necesario
    // Aquí puedes agregar lógica para actualizar estados, enviar notificaciones, etc.

    res.json({
      success: true,
      message: 'Webhook procesado exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al procesar webhook',
      error: error.message
    });
  }
});

module.exports = webhooksRouter;