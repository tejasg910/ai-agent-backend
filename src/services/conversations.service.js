const Conversation = require('../models/Conversation');
exports.create = data => Conversation.create(data);
exports.getByCandidate = candidate_id => Conversation.find({ candidate_id });