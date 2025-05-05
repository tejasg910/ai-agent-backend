const router = require('express').Router();
const voiceCtrl = require('../controllers/voice.controller');
const express = require('express');
const authMiddleware = require('../middleware/auth');

// Kick off an outbound call
router.post('/call',authMiddleware,  voiceCtrl.startCall);

// Twilio will GET/POST here to drive the IVR flow
router.route('/ivr')
  .get(voiceCtrl.ivr)
  .post(express.urlencoded({ extended: false }), voiceCtrl.ivr);

// Handle call status updates from Twilio
router.post('/call-status', express.urlencoded({ extended: false }), voiceCtrl.callStatus);

// Start/stop the call worker
router.post('/control', voiceCtrl.controlCallWorker);

module.exports = router;