const Skill = require('../models/Skill');

exports.getAll = () => {
  return Skill.find().sort({ name: 1 });
};

exports.createMany = (skillsArray) => {
  // `ordered: false` continues on duplicates
  return Skill.insertMany(skillsArray, { ordered: false });
};
