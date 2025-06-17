const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pagos = sequelize.define('pagos', {
  ID_Pago: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ID_Pedido: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Codigo_Pago: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  Metodo_Pago: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['WebPay', 'Transferencia', 'Efectivo', 'Cheque']]
    }
  },
  Monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  ID_Divisa: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  Estado: {
    type: DataTypes.STRING(20),
    defaultValue: 'Pendiente',
    validate: {
      isIn: [['Pendiente', 'Procesando', 'Aprobado', 'Rechazado', 'Cancelado', 'Reembolsado']]
    }
  },
  Fecha_Pago: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Fecha_Procesamiento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Referencia_Externa: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Comentarios: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'pagos',
  timestamps: false
});

module.exports = Pagos;