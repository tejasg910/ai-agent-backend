const mongoose = require('mongoose');

const CallQueueSchema = new mongoose.Schema({
  candidate_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
  },
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: false,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  },
  priority: {
    type: Number,
    default: 0,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  max_attempts: {
    type: Number,
    default: 3,
    min: [1, 'Max attempts must be at least 1'],
  },
  last_attempt: {
    type: Date,
  },
  scheduled_time: {
    type: Date,
    default: Date.now,
  },
  session_id: {
    type: String,
  },
  call_sid: {
    type: String,
  },
  error_message: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
   recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }
});

CallQueueSchema.index({ candidate_id: 1, job_id: 1, status: 1 }, { unique: false });

module.exports = mongoose.model('CallQueue', CallQueueSchema);
