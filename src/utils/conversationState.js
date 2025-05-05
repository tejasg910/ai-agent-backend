// lib/stateStore.js

const { createClient } = require('redis');
const { v4: uuid } = require('uuid');

const redis = createClient();

redis.connect();

class StateStore {
  async create() {
    const sessionId = uuid();
    await redis.hSet(`session:${sessionId}`, {
      step: 0,
      entities: JSON.stringify({}),
    });
    return sessionId;
  }

  async get(sessionId) {
    const data = await redis.hGetAll(`session:${sessionId}`);
    if (!data || !Object.keys(data).length) return null;
    return {
      step: Number(data.step),
      entities: JSON.parse(data.entities),
    };
  }

  async update(sessionId, data) {
    const current = await this.get(sessionId) || {};
    const updated = {
      ...current,
      ...data,
      entities: JSON.stringify({
        ...(current.entities || {}),
        ...(data.entities || {}),
      }),
    };
    await redis.hSet(`session:${sessionId}`, {
      step: updated.step,
      entities: updated.entities,
    });
  }

  async remove(sessionId) {
    await redis.del(`session:${sessionId}`);
  }
}

module.exports = new StateStore();
