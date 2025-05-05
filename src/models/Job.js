const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  requirements: {
    type: String,
  },
  min_experience: {
    type: Number,
    default: 0,
  },
  ctc_range: {
    min: { type: Number },
    max: { type: Number },
  },
  location: {
    type: String,
  },
  job_type: {
    type: String,
    enum: ['onsite', 'remote', 'hybrid'],
    default: 'onsite',
  },
  skills: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'At least one skill must be specified',
    },
  },
  created_at: {
    type: Date,
    default: Date.now,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

// Index for efficient job matching
JobSchema.index({ skills: 1, min_experience: 1 });

module.exports = mongoose.model('Job', JobSchema);