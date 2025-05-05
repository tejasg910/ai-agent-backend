const router = require('express').Router();
const skillsController = require('../controllers/skills.controller');

// Public: list skills
router.get('/', skillsController.getSkills);

// Dev-only: seed initial skills
router.post('/seed', skillsController.seedSkills);

module.exports = router;
