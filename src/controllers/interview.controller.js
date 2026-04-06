// controllers/interviewController.js
const Candidate = require('../models/Candidate');
const Slot = require('../models/Slot');
const Appointment = require('../models/Appointment');
const { validationResult } = require('express-validator');
const { body } = require('express-validator');
const axios = require('axios');
const appointmentService = require('../services/appointments.service');

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

    // Create a Cal.com booking
    const bookingDetails = await createCalComBooking(candidate, slot, interviewType);
    console.log(bookingDetails.meetingLink, "This is meeting link from Cal.com")
    
    // Create an appointment record
    const appointment = await Appointment.create({
      candidate_id: candidateId,
      slot_id: slotId,
      interview_type: interviewType,
      status: 'booked',
      meeting_link: bookingDetails.meetingLink,
      cal_com_booking_id: bookingDetails.bookingId,
      cal_com_uid: bookingDetails.uid,
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
        meeting_link: bookingDetails.meetingLink,
        cal_com_booking_id: bookingDetails.bookingId,
        cal_com_uid: bookingDetails.uid
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

    const { candidateId, slotId, interviewType, job_id } = req.body;
    const recruiterId = req.user._id;
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

    // Create a Cal.com booking
    const bookingDetails = await createCalComBooking(candidate, slot, interviewType);
    console.log(bookingDetails.meetingLink, "This is meeting link from Cal.com")
    
    // Create an appointment record
    const appointment = await Appointment.create({
      candidate_id: candidateId,
      slot_id: slotId,
      interview_type: interviewType,
      status: 'booked',
      meeting_link: bookingDetails.meetingLink,
      cal_com_booking_id: bookingDetails.bookingId,
      cal_com_uid: bookingDetails.uid,
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
        meeting_link: bookingDetails.meetingLink,
        cal_com_booking_id: bookingDetails.bookingId,
        cal_com_uid: bookingDetails.uid
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
 * Creates a Cal.com booking and returns the meeting link
 */
async function createCalComBooking(candidate, slot, interviewType) {
  try {
    const pad = (n) => String(n).padStart(2, '0');

    const [startHour, startMinute] = slot.start_time.split(':').map(Number);

    // Convert slot.date to string safely regardless of whether it's a Date object or string
    const dateObj = new Date(slot.date);
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth() + 1;
    const day = dateObj.getUTCDate();

    // Treat date+time as IST, convert to UTC for Cal.com
    const startInIST = new Date(Date.UTC(year, month - 1, day, startHour, startMinute, 0));
    const startInUTC = new Date(startInIST.getTime() - (5 * 60 + 30) * 60 * 1000);
    const endInUTC = new Date(startInUTC.getTime() + 30 * 60 * 1000);

    const startTimeISO = startInUTC.toISOString();
    const endTimeISO = endInUTC.toISOString();

    console.log('Booking time debug:', {
      rawDate: slot.date,
      rawTime: slot.start_time,
      parsedUTC: { year, month, day },
      startIST: `${year}-${pad(month)}-${pad(day)} ${pad(startHour)}:${pad(startMinute)} IST`,
      startUTC: startTimeISO
    });

    const interviewTitles = {
      initial: 'Initial Screening',
      technical: 'Technical Interview',
      managerial: 'Managerial Round',
      hr: 'HR Discussion',
      final: 'Final Interview'
    };

    const interviewTitle = interviewTitles[interviewType] || 'Interview';

    const CALCOM_API_URL = `${process.env.CALCOM_API_URL}/bookings`;
    const CALCOM_API_KEY = process.env.CALCOM_API_KEY;
    console.log(CALCOM_API_URL, CALCOM_API_KEY, "Cal.com API URL and Key");

    const bookingPayload = {
      start: startTimeISO,
      attendee: {
        name: candidate.name,
        email: candidate.email,
        timeZone: 'Asia/Kolkata'
      },
      eventTypeId: parseInt(process.env.CALCOM_EVENT_TYPE_ID),
      metadata: {
        candidateId: candidate._id.toString(),
        interviewType: interviewType
      }
    };

    const response = await axios.post(CALCOM_API_URL, bookingPayload, {
      headers: {
        'Authorization': `Bearer ${CALCOM_API_KEY}`,
        'Content-Type': 'application/json',
        'cal-api-version': '2026-02-25'
      }
    });

    const bookingData = response.data.data;
    const meetingLink = bookingData.location || bookingData.meetingUrl || '';

    return {
      meetingLink,
      bookingId: bookingData.id,
      uid: bookingData.uid,
      status: bookingData.status
    };
  } catch (error) {
    console.error('Error creating Cal.com booking:', error.response?.data || error.message);
    throw new Error(`Failed to create Cal.com booking: ${error.response?.data?.message || error.message}`);
  }
}

