const Session = require('../models/Session');
const { v4: uuid } = require('uuid');

const sessionStore = {
  async create(data) {
    const sessionId = uuid();
    const session = await Session.create({
      sessionId,
      candidateId: data.candidateId,
      jobId: data.jobId || null,
      entities: data.entities || {},
      conversationHistory: data.conversationHistory || [],
      step: data.step || 0,
      recruiterId: data.recruiterId
    });
    return sessionId;
  },

  async get(sessionId) {
    return await Session.findOne({ sessionId });
  },

  async update(sessionId, data) {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }
    if (data.entities) {
      data.entities = { ...session.entities, ...data.entities };
    }
    return await Session.findOneAndUpdate({ sessionId }, { $set: data }, { new: true });
  },

  async remove(sessionId) {
    return await Session.deleteOne({ sessionId });
  },
};

module.exports = sessionStore;