-- scripts/setup-database.sql
-- Script para crear las tablas necesarias para Transbank

USE ferremas_complete;

-- Tabla para almacenar las transacciones de Transbank
CREATE TABLE IF NOT EXISTS transbank_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    buy_order VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('created', 'confirmed', 'authorized', 'failed', 'refunded', 'cancelled') DEFAULT 'created',
    
    -- URLs y datos de Transbank
    transbank_url TEXT,
    
    -- Datos de respuesta de Transbank
    response_code INT NULL,
    authorization_code VARCHAR(255) NULL,
    transaction_date DATETIME NULL,
    amount_confirmed DECIMAL(10,2) NULL,
    installments_number INT NULL,
    card_detail JSON NULL,
    raw_response JSON NULL,
    
    -- Datos de reembolso
    refund_amount DECIMAL(10,2) NULL,
    refund_date DATETIME NULL,
    refund_response JSON NULL,
    
    -- Validaciones del banco
    bank_validation ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    bank_balance_updated BOOLEAN DEFAULT FALSE,
    bank_balance_date DATETIME NULL,
    
    -- Usuario asociado (opcional)
    user_id INT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_status_check TIMESTAMP NULL,
    
    -- Índices
    INDEX idx_token (token),
    INDEX idx_buy_order (buy_order),
    INDEX idx_status (status),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_amount (amount)
);

-- Tabla para logs de comunicación con APIs externas
CREATE TABLE IF NOT EXISTS transbank_api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_token VARCHAR(255),
    api_type ENUM('transbank', 'bank') NOT NULL,
    action VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    request_data JSON NULL,
    response_data JSON NULL,
    response_code INT NULL,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT NULL,
    execution_time_ms INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token (transaction_token),
    INDEX idx_api_type (api_type),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_success (success)
);

-- Tabla para configuraciones de Transbank
CREATE TABLE IF NOT EXISTS transbank_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    environment ENUM('development', 'production') NOT NULL,
    api_key_id VARCHAR(255) NOT NULL,
    api_key_secret VARCHAR(500) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_env (environment)
);

-- Insertar configuraciones por defecto
INSERT INTO transbank_config (environment, api_key_id, api_key_secret, base_url, is_active) 
VALUES 
    ('development', '597055555532', '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C', 'https://webpay3gint.transbank.cl', TRUE),
    ('production', '597055555532', '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C', 'https://webpay3g.transbank.cl', FALSE)
ON DUPLICATE KEY UPDATE 
    api_key_id = VALUES(api_key_id),
    api_key_secret = VALUES(api_key_secret),
    base_url = VALUES(base_url);

-- Vista para obtener estadísticas de transacciones
CREATE OR REPLACE VIEW transbank_stats AS
SELECT 
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN status = 'authorized' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
    COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_payments,
    SUM(CASE WHEN status = 'authorized' THEN amount ELSE 0 END) as total_revenue,
    SUM(CASE WHEN status = 'refunded' THEN refund_amount ELSE 0 END) as total_refunded,
    AVG(CASE WHEN status = 'authorized' THEN amount END) as avg_transaction_amount,
    DATE(created_at) as transaction_date
FROM transbank_transactions
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY transaction_date DESC;

-- Procedimiento para limpiar transacciones antiguas
DELIMITER //
CREATE PROCEDURE CleanOldTransactions(IN days_old INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Eliminar logs antiguos
    DELETE FROM transbank_api_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    -- Eliminar transacciones fallidas antiguas
    DELETE FROM transbank_transactions 
    WHERE status IN ('failed', 'cancelled') 
    AND created_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    COMMIT;
    
    SELECT 
        'Cleanup completed' as message,
        ROW_COUNT() as deleted_records;
END //
DELIMITER ;

-- Trigger para logging automático de cambios en transacciones importantes
DELIMITER //
CREATE TRIGGER transbank_transaction_status_log
    AFTER UPDATE ON transbank_transactions
    FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status AND NEW.status IN ('authorized', 'failed', 'refunded') THEN
        INSERT INTO transbank_api_logs (
            transaction_token, 
            api_type, 
            action, 
            method,
            url,
            response_data,
            success,
            created_at
        ) VALUES (
            NEW.token,
            'system',
            CONCAT('status_changed_to_', NEW.status),
            'UPDATE',
            'internal://status_change',
            JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status),
            TRUE,
            NOW()
        );
    END IF;
END //
DELIMITER ;

-- Mostrar información de las tablas creadas
SELECT 
    'Database setup completed successfully!' as message,
    'Tables created:' as info;

SHOW TABLES LIKE 'transbank_%';

-- Mostrar estructura de la tabla principal
DESCRIBE transbank_transactions;