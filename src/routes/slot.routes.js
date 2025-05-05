const router = require('express').Router();
const slotsCtrl = require('../controllers/slots.controller');
const authMiddleware = require('../middleware/auth');

// Create a single slot
router.post('/', authMiddleware, slotsCtrl.createSlot);

// Generate multiple slots in a date range
router.post('/generate',authMiddleware,  slotsCtrl.generateSlots);

// Get all available slots
router.get('/', authMiddleware, slotsCtrl.getAvailableSlots);

// Get available slots for a specific date
router.get('/date/:date', authMiddleware, slotsCtrl.getSlotsForDate);

// Get slots by interviewer
router.get('/interviewer/:interviewer_id', authMiddleware, slotsCtrl.getSlotsByInterviewer);

// Release a slot
router.patch('/:id/release', authMiddleware, slotsCtrl.releaseSlot);

module.exports = router;