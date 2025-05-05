// models/InterviewRound.js
const mongoose = require('mongoose');

const InterviewRoundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  }
});

module.exports = mongoose.model('InterviewRound', InterviewRoundSchema);
