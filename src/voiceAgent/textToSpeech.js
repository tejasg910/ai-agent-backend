
// Mozilla TTS wrapper (stub)
const vosk = require('vosk');
module.exports = {
    speak: async (text) => {
      // TODO: call Mozilla TTS REST API or local server
      return Buffer.from('audio-bytes');
    }
  };