const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  candidate_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  transcript: { type: String, required: true },
  entities_extracted: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },

});
module.exports = mongoose.model('Conversation', ConversationSchema);