-- ====================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- SISTEMA INTEGRADO FERREMAS
-- ====================================

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS ferremas_complete 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_general_ci;

USE ferremas_complete;

-- ====================================
-- TABLAS PARA API TRANSBANK
-- ====================================

-- Tabla de estados de transacción
CREATE TABLE IF NOT EXISTS estados_transaccion (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL UNIQUE,
    Descripcion VARCHAR(255),
    Activo BOOLEAN DEFAULT TRUE,
    Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar estados por defecto
INSERT IGNORE INTO estados_transaccion (Nombre, Descripcion) VALUES
('Pendiente', 'Transacción creada, esperando confirmación'),
('Aprobado', 'Transacción aprobada y procesada exitosamente'),
('Rechazado', 'Transacción rechazada por error de pago o validación'),
('Cancelado', 'Transacción cancelada por el usuario'),
('Reembolsado', 'Transacción reembolsada exitosamente');

-- Tabla principal de transacciones
CREATE TABLE IF NOT EXISTS transbank_transacciones (
    ID_Transaccion INT AUTO_INCREMENT PRIMARY KEY,
    ID_Cliente INT NOT NULL,
    Orden_Compra VARCHAR(50) NOT NULL,
    Monto DECIMAL(12,2) NOT NULL,
    Divisa VARCHAR(10) NOT NULL DEFAULT 'CLP',
    Estado_Id INT NOT NULL,
    Detalles JSON,
    Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Fecha_Actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_cliente (ID_Cliente),
    INDEX idx_orden (Orden_Compra),
    INDEX idx_fecha (Fecha_Creacion),
    INDEX idx_estado (Estado_Id),
    
    FOREIGN KEY (Estado_Id) REFERENCES estados_transaccion(ID) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de logs de Transbank
CREATE TABLE IF NOT EXISTS transbank_logs (
    ID_Log INT AUTO_INCREMENT PRIMARY KEY,
    ID_Transaccion INT NULL,
    Accion VARCHAR(50) NOT NULL,
    Descripcion VARCHAR(500),
    Datos_Entrada TEXT,
    Datos_Salida TEXT,
    Codigo_Respuesta VARCHAR(10),
    Mensaje_Error TEXT,
    IP_Origen VARCHAR(45),
    User_Agent TEXT,
    Fecha_Log TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Duracion_MS INT,
    
    INDEX idx_transaccion (ID_Transaccion),
    INDEX idx_accion (Accion),
    INDEX idx_fecha (Fecha_Log),
    INDEX idx_codigo (Codigo_Respuesta),
    
    FOREIGN KEY (ID_Transaccion) REFERENCES transbank_transacciones(ID_Transaccion) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================
-- TABLAS ADICIONALES PARA INTEGRACIÓN
-- ====================================

-- Tabla de clientes (si no existe en otras APIs)
CREATE TABLE IF NOT EXISTS clientes (
    ID_Cliente INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Email VARCHAR(150) UNIQUE,
    Telefono VARCHAR(20),
    Direccion TEXT,
    Fecha_Registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_email (Email),
    INDEX idx_activo (Activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar clientes de prueba
INSERT IGNORE INTO clientes (ID_Cliente, Nombre, Email, Telefono, Direccion) VALUES
(1, 'Juan Pérez', 'juan.perez@email.com', '+56912345678', 'Av. Providencia 1234, Santiago'),
(2, 'María González', 'maria.gonzalez@email.com', '+56987654321', 'Calle Las Flores 567, Valparaíso'),
(3, 'Cliente de Prueba', 'test@ferremas.cl', '+56900000000', 'Dirección de Prueba 123');

-- ====================================
-- VISTAS ÚTILES PARA REPORTES
-- ====================================

-- Vista de transacciones con estado
CREATE OR REPLACE VIEW v_transacciones_completas AS
SELECT 
    t.ID_Transaccion,
    t.ID_Cliente,
    c.Nombre AS Nombre_Cliente,
    t.Orden_Compra,
    t.Monto,
    t.Divisa,
    e.Nombre AS Estado,
    e.Descripcion AS Estado_Descripcion,
    t.Detalles,
    t.Fecha_Creacion,
    t.Fecha_Actualizacion
FROM transbank_transacciones t
LEFT JOIN estados_transaccion e ON t.Estado_Id = e.ID
LEFT JOIN clientes c ON t.ID_Cliente = c.ID_Cliente;

-- Vista de estadísticas por estado
CREATE OR REPLACE VIEW v_estadisticas_transacciones AS
SELECT 
    e.Nombre AS Estado,
    COUNT(t.ID_Transaccion) AS Total_Transacciones,
    COALESCE(SUM(t.Monto), 0) AS Monto_Total,
    COALESCE(AVG(t.Monto), 0) AS Monto_Promedio,
    MIN(t.Fecha_Creacion) AS Primera_Transaccion,
    MAX(t.Fecha_Creacion) AS Ultima_Transaccion
FROM estados_transaccion e
LEFT JOIN transbank_transacciones t ON e.ID = t.Estado_Id
GROUP BY e.ID, e.Nombre
ORDER BY Total_Transacciones DESC;

-- Vista de logs con información de transacción
CREATE OR REPLACE VIEW v_logs_detallados AS
SELECT 
    l.ID_Log,
    l.ID_Transaccion,
    t.Orden_Compra,
    l.Accion,
    l.Descripcion,
    l.Codigo_Respuesta,
    l.Mensaje_Error,
    l.IP_Origen,
    l.Fecha_Log,
    l.Duracion_MS
FROM transbank_logs l
LEFT JOIN transbank_transacciones t ON l.ID_Transaccion = t.ID_Transaccion
ORDER BY l.Fecha_Log DESC;

-- ====================================
-- PROCEDIMIENTOS ALMACENADOS ÚTILES
-- ====================================

DELIMITER //

-- Procedimiento para limpiar logs antiguos
CREATE PROCEDURE IF NOT EXISTS LimpiarLogsAntiguos(IN dias_antiguedad INT)
BEGIN
    DECLARE logs_eliminados INT DEFAULT 0;
    
    DELETE FROM transbank_logs 
    WHERE Fecha_Log < DATE_SUB(NOW(), INTERVAL dias_antiguedad DAY);
    
    SET logs_eliminados = ROW_COUNT();
    
    SELECT CONCAT('Logs eliminados: ', logs_eliminados) AS Resultado;
END//

-- Procedimiento para obtener estadísticas rápidas
CREATE PROCEDURE IF NOT EXISTS ObtenerEstadisticasRapidas()
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM transbank_transacciones) AS Total_Transacciones,
        (SELECT COUNT(*) FROM transbank_transacciones t 
         JOIN estados_transaccion e ON t.Estado_Id = e.ID 
         WHERE e.Nombre = 'Aprobado') AS Transacciones_Aprobadas,
        (SELECT COUNT(*) FROM transbank_transacciones t 
         JOIN estados_transaccion e ON t.Estado_Id = e.ID 
         WHERE e.Nombre = 'Pendiente') AS Transacciones_Pendientes,
        (SELECT COALESCE(SUM(Monto), 0) FROM transbank_transacciones t 
         JOIN estados_transaccion e ON t.Estado_Id = e.ID 
         WHERE e.Nombre = 'Aprobado') AS Monto_Total_Aprobado,
        (SELECT COUNT(*) FROM transbank_logs) AS Total_Logs,
        (SELECT COUNT(*) FROM clientes WHERE Activo = TRUE) AS Clientes_Activos;
END//

DELIMITER ;

-- ====================================
-- CONFIGURACIONES DE OPTIMIZACIÓN
-- ====================================

-- Optimizar tablas
OPTIMIZE TABLE transbank_transacciones;
OPTIMIZE TABLE transbank_logs;
OPTIMIZE TABLE estados_transaccion;
OPTIMIZE TABLE clientes;

-- ====================================
-- TRIGGERS PARA AUDITORÍA
-- ====================================

DELIMITER //

-- Trigger para actualizar fecha de modificación en transacciones
CREATE TRIGGER IF NOT EXISTS tr_transacciones_update 
    BEFORE UPDATE ON transbank_transacciones
    FOR EACH ROW
BEGIN
    SET NEW.Fecha_Actualizacion = CURRENT_TIMESTAMP;
END//

DELIMITER ;

-- ====================================
-- CONSULTAS DE VERIFICACIÓN
-- ====================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'ferremas_complete' 
    AND TABLE_NAME LIKE 'transbank_%'
    OR TABLE_NAME IN ('estados_transaccion', 'clientes');

-- Verificar estados creados
SELECT * FROM estados_transaccion ORDER BY ID;

-- Verificar clientes de prueba
SELECT ID_Cliente, Nombre, Email FROM clientes;

-- Mostrar estructura de tabla principal
DESCRIBE transbank_transacciones;

-- ====================================
-- PERMISOS Y USUARIOS (OPCIONAL)
-- ====================================

-- Crear usuario específico para la aplicación (opcional)
-- CREATE USER IF NOT EXISTS 'ferremas_app'@'localhost' IDENTIFIED BY 'password_seguro';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ferremas_complete.* TO 'ferremas_app'@'localhost';
-- FLUSH PRIVILEGES;

-- ====================================
-- MENSAJE FINAL
-- ====================================

SELECT 
    '✅ Base de datos configurada correctamente para FERREMAS' AS Mensaje,
    (SELECT COUNT(*) FROM estados_transaccion) AS Estados_Creados,
    (SELECT COUNT(*) FROM clientes) AS Clientes_Prueba,
    NOW() AS Fecha_Configuracion;