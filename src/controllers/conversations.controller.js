const ConversationsService = require('../services/conversations.service');

exports.createConversation = async (req, res, next) => {
  try {
    const conv = await ConversationsService.create(req.body);
    res.status(201).json(conv);
  } catch (err) {
    next(err);
  }
};

exports.getConversationsByCandidate = async (req, res, next) => {
  try {
    const list = await ConversationsService.getByCandidate(req.params.candidate_id);
    res.json(list);
  } catch (err) {
    next(err);
  }
};