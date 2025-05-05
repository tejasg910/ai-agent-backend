const axios = require('axios');
const RASA_URL = process.env.RASA_URL;

module.exports = {
  async sendMessage(sessionId, message) {
    const res = await axios.post(
      `${RASA_URL}/webhooks/rest/webhook`,
      { sender: sessionId, message }
    );
    // Rasa returns an array of { text: "…"} replies
    return res.data.map(r => r.text).join(' ');
  }
};
