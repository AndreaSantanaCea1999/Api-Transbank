const devolucionesController = require('../controllers/devolucionesController');

const devolucionesRouter = express.Router();

devolucionesRouter.post('/', devolucionesController.solicitarDevolucion);

module.exports = devolucionesRouter;
