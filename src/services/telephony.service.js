const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const telephonyService = {
  makeCall: async (to, sessionId) => {
    const from = process.env.TWILIO_PHONE_NUMBER;
    const host = process.env.PUBLIC_HOST; // e.g. https://5345-152-56-13-137.ngrok-free.app
    const url = `${host}/api/voice/ivr?sessionId=${sessionId}`;
    const statusCallback = `${host}/api/voice/call-status`;

    if (!from || !from.startsWith('+')) {
      throw new Error('Invalid or missing TWILIO_PHONE_NUMBER in environment variables');
    }

    const call = await client.calls.create({
      to,
      from,
      url,
      method: 'GET',
      statusCallback, // Add this to receive call status updates
      statusCallbackMethod: 'POST',
    });

    return { sid: call.sid };
  },
};

module.exports = telephonyService;