// routes/api.js
const express = require('express');
const router = express.Router();
const formController = require('../controllers/form.controller');
const interviewController = require('../controllers/interview.controller');
const { validateForm } = require('../middleware/validateInput');
const authMiddleware = require('../middleware/auth');

// Candidate routes
router.post('/candidates',
    validateForm,
    formController.createCandidate
);

router.get('/link',
    authMiddleware,
    formController.getFormLink
);
router.get('/check-valid/:id',

    formController.checkValid
);

// Interview scheduling routes
router.get('/candidates/:candidateId/slots',
    interviewController.getAvailableSlotsForCandidate
);

router.post('/interviews/schedule',
    interviewController.validateScheduleInterview,
    interviewController.scheduleInterview
);

module.exports = router;