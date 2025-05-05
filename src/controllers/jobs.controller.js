const JobsService = require('../services/jobs.service');

exports.createJob = async (req, res, next) => {
  try {
    const job = await JobsService.create({ ...req.body, userId: req.user._id });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
};

exports.getAllJobs = async (req, res, next) => {
  try {
    const jobs = await JobsService.getAll(req.query, req.user._id);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};


exports.getAllJobsForCandidates = async (req, res, next) => {
  try {
    const jobs = await JobsService.getAllJobsForCanidates(req.params.id);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};


exports.getAllJobsForCandidatesRecruiter = async (req, res, next) => {
  try {
    const jobs = await JobsService.getAllJobsForCanidatesRecruiter(req.user._id);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};

exports.getJobById = async (req, res, next) => {
  try {
    const job = await JobsService.getById(req.params.id).populate("skills");
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
};

exports.updateJob = async (req, res, next) => {
  try {
    const job = await JobsService.update(req.params.id, req.body);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
};

exports.deleteJob = async (req, res, next) => {
  try {
    const job = await JobsService.delete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};