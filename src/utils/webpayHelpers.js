const crypto = require('crypto');

// Códigos de respuesta de Transbank
const RESPONSE_CODES = {
  0: { status: 'APPROVED', message: 'Transacción aprobada' },
  '-1': { status: 'REJECTED', message: 'Rechazo de transacción' },
  '-2': { status: 'RETRY', message: 'Transacción debe reintentarse' },
  '-3': { status: 'ERROR', message: 'Error en transacción' },
  '-4': { status: 'REJECTED', message: 'Rechazo de transacción' },
  '-5': { status: 'REJECTED', message: 'Rechazo por error de tasa' },
  '-6': { status: 'REJECTED', message: 'Excede cupo máximo mensual' },
  '-7': { status: 'REJECTED', message: 'Excede límite diario por transacción' },
  '-8': { status: 'REJECTED', message: 'Rubro no autorizado' }
};

// Estados de transacción Webpay
const WEBPAY_STATUS = {
  INITIALIZED: 'INITIALIZED',
  AUTHORIZED: 'AUTHORIZED',
  REVERSED: 'REVERSED',
  FAILED: 'FAILED',
  NULLIFIED: 'NULLIFIED',
  PARTIALLY_NULLIFIED: 'PARTIALLY_NULLIFIED',
  CAPTURED: 'CAPTURED'
};

// Tipos de pago
const PAYMENT_TYPES = {
  VD: 'Venta Débito',
  VN: 'Venta Normal',
  VC: 'Venta en cuotas',
  SI: 'Sin interés',
  S2: 'Sin interés 2 cuotas',
  NC: 'N cuotas sin interés',
  VP: 'Venta Prepago'
};

// ============================================
// VALIDADORES
// ============================================

/**
 * Valida los datos de entrada para crear una transacción
 */
function validateTransactionData(data) {
  const errors = [];
  
  // Validar clienteId
  if (data.clienteId && (!Number.isInteger(data.clienteId) || data.clienteId <= 0)) {
    errors.push('clienteId debe ser un número entero positivo');
  }
  
  // Validar productos o amount
  if (!data.productos && !data.amount) {
    errors.push('Se requiere productos o amount');
  }
  
  if (data.productos) {
    if (!Array.isArray(data.productos)) {
      errors.push('productos debe ser un array');
    } else {
      data.productos.forEach((producto, index) => {
        if (!producto.ID_Producto || !Number.isInteger(producto.ID_Producto)) {
          errors.push(`Producto ${index}: ID_Producto debe ser un número entero`);
        }
        if (!producto.Cantidad || !Number.isInteger(producto.Cantidad) || producto.Cantidad <= 0) {
          errors.push(`Producto ${index}: Cantidad debe ser un número entero positivo`);
        }
      });
    }
  }
  
  if (data.amount && (!Number.isInteger(data.amount) || data.amount <= 0)) {
    errors.push('amount debe ser un número entero positivo');
  }
  
  // Validar buyOrder
  if (data.buyOrder && (typeof data.buyOrder !== 'string' || data.buyOrder.length > 26)) {
    errors.push('buyOrder debe ser una cadena de máximo 26 caracteres');
  }
  
  // Validar sessionId
  if (data.sessionId && (typeof data.sessionId !== 'string' || data.sessionId.length > 61)) {
    errors.push('sessionId debe ser una cadena de máximo 61 caracteres');
  }
  
  // Validar returnUrl
  if (data.returnUrl && !isValidUrl(data.returnUrl)) {
    errors.push('returnUrl debe ser una URL válida');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida si una cadena es una URL válida
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Valida el formato del token de Webpay
 */
function validateWebpayToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Token de Webpay típicamente tiene 64 caracteres hexadecimales
  const tokenRegex = /^[a-f0-9]{64}$/i;
  return tokenRegex.test(token);
}

// ============================================
// GENERADORES
// ============================================

/**
 * Genera una orden de compra única para FERREMAS
 */
function generateBuyOrder(prefix = 'FER') {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 999) + 100;
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  // Máximo 26 caracteres para Transbank
  return `${prefix}_${timestamp}_${random}_${suffix}`.slice(0, 26);
}

/**
 * Genera un session ID único
 */
function generateSessionId(prefix = 'SES') {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(8).toString('hex');
  
  // Máximo 61 caracteres para Transbank
  return `${prefix}_${timestamp}_${random}`.slice(0, 61);
}

/**
 * Genera un ID de tracking interno
 */
function generateTrackingId() {
  return `TRK_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// ============================================
// PROCESADORES DE RESPUESTA
// ============================================

/**
 * Procesa la respuesta de creación de transacción de Transbank
 */
function processCreateTransactionResponse(response) {
  if (!response || !response.token || !response.url) {
    throw new Error('Respuesta inválida de Transbank: faltan token o url');
  }
  
  return {
    token: response.token,
    url: response.url,
    isValid: validateWebpayToken(response.token),
    instructions: {
      method: 'POST',
      action: response.url,
      field_name: 'token_ws',
      field_value: response.token
    }
  };
}

/**
 * Procesa la respuesta de confirmación de transacción
 */
function processConfirmTransactionResponse(response) {
  const responseCode = parseInt(response.response_code);
  const status = response.status;
  
  const responseInfo = RESPONSE_CODES[responseCode] || { 
    status: 'UNKNOWN', 
    message: 'Código de respuesta desconocido' 
  };
  
  const isApproved = responseCode === 0 && status === 'AUTHORIZED';
  
  return {
    success: isApproved,
    response_code: responseCode,
    response_message: responseInfo.message,
    status: status,
    authorization_code: response.authorization_code,
    buy_order: response.buy_order,
    session_id: response.session_id,
    amount: response.amount,
    card_detail: {
      card_number: response.card_detail?.card_number,
      card_type: getCardType(response.card_detail?.card_number)
    },
    payment_type: {
      code: response.payment_type_code,
      description: PAYMENT_TYPES[response.payment_type_code] || 'Desconocido'
    },
    transaction_date: response.transaction_date,
    accounting_date: response.accounting_date,
    installments_number: response.installments_number || 0,
    vci: response.vci,
    // Campos procesados
    is_approved: isApproved,
    is_rejected: !isApproved,
    can_retry: responseCode === -2,
    error_type: isApproved ? null : responseInfo.status,
    user_message: getUserMessage(responseCode, status)
  };
}

/**
 * Determina el tipo de tarjeta basado en los primeros dígitos
 */
function getCardType(cardNumber) {
  if (!cardNumber) return 'Desconocido';
  
  const firstDigit = cardNumber.charAt(0);
  const firstTwo = cardNumber.substring(0, 2);
  const firstFour = cardNumber.substring(0, 4);
  
  if (firstDigit === '4') return 'Visa';
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'Mastercard';
  if (['34', '37'].includes(firstTwo)) return 'American Express';
  if (firstFour === '6011') return 'Discover';
  if (['36', '38'].includes(firstTwo)) return 'Diners Club';
  
  return 'Desconocido';
}

/**
 * Genera mensaje amigable para el usuario
 */
function getUserMessage(responseCode, status) {
  if (responseCode === 0 && status === 'AUTHORIZED') {
    return '¡Pago aprobado exitosamente!';
  }
  
  switch (responseCode) {
    case -1:
    case -4:
      return 'Tu tarjeta fue rechazada. Verifica los datos o intenta con otra tarjeta.';
    case -2:
      return 'Error temporal. Por favor, intenta nuevamente en unos minutos.';
    case -3:
      return 'Error en la transacción. Contacta a tu banco si el problema persiste.';
    case -5:
      return 'Monto no permitido para tu tarjeta. Contacta a tu banco.';
    case -6:
      return 'Has excedido el cupo máximo mensual de tu tarjeta.';
    case -7:
      return 'Has excedido el límite diario de transacciones.';
    case -8:
      return 'Tipo de comercio no autorizado para tu tarjeta.';
    default:
      return 'No se pudo procesar el pago. Intenta nuevamente o contacta soporte.';
  }
}

// ============================================
// UTILIDADES DE FORMATO
// ============================================

/**
 * Formatea un monto para mostrar al usuario
 */
function formatAmount(amount, currency = 'CLP') {
  if (typeof amount !== 'number') {
    amount = parseInt(amount) || 0;
  }
  
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Formatea una fecha de transacción
 */
function formatTransactionDate(dateString) {
  if (!dateString) return 'Fecha no disponible';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return 'Fecha inválida';
  }
}

/**
 * Formatea el número de tarjeta para mostrar
 */
function formatCardNumber(cardNumber) {
  if (!cardNumber) return '****';
  return `****${cardNumber}`;
}

/**
 * Sanitiza datos sensibles para logs
 */
function sanitizeForLogging(data) {
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remover/ofuscar campos sensibles
  if (sanitized.token) {
    sanitized.token = sanitized.token.substring(0, 8) + '...';
  }
  
  if (sanitized.token_ws) {
    sanitized.token_ws = sanitized.token_ws.substring(0, 8) + '...';
  }
  
  if (sanitized.authorization_code) {
    sanitized.authorization_code = '***' + sanitized.authorization_code.slice(-2);
  }
  
  if (sanitized.card_detail?.card_number) {
    sanitized.card_detail.card_number = '****';
  }
  
  return sanitized;
}

// ============================================
// VALIDADORES DE ESTADO
// ============================================

/**
 * Verifica si una transacción puede ser confirmada
 */
function canConfirmTransaction(transactionStatus) {
  const allowedStatuses = ['PENDIENTE', 'PROCESANDO'];
  return allowedStatuses.includes(transactionStatus);
}

/**
 * Verifica si una transacción puede ser reembolsada
 */
function canRefundTransaction(transactionStatus, transactionDate) {
  if (transactionStatus !== 'APROBADO') {
    return { can: false, reason: 'Solo se pueden reembolsar transacciones aprobadas' };
  }
  
  // Verificar límite de tiempo (ejemplo: 90 días)
  const daysSinceTransaction = (Date.now() - new Date(transactionDate)) / (1000 * 60 * 60 * 24);
  if (daysSinceTransaction > 90) {
    return { can: false, reason: 'No se pueden reembolsar transacciones de más de 90 días' };
  }
  
  return { can: true, reason: null };
}

/**
 * Verifica si una transacción está en estado final
 */
function isFinalStatus(status) {
  const finalStatuses = ['APROBADO', 'RECHAZADO', 'CANCELADO', 'REEMBOLSADO', 'EXPIRADO'];
  return finalStatuses.includes(status);
}

// ============================================
// UTILIDADES DE DEBUGGING
// ============================================

/**
 * Crea un resumen de transacción para debugging
 */
function createTransactionSummary(transaction, webpayResponse = null) {
  return {
    local_transaction: {
      id: transaction.id,
      order: transaction.ordenCompra,
      client: transaction.clienteId,
      amount: transaction.monto,
      status: transaction.estadoTexto,
      created: transaction.createdAt,
      products_count: transaction.detalles ? transaction.detalles.length : 0
    },
    webpay_response: webpayResponse ? sanitizeForLogging(webpayResponse) : null,
    summary: {
      has_local_record: !!transaction,
      has_webpay_response: !!webpayResponse,
      is_successful: transaction?.estadoTexto === 'APROBADO' && 
                     webpayResponse?.status === 'AUTHORIZED',
      needs_attention: transaction?.estadoTexto === 'PENDIENTE' && 
                       webpayResponse?.status !== 'AUTHORIZED'
    }
  };
}

/**
 * Valida la integridad de los datos de transacción
 */
function validateTransactionIntegrity(localTransaction, webpayResponse) {
  const issues = [];
  
  if (!localTransaction) {
    issues.push('No existe registro local de la transacción');
    return { isValid: false, issues };
  }
  
  if (!webpayResponse) {
    issues.push('No hay respuesta de Webpay');
    return { isValid: false, issues };
  }
  
  // Validar consistencia de montos
  if (parseInt(localTransaction.monto) !== parseInt(webpayResponse.amount)) {
    issues.push(`Monto inconsistente: Local ${localTransaction.monto} vs Webpay ${webpayResponse.amount}`);
  }
  
  // Validar orden de compra
  if (localTransaction.ordenCompra !== webpayResponse.buy_order) {
    issues.push(`Orden inconsistente: Local ${localTransaction.ordenCompra} vs Webpay ${webpayResponse.buy_order}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// ============================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================

module.exports = {
  // Constantes
  RESPONSE_CODES,
  WEBPAY_STATUS,
  PAYMENT_TYPES,
  
  // Validadores
  validateTransactionData,
  validateWebpayToken,
  isValidUrl,
  
  // Generadores
  generateBuyOrder,
  generateSessionId,
  generateTrackingId,
  
  // Procesadores
  processCreateTransactionResponse,
  processConfirmTransactionResponse,
  getCardType,
  getUserMessage,
  
  // Formateadores
  formatAmount,
  formatTransactionDate,
  formatCardNumber,
  sanitizeForLogging,
  
  // Validadores de estado
  canConfirmTransaction,
  canRefundTransaction,
  isFinalStatus,
  
  // Debugging
  createTransactionSummary,
  validateTransactionIntegrity
};