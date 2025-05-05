const CandidatesService = require('../services/candidates.service');

exports.createCandidate = async (req, res, next) => {
  try {
    const {source = "manual"} = req.body;
    const cand = await CandidatesService.create({ ...req.body, recruiterId: req.user._id, source, });
    res.status(201).json(cand);
  } catch (err) {
    next(err);
  }
};

exports.getAllCandidates = async (req, res, next) => {
  try {
    const list = await CandidatesService.getAll(req.user._id, req.query);
    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.getCandidateById = async (req, res, next) => {
  try {
    const cand = await CandidatesService.getById(req.params.id)
    if (!cand) return res.status(404).json({ message: 'Candidate not found' });
    res.json(cand);
  } catch (err) {
    next(err);
  }
};

exports.updateCandidate = async (req, res, next) => {
  try {
    const cand = await CandidatesService.update(req.params.id, req.body);
    if (!cand) return res.status(404).json({ message: 'Candidate not found' });
    res.json(cand);
  } catch (err) {
    next(err);
  }
};

exports.deleteCandidate = async (req, res, next) => {
  try {
    const cand = await CandidatesService.delete(req.params.id);
    if (!cand) return res.status(404).json({ message: 'Candidate not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};