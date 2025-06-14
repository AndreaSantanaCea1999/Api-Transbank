const logger = require('../utils/logger');

/**
 * Validar datos para iniciar transacción
 */
const validarTransaccion = (req, res, next) => {
  const { monto, productos, returnUrl } = req.body;
  const errores = [];

  // Validar monto
  if (!monto || typeof monto !== 'number' || monto <= 0) {
    errores.push('Monto debe ser un número mayor a 0');
  }

  if (monto && monto < 50) {
    errores.push('Monto mínimo es $50');
  }

  if (monto && monto > 999999999) {
    errores.push('Monto máximo es $999.999.999');
  }

  // Validar productos
  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    errores.push('Se requiere al menos un producto');
  } else {
    productos.forEach((producto, index) => {
      if (!producto.idProducto || typeof producto.idProducto !== 'number') {
        errores.push(`Producto ${index + 1}: ID de producto requerido`);
      }
      
      if (!producto.cantidad || typeof producto.cantidad !== 'number' || producto.cantidad <= 0) {
        errores.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
      }
      
      if (!producto.precioUnitario || typeof producto.precioUnitario !== 'number' || producto.precioUnitario <= 0) {
        errores.push(`Producto ${index + 1}: Precio unitario requerido`);
      }
    });
  }

  // Validar URL de retorno
  if (!returnUrl || typeof returnUrl !== 'string') {
    errores.push('URL de retorno requerida');
  } else {
    try {
      new URL(returnUrl);
    } catch (error) {
      errores.push('URL de retorno inválida');
    }
  }

  if (errores.length > 0) {
    logger.warn('Validación fallida para iniciar transacción:', {
      errores,
      body: req.body,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errores,
      code: 'VALIDATION_ERROR'
    });
  }

  next();
};

/**
 * Validar token para confirmar transacción
 */
const validarToken = (req, res, next) => {
  const { token_ws } = req.body;

  if (!token_ws || typeof token_ws !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Token de transacción requerido',
      code: 'TOKEN_REQUIRED'
    });
  }

  if (token_ws.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Token de transacción inválido',
      code: 'INVALID_TOKEN'
    });
  }

  next();
};

/**
 * Validar API Key (para endpoints administrativos)
 */
const validarApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.ADMIN_API_KEY;

  if (!validApiKey) {
    return res.status(500).json({
      success: false,
      message: 'Configuración de API Key no encontrada',
      code: 'CONFIG_ERROR'
    });
  }

  if (!apiKey || apiKey !== validApiKey) {
    logger.warn('Intento de acceso con API Key inválida:', {
      providedKey: apiKey ? `${apiKey.substr(0, 8)}...` : 'none',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      message: 'API Key requerida o inválida',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

module.exports = {
  validarTransaccion,
  validarToken,
  validarApiKey
};
