const express = require('express');
const router = express.Router();
const controller = require('../controllers/transbankController');

router.post('/iniciar', controller.iniciarTransaccion);
router.post('/confirmar', controller.confirmarTransaccion);
router.get('/estado/:id', controller.obtenerEstado);
router.get('/logs', controller.obtenerLogs);

module.exports = router;

// === src/app.js ===
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const transbankRoutes = require('./routes/transbankRoutes');
app.use('/api/transbank', transbankRoutes);

sequelize.sync({ force: false }).then(() => {
  console.log('Base de datos conectada');
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
});
