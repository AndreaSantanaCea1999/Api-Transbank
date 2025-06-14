const constants = {
  // Estados de transacciones
  TRANSACTION_STATES: {
    INIT: 'INIT',
    PENDING: 'PEND',
    AUTHORIZED: 'AUTH',
    FAILED: 'FAIL',
    CANCELLED: 'CANC',
    EXPIRED: 'EXPR',
    REVERSED: 'REVE'
  },
  
  // Códigos de respuesta Transbank
  TRANSBANK_RESPONSE_CODES: {
    SUCCESS: 0,
    REJECTED: -1,
    INVALID: -2,
    TIMEOUT: -3,
    CARD_ERROR: -4,
    INSUFFICIENT_FUNDS: -5,
    EXPIRED_CARD: -6,
    BLOCKED_CARD: -7
  },
  
  // Tipos de tarjeta
  CARD_TYPES: {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard',
    AMEX: 'American Express',
    DINERSCLUB: 'Dinners Club',
    MAGNA: 'Magna'
  },
  
  // Límites del sistema
  LIMITS: {
    MIN_AMOUNT: 50,           // Monto mínimo en pesos
    MAX_AMOUNT: 999999999,    // Monto máximo en pesos
    MAX_INSTALLMENTS: 24,     // Máximo número de cuotas
    TRANSACTION_TIMEOUT: 30,  // Timeout en minutos
    MAX_RETRIES: 3            // Reintentos máximos
  },
  
  // Configuración de rate limiting
  RATE_LIMITS: {
    TRANSACTIONS_PER_MINUTE: 10,
    QUERIES_PER_MINUTE: 60,
    WINDOW_SIZE_MS: 60 * 1000
  },
  
  // Mensajes de error estándar
  ERROR_MESSAGES: {
    INVALID_AMOUNT: 'El monto debe estar entre $50 y $999.999.999',
    INSUFFICIENT_STOCK: 'Stock insuficiente para completar la transacción',
    TRANSACTION_NOT_FOUND: 'Transacción no encontrada',
    INVALID_TOKEN: 'Token de transacción inválido',
    EXPIRED_TRANSACTION: 'La transacción ha expirado',
    PAYMENT_REJECTED: 'El pago fue rechazado por el banco',
    RATE_LIMIT_EXCEEDED: 'Demasiadas solicitudes, intente más tarde',
    INVALID_API_KEY: 'Clave de API inválida o faltante',
    DATABASE_ERROR: 'Error de conexión a la base de datos',
    INTEGRATION_ERROR: 'Error de integración con servicios externos'
  },
  
  // Configuración de APIs externas
  EXTERNAL_APIS: {
    TRANSBANK: {
      INTEGRATION_URL: 'https://webpay3gint.transbank.cl',
      PRODUCTION_URL: 'https://webpay3g.transbank.cl',
      API_VERSION: '1.2',
      TIMEOUT_MS: 30000
    },
    INVENTARIO: {
      TIMEOUT_MS: 5000,
      RETRY_ATTEMPTS: 2
    },
    BANCO: {
      TIMEOUT_MS: 10000,
      RETRY_ATTEMPTS: 3
    }
  },
  
  // Configuración de logging
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'verbose'
  },
  
  // Configuración de base de datos
  DATABASE: {
    CONNECTION_TIMEOUT: 30000,
    QUERY_TIMEOUT: 15000,
    MAX_CONNECTIONS: 10,
    MIN_CONNECTIONS: 2
  }
};

module.exports = constants;