const sessionStore = require('../utils/sessionStore');
const gptDialogue = require('../utils/gptWorker'); // Corrected import
const callWorker = require('../utils/callWorker');

exports.startCall = async (req, res, next) => {
  try {
    // Manually queue candidates without appointments
    const queuedCount = await callWorker.queueCandidatesWithoutAppointments(req);

    // Ensure the call worker is running
    if (!callWorker.isRunning) {
      callWorker.start(req);
    }

    res.json({
      success: true,
      message: `Added ${queuedCount} candidates to the call queue`,
    });
  } catch (error) {
    next(error);
  }
};

exports.ivr = async (req, res) => {
  try {
    const { sessionId, retryCount = 0 } = req.query;
    const maxRetries = 3; // Maximum retry attempts

    // Initialize Twilio response
    const VoiceResponse = require('twilio').twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    console.log("came in vr ");

    // Get session data
    const session = await sessionStore.get(sessionId);
    console.log("this is session ");
    if (!session) {
      twiml.say({ voice: 'Polly.Joanna' }, 'Session not found. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    console.log(req.body, "This is body");

    // On POST, process reply from candidate
    if (req.body && req.body.SpeechResult) {
      const candidateResponse = req.body.SpeechResult;

      // Process through GPT dialogue service
      const dialogueResponse = await gptDialogue.processDialogue(sessionId, candidateResponse, session.recruiterId);

      // Check if call should end
      if (dialogueResponse.endCall) {
        twiml.say({ voice: 'Polly.Joanna' }, dialogueResponse.message);
        twiml.hangup();
        await sessionStore.remove(sessionId);
        return res.type('text/xml').send(twiml.toString());
      }

      // Continue conversation with enhanced speech recognition
      const gather = twiml.gather({
        input: 'speech', // Optionally add 'dtmf' for keypad fallback: 'speech dtmf'
        action: `/api/voice/ivr?sessionId=${sessionId}`,
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        hints: 'yes, no, remote, hybrid, onsite, experience, skills, CTC, notice period', // Expected keywords
      });

      gather.say({ voice: 'Polly.Joanna' }, dialogueResponse.message);

      // Retry logic if no input detected
      if (parseInt(retryCount) < maxRetries) {
        twiml.redirect({
          method: 'GET',
          url: `/api/voice/ivr?sessionId=${sessionId}&retryCount=${parseInt(retryCount) + 1}`,
        });
      } else {
        twiml.say({ voice: 'Polly.Joanna' }, "I didn’t hear a response after several attempts. We’ll try calling you again later. Goodbye.");
        twiml.hangup();
      }
    } else {
      // Initial call (GET request) - Start the conversation
      const dialogueResponse = await gptDialogue.processDialogue(sessionId, 'Start call');

      const gather = twiml.gather({
        input: 'speech', // Optionally add 'dtmf' for keypad fallback: 'speech dtmf'
        action: `/api/voice/ivr?sessionId=${sessionId}`,
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        hints: 'yes, no, remote, hybrid, onsite, experience, skills, CTC, notice period', // Expected keywords
      });

      gather.say({ voice: 'Polly.Joanna' }, dialogueResponse.message);

      // Retry logic for initial greeting
      if (parseInt(retryCount) < maxRetries) {
        twiml.redirect({
          method: 'GET',
          url: `/api/voice/ivr?sessionId=${sessionId}&retryCount=${parseInt(retryCount) + 1}`,
        });
      } else {
        twiml.say({ voice: 'Polly.Joanna' }, "I didn’t hear a response after several attempts. We’ll try calling you again later. Goodbye.");
        twiml.hangup();
      }
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in IVR handler:', error);
    const VoiceResponse = require('twilio').twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Joanna' }, "I apologize, but we’re experiencing technical difficulties. We’ll call you back shortly. Goodbye.");
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
};

// Handle status callbacks from Twilio
exports.callStatus = async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  console.log(`Call status update: CallSid=${CallSid}, Status=${CallStatus}`);

  try {
    await callWorker.handleCallStatusUpdate(CallSid, CallStatus.toLowerCase());
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling call status update:', error);
    res.sendStatus(500);
  }
};

// Start/stop the call worker service
exports.controlCallWorker = async (req, res) => {
  const { action } = req.body;

  if (action === 'start') {
    callWorker.start(req);
    res.json({ success: true, message: 'Call worker started' });
  } else if (action === 'stop') {
    callWorker.stop();
    res.json({ success: true, message: 'Call worker stopped' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid action' });
  }
};

// Helper functions (can be removed if not used elsewhere)
function extractCTC(text) {
  const ctcMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lacs|L)/i);
  return ctcMatch ? parseFloat(ctcMatch[1]) : null;
}

function extractNotice(text) {
  const noticeMatch = text.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  return noticeMatch ? `${noticeMatch[1]} ${noticeMatch[2]}` : null;
}