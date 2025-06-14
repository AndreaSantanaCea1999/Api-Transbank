const { TransbankComercios } = require('../models');

const comerciosRouter = express.Router();

// Listar comercios
comerciosRouter.get('/', async (req, res) => {
  try {
    const comercios = await TransbankComercios.findAll({
      attributes: ['ID_Comercio', 'Codigo_Comercio', 'Nombre_Comercio', 'Estado', 'Ambiente']
    });

    res.json({
      success: true,
      data: comercios
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener comercios',
      error: error.message
    });
  }
});

module.exports = comerciosRouter;