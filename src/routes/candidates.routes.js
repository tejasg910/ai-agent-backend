const router = require('express').Router();
const candidatesController = require('../controllers/candidates.controller');
const authMiddleware = require('../middleware/auth');
const { validateCandidate } = require('../middleware/validateInput');

router.post('/', authMiddleware, validateCandidate, candidatesController.createCandidate);
router.get('/', authMiddleware, candidatesController.getAllCandidates);
router.get('/:id', authMiddleware, candidatesController.getCandidateById);
router.put('/:id', authMiddleware, validateCandidate, candidatesController.updateCandidate);
router.delete('/:id', authMiddleware, candidatesController.deleteCandidate);

module.exports = router;