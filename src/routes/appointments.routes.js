const router = require('express').Router();
const appointmentsController = require('../controllers/appointments.controller');
const authMiddleware = require('../middleware/auth');
const { validateAppointment } = require('../middleware/validateInput');
const formController = require('../controllers/form.controller');
const interviewController = require('../controllers/interview.controller');
router.post('/', authMiddleware, validateAppointment, appointmentsController.createAppointment);
router.get('/', authMiddleware, appointmentsController.getAllAppointments);
router.put('/:id', authMiddleware, appointmentsController.updateAppointmentStatus);
router.get('/candidate/:candidateId', authMiddleware, appointmentsController.getForCandidate);
router.get('/:id', authMiddleware, appointmentsController.getById);
router.delete('/:id', authMiddleware, appointmentsController.deleteAppointment);
router.post('/schedule', authMiddleware, interviewController.validateScheduleInterview,
    interviewController.scheduleInterviewRecruiter);

module.exports = router;