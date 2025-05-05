const Appointment = require('../models/Appointment');
const { CallQueueService, CallQueue } = require('../services/callQueue.service');
const Candidate = require('../models/Candidate');
const slotService = require('../services/slot.service');
const telephonyService = require('../services/telephony.service');
const sessionStore = require('./sessionStore');

class CallWorker {
  constructor() {
    this.isRunning = false;
    this.processInterval = null;
    this.concurrentCalls = 0;
    this.maxConcurrentCalls = 2;
    this.processingDelay = 5000;
  }

  async start(req) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processInterval = setInterval(() => this.processQueue(req), this.processingDelay);
    console.log('Call worker started');
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this.processInterval);
    this.isRunning = false;
    console.log('Call worker stopped');
  }

  async processQueue(req) {
    console.log('Came in process queue', this.concurrentCalls, this.maxConcurrentCalls);
    if (this.concurrentCalls >= this.maxConcurrentCalls) {
      return;
    }

    try {
      const twoHoursFromNow = new Date();
      twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      console.log('Before available slots');
      const availableSlots = await slotService.getAvailableSlots(twoHoursFromNow, nextWeek);

      if (availableSlots.length === 0) {
        console.log('No available slots, skipping call processing');
        return;
      }

      console.log('Before next call');
      const callTask = await CallQueueService.getNextCall(req);
      console.log('After next call', callTask);
      if (!callTask) {
        this.stop()
        return;
      }

      this.concurrentCalls++;

      try {
        const sessionId = await sessionStore.create({
          candidateId: callTask.candidate_id._id,
          jobId: null,
          entities: {},
          conversationHistory: [],
          step: 0,
          recruiterId: req.user._id,
        });

        const call = await telephonyService.makeCall(
          callTask.candidate_id.phone,
          sessionId
        );

        await CallQueueService.updateCallSid(callTask._id, call.sid);

        await Candidate.findByIdAndUpdate(callTask.candidate_id._id, {
          status: 'screening',
          last_contact: new Date(),
        });

        console.log(`Started call to ${callTask.candidate_id.name} (${callTask.candidate_id.phone})`);
      } catch (error) {
        console.error('Error making call:', error);
        await CallQueueService.markAsFailed(callTask._id, error.message);
      } finally {
        this.concurrentCalls--;
      }
    } catch (error) {
      console.error('Error processing call queue:', error);
    }
  }

  async handleCallStatusUpdate(callSid, status) {
    try {

      const callTask = await CallQueue.findOne({ call_sid: callSid });
      if (!callTask) {
        console.warn(`No call task found for SID: ${callSid}`);
        return;
      }

      switch (status) {
        case 'completed':
          await CallQueueService.markAsCompleted(callTask._id, callTask.session_id);
          break;
        case 'failed':
        case 'busy':
        case 'no-answer':
          await Candidate.findByIdAndUpdate(callTask.candidate_id, {
            status: 'pending',
          });
          await CallQueueService.markAsFailed(
            callTask._id,
            `Call ${status}: candidate did not answer`
          );
          break;
      }
    } catch (error) {
      console.error('Error handling call status update:', error);
    }
  }

  async queueCandidatesWithoutAppointments(req) {
    try {
      console.log('Finding candidates without appointments...');
      const candidates = await Candidate.find({
        status: 'pending',
        recruiterId: req.user._id
      });
      console.log(`Found ${candidates.length} pending candidates`);

      let queuedCount = 0;
      for (const candidate of candidates) {
        const appointmentExists = await Appointment.exists({
          candidate_id: candidate._id,
        });
        if (!appointmentExists) {
          const alreadyQueued = await CallQueueService.callExists(candidate._id, req.user._id);
          if (!alreadyQueued) {
            await CallQueueService.enqueue(candidate._id, req.user._id);
            queuedCount++;
            console.log(`Queued call for ${candidate.name}`);
          }
        }
      }
      console.log(`Added ${queuedCount} new calls to the queue`);
      return queuedCount;
    } catch (error) {
      console.error('Error queuing candidates:', error);
      throw error;
    }
  }
}

module.exports = new CallWorker();