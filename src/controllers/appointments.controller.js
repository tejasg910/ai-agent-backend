const appointmentService = require('../services/appointments.service');
const AppointmentsService = require('../services/appointments.service');

exports.createAppointment = async (req, res, next) => {
  try {
    const appt = await AppointmentsService.create(req.body);
    res.status(201).json(appt);
  } catch (err) {
    next(err);
  }
};


exports.getById = async (req, res, next) => {
  try {
    await AppointmentsService.findAndUpdateAppointmentStatus({
      
    });
    const data = await AppointmentsService.getById(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
exports.getAllAppointments = async (req, res, next) => {
  try {
    await AppointmentsService.findAndUpdateAppointmentStatus({
      
    });
    const list = await AppointmentsService.getAll(req);
    res.json(list);
  } catch (err) {
    next(err);
  }
};


exports.getForCandidate = async (req, res, next) => {
  try {


    const id = req.params.candidateId;
    console.log(id, "Thiss i in get for andiate")
    const list = await AppointmentsService.getForCandidate(id, req.user._id);
    console.log("this si lkst", list)
    res.json(list);
  } catch (err) {
    next(err);
  }
};
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const appt = await AppointmentsService.updateStatus(req.params.id, req.body.status);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    next(err);
  }
};

exports.deleteAppointment = async (req, res, next) => {
  try {
    const appt = await AppointmentsService.delete(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }



};