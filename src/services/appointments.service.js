const { default: mongoose } = require('mongoose');
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const slotService = require('./slot.service');

const appointmentService = {
  create: async ({ job_id, candidate_id, slot_id, meeting_link, notes = '', recruiterId }) => {
    const slot = await Slot.findById(slot_id);
    if (!slot) {
      throw new Error('Slot not found');
    }
    if (!slot.is_available) {
      throw new Error('Slot is not available');
    }
    const isBooked = await slot.isBooked();
    if (isBooked) {
      throw new Error('Slot is already booked by an appointment');
    }

    const session = await Appointment.startSession();
    session.startTransaction();

    try {
      await slotService.reserveSlot(slot_id);
      const appointment = await Appointment.create(
        [
          {
            job_id,
            candidate_id,
            slot_id,
            meeting_link, // Added to store Google Meet link
            notes,
            status: 'booked',
            recruiterId
          },
        ],
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return appointment[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },

  getAll: async (req) => {
    try {
      const { page = 1, limit = 10, type = 'all' } = req.query;
      const recruiterId = req.user._id; // Assuming user is authenticated

      let query = { recruiterId: recruiterId };
      let sortOptions = {};

      // Filter by appointment type
      if (type === 'upcoming') {
        const now = new Date();
        query['slot_id.date'] = { $gte: now };
        query.status = { $ne: 'canceled' };
        sortOptions = { 'slot_id.date': 1, 'slot_id.start_time': 1 };
      } else if (type === 'past') {
        const now = new Date();
        query.$or = [
          { status: 'completed' },
          { 'slot_id.date': { $lt: now } }
        ];
        sortOptions = { 'slot_id.date': -1, 'slot_id.start_time': -1 };
      } else {
        // Default sort for all appointments
        sortOptions = { 'slot_id.date': -1, 'slot_id.start_time': -1 };
      }

      // Get paginated results
      const appointments = await Appointment.find(query)
        .populate('job_id candidate_id slot_id')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(parseInt(limit) * (parseInt(page) - 1));

      // Get total count for pagination
      const totalCount = await Appointment.countDocuments(query);

      // Get counts by category
      const now = new Date();
      const upcomingCount = await Appointment.countDocuments({
        recruiterId: recruiterId,
        status: { $ne: 'canceled' },
        'slot_id.date': { $gte: now }
      });

      const pastCount = await Appointment.countDocuments({
        recruiterId: recruiterId,
        $or: [
          { status: 'completed' },
          { 'slot_id.date': { $lt: now } }
        ]
      });

      return {
        data: appointments,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          pages: Math.ceil(totalCount / parseInt(limit)),
          limit: parseInt(limit)
        },
        counts: {
          total: totalCount,
          upcoming: upcomingCount,
          past: pastCount
        }
      };
    } catch (error) {
      console.error('Error in getAllAppointments:', error);
      return { error: 'Server error' };
    }
  },


  getById: (id) =>
    Appointment.findById(id)
      .populate({
        path: 'job_id'
      })
      .populate({
        path: 'candidate_id',
        populate: [
          { path: 'recruiterId' },
          { path: 'ratings.skill' }
        ]
      })
      .populate({
        path: 'slot_id',
        populate: {
          path: 'interviewer_id'
        }
      }),

  getForCandidate: async (candidateId, recruiterId, page = 1, limit = 10) => {
    const filter = { candidate_id: candidateId, recruiterId };

    const [appointments, totalCount] = await Promise.all([
      Appointment.find(filter)
        .populate('job_id slot_id candidate_id')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Appointment.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      appointments,
      totalPages,
      totalCount,
      currentPage: page,
    };
  },


  getForJob: (jobId) =>
    Appointment.find({ job_id: jobId })
      .populate('candidate_id slot_id')
      .sort({ created_at: -1 }),

  updateStatus: async (id, status) => {
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    if (status === 'canceled' && appointment.status !== 'canceled') {
      await slotService.releaseSlot(appointment.slot_id);
    }
    return Appointment.findByIdAndUpdate(id, { status }, { new: true });
  },

  delete: async (id) => {
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    if (appointment.status !== 'canceled') {
      await slotService.releaseSlot(appointment.slot_id);
    }
    return Appointment.findByIdAndDelete(id);
  },



  findAndUpdateAppointmentStatus: async (query) => {
    // First find the appointment
    const appointment = await Appointment.findOne(query);

    // If no appointment found, return null
    if (!appointment) {
      return null;
    }

    // Get the associated slot
    const slot = await Slot.findById(appointment.slot_id);
    if (!slot) {
      return appointment; // Return original appointment if no slot found
    }

    // Check if the slot end time has passed
    const now = new Date();
    const slotDate = slot.date;
    const endTimeParts = slot.end_time.split(':');
    const endHours = parseInt(endTimeParts[0], 10);
    const endMinutes = parseInt(endTimeParts[1], 10);

    const slotEndDateTime = new Date(
      slotDate.getFullYear(),
      slotDate.getMonth(),
      slotDate.getDate(),
      endHours,
      endMinutes
    );

    // If the slot's end time has passed and appointment is still 'booked'
    if (slotEndDateTime < now && appointment.status === 'booked') {
      // Update the appointment status to 'completed'
      appointment.status = 'completed';
      await appointment.save();
      console.log(`Automatically updated appointment ${appointment._id} to completed`);
    }

    return appointment;
  }

};



module.exports = appointmentService;