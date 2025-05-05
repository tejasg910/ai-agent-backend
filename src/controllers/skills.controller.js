const SkillsService = require('../services/skills.service');

// GET /api/skills
exports.getSkills = async (req, res, next) => {
  try {
    const skills = await SkillsService.getAll();
    res.json(skills);
  } catch (err) {
    next(err);
  }
};

// POST /api/skills/seed
exports.seedSkills = async (req, res, next) => {
  try {
    const seedData = require('../../data/skills.seed');
    const result = await SkillsService.createMany(seedData);
    res.status(201).json({ insertedCount: result.length });
  } catch (err) {
    // ignore duplicate-key errors on re-seeding
    if (err.code === 11000) {
      return res.status(200).json({ message: 'Skills already seeded' });
    }
    next(err);
  }
};
