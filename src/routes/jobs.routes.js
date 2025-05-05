const router = require('express').Router();
const jobsController = require('../controllers/jobs.controller');
const authMiddleware = require('../middleware/auth');
const { validateJob } = require('../middleware/validateInput');

router.post('/', authMiddleware, validateJob, jobsController.createJob);
router.get('/', authMiddleware, jobsController.getAllJobs);
router.get('/candidates/:id', jobsController.getAllJobsForCandidates);
router.get('/recruiter', authMiddleware, jobsController.getAllJobsForCandidatesRecruiter);
router.get('/:id', authMiddleware, jobsController.getJobById);
router.put('/:id', authMiddleware, validateJob, jobsController.updateJob);
router.delete('/:id', authMiddleware, jobsController.deleteJob);

module.exports = router;