const { 
  TransbankTransacciones, 
  TransbankEstadosTransaccion,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

const estadisticasRouter = express.Router();

// Dashboard de estadísticas
estadisticasRouter.get('/dashboard', async (req, res) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    // Estadísticas del mes actual
    const estadisticasMes = await TransbankTransacciones.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('ID_Transaccion')), 'total_transacciones'],
        [sequelize.fn('SUM', sequelize.col('Monto')), 'monto_total'],
        [sequelize.fn('AVG', sequelize.col('Monto')), 'monto_promedio']
      ],
      where: {
        Fecha_Creacion: {
          [Op.between]: [inicioMes, finMes]
        }
      },
      include: [{
        model: TransbankEstadosTransaccion,
        as: 'estado',
        where: {
          Codigo_Estado: 'AUTH'
        }
      }],
      raw: true
    });

    // Transacciones por estado
    const transaccionesPorEstado = await TransbankTransacciones.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('TransbankTransacciones.ID_Transaccion')), 'cantidad']
      ],
      include: [{
        model: TransbankEstadosTransaccion,
        as: 'estado',
        attributes: ['Codigo_Estado', 'Nombre_Estado']
      }],
      where: {
        Fecha_Creacion: {
          [Op.between]: [inicioMes, finMes]
        }
      },
      group: ['estado.ID_Estado'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        resumenMes: estadisticasMes[0] || {
          total_transacciones: 0,
          monto_total: 0,
          monto_promedio: 0
        },
        transaccionesPorEstado: transaccionesPorEstado.map(t => ({
          estado: t['estado.Nombre_Estado'],
          codigo: t['estado.Codigo_Estado'],
          cantidad: parseInt(t.cantidad)
        })),
        periodo: {
          inicio: inicioMes,
          fin: finMes
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

module.exports = estadisticasRouter;