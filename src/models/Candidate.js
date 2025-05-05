const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const CandidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  about: {
    type: String,
  },
  current_ctc: {
    type: Number,
  },

  score: {
    type: Number,
    default: 0,
  },
  expected_ctc: {
    type: Number,
  },
  notice_period: {
    type: String,
  },
  experience: {
    type: Number,
    default: 0,
  },
  location_preference: {
    type: String,
    enum: ['onsite', 'remote', 'hybrid', 'flexible'],
    default: 'flexible',
  },
  status: {
    type: String,
    enum: ['pending', 'screening', 'shortlisted', 'rejected', 'hired'],
    default: 'pending',
  },

  source: {
    type: String,
    enum: ['form', "manual"],
    required: true
  },
  jobAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
  },
  ratings: {
    type: [RatingSchema],
    default: [],
  },
  available: {
    type: Date,
  },
  last_contact: {
    type: Date,
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

// Index for efficient querying by status and last_contact
CandidateSchema.index({ status: 1, last_contact: 1 });

module.exports = mongoose.model('Candidate', CandidateSchema);