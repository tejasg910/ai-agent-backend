// controllers/interviewController.js
const Candidate = require('../models/Candidate');
const Slot = require('../models/Slot');
const Appointment = require('../models/Appointment');
const { validationResult } = require('express-validator');
const { body } = require('express-validator');
const { google } = require('googleapis');
const appointmentService = require('../services/appointments.service');
const { OAuth2 } = google.auth;

// Configure Google Calendar API
const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

exports.validateScheduleInterview = [
  body('candidateId').isMongoId().withMessage('Valid candidate ID is required'),
  body('slotId').isMongoId().withMessage('Valid slot ID is required'),
  body('interviewType')
    .isIn(['initial', 'technical', 'managerial', 'hr', 'final'])
    .withMessage('Valid interview type is required')
];

exports.getAvailableSlotsForCandidate = async (req, res, next) => {
  try {
    const { candidateId } = req.params;

    // Verify candidate exists and is shortlisted
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (candidate.status !== 'shortlisted') {
      return res.status(400).json({
        error: `Candidate is not shortlisted for interview. Current status: ${candidate.status}`,
        status: candidate.status
      });
    }

    // Get available slots for the next 14 days
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);

    const availableSlots = await Slot.find({
      date: { $gte: today, $lte: twoWeeksLater },
      is_available: true
    }).sort({ date: 1, start_time: 1 });

    return res.status(200).json({
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        status: candidate.status,
        jobId: candidate?.jobAssignment
      },
      availableSlots: availableSlots.map(slot => ({
        id: slot._id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        interviewer_id: slot.interviewer_id
      }))
    });
  } catch (err) {
    console.error('Error getting available slots:', err);
    next(err);
  }
};

exports.scheduleInterview = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { candidateId, slotId, interviewType, job_id, recruiterId } = req.body;
 
    console.log(recruiterId, "This is recruiter id")
    // Verify candidate exists and is shortlisted
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (candidate.status !== 'shortlisted') {
      return res.status(400).json({ error: 'Candidate is not shortlisted for interview' });
    }

    // Verify slot exists and is available
    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (!slot.is_available) {
      return res.status(409).json({ error: 'Slot is no longer available' });
    }

    // Check if slot is already booked
    const isBooked = await slot.isBooked();
    if (isBooked) {
      return res.status(409).json({ error: 'Slot has been booked by another candidate' });
    }



    // Check if candidate already has an appointment
    await appointmentService.findAndUpdateAppointmentStatus({
      candidate_id: candidateId,
      status: { $in: ['booked'] }
    });




    // Reserve the slot
    slot.is_available = false;
    await slot.save();

    // Create a Google Meet appointment
    const meetLink = await createGoogleMeetAppointment(candidate, slot, interviewType);
    console.log(meetLink, "This is meeting link ")
    // Create an appointment record
    const appointment = await Appointment.create({
      candidate_id: candidateId,
      slot_id: slotId,
      interview_type: interviewType,
      status: 'booked',
      meeting_link: meetLink,
      created_at: new Date(),
      recruiterId: recruiterId,
      job_id
    });

    // Update candidate's status to screening
    candidate.status = 'screening';
    candidate.last_contact = new Date();
    await candidate.save();

    return res.status(201).json({
      appointment: {
        id: appointment._id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        interview_type: interviewType,
        meeting_link: meetLink
      },
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        status: candidate.status
      }
    });
  } catch (err) {
    console.error('Error scheduling interview:', err);
    next(err);
  }
};



exports.scheduleInterviewRecruiter = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { candidateId, slotId, interviewType, job_id,  } = req.body;
 const recruiterId = req.user._id;
    console.log(recruiterId, "This is recruiter id")
    // Verify candidate exists and is shortlisted
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (candidate.status !== 'shortlisted') {
      return res.status(400).json({ error: 'Candidate is not shortlisted for interview' });
    }

    // Verify slot exists and is available
    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (!slot.is_available) {
      return res.status(409).json({ error: 'Slot is no longer available' });
    }

    // Check if slot is already booked
    const isBooked = await slot.isBooked();
    if (isBooked) {
      return res.status(409).json({ error: 'Slot has been booked by another candidate' });
    }



    // Check if candidate already has an appointment
    await appointmentService.findAndUpdateAppointmentStatus({
      candidate_id: candidateId,
      status: { $in: ['booked'] }
    });




    // Reserve the slot
    slot.is_available = false;
    await slot.save();

    // Create a Google Meet appointment
    const meetLink = await createGoogleMeetAppointment(candidate, slot, interviewType);
    console.log(meetLink, "This is meeting link ")
    // Create an appointment record
    const appointment = await Appointment.create({
      candidate_id: candidateId,
      slot_id: slotId,
      interview_type: interviewType,
      status: 'booked',
      meeting_link: meetLink,
      created_at: new Date(),
      recruiterId: recruiterId,
      job_id
    });

    // Update candidate's status to screening
    candidate.status = 'screening';
    candidate.last_contact = new Date();
    await candidate.save();

    return res.status(201).json({
      appointment: {
        id: appointment._id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        interview_type: interviewType,
        meeting_link: meetLink
      },
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        status: candidate.status
      }
    });
  } catch (err) {
    console.error('Error scheduling interview:', err);
    next(err);
  }
};

/**
 * Creates a Google Meet appointment and returns the meeting link
 */
async function createGoogleMeetAppointment(candidate, slot, interviewType) {
  try {
    const slotDate = new Date(slot.date);
    const [startHour, startMinute] = slot.start_time.split(':').map(Number);
    const [endHour, endMinute] = slot.end_time.split(':').map(Number);

    const startDateTime = new Date(slotDate);
    startDateTime.setHours(startHour, startMinute, 0);

    const endDateTime = new Date(slotDate);
    endDateTime.setHours(endHour, endMinute, 0);

    // Define interview title based on type
    const interviewTitles = {
      initial: 'Initial Screening',
      technical: 'Technical Interview',
      managerial: 'Managerial Round',
      hr: 'HR Discussion',
      final: 'Final Interview'
    };

    const interviewTitle = interviewTitles[interviewType] || 'Interview';

    // Create calendar event with Google Meet
    const event = {
      summary: `${interviewTitle} with ${candidate.name}`,
      description: `${interviewTitle} for candidate ${candidate.name} (${candidate.email}).`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'UTC'
      },
      attendees: [
        { email: candidate.email }
        // Add company email or interviewer email here
      ],
      conferenceData: {
        createRequest: {
          requestId: `req-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendNotifications: true
    });

    // Extract and return the Google Meet link
    const meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri || '';
    return meetLink;
  } catch (error) {
    console.error('Error creating Google Meet appointment:', error);
    return ''; // Return empty string if creating meeting fails
  }
}



