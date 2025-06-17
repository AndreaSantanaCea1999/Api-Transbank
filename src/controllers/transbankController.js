const { Transaccion, EstadoTransaccion, Cuotas, DetalleTransaccion, Logs } = require('../models');

const iniciarTransaccion = async (req, res) => {
  try {
    const { monto, metodo_pago, cuotas } = req.body;

    const transaccion = await Transaccion.create({
      monto,
      metodo_pago,
      estado_id: 1, // 1: pendiente
    });

    if (cuotas) {
      await Cuotas.create({ id_transaccion: transaccion.id_transaccion, cantidad_cuotas: cuotas });
    }

    res.status(201).json({ success: true, transaccion });
  } catch (error) {
    await Logs.create({ mensaje: error.message });
    res.status(500).json({ success: false, message: 'Error al iniciar transacción' });
  }
};

const confirmarTransaccion = async (req, res) => {
  try {
    const { id_transaccion } = req.body;
    const transaccion = await Transaccion.findByPk(id_transaccion);

    if (!transaccion) return res.status(404).json({ message: 'No encontrada' });

    transaccion.estado_id = 2; // 2: pagado
    await transaccion.save();

    res.json({ success: true, message: 'Transacción confirmada', transaccion });
  } catch (error) {
    await Logs.create({ mensaje: error.message });
    res.status(500).json({ success: false, message: 'Error al confirmar' });
  }
};

const obtenerEstado = async (req, res) => {
  const { id } = req.params;
  const transaccion = await Transaccion.findByPk(id, {
    include: EstadoTransaccion,
  });
  if (!transaccion) return res.status(404).json({ message: 'No encontrada' });
  res.json(transaccion);
};

const obtenerLogs = async (req, res) => {
  const logs = await Logs.findAll();
  res.json(logs);
};

module.exports = {
  iniciarTransaccion,
  confirmarTransaccion,
  obtenerEstado,
  obtenerLogs,
};