const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  candidate_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
  },
  slot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true,
  },
  meeting_link: {
    type: String,
    required: true, // Added to store Google Meet link from GPTDialogueService
  },
  status: {
    type: String,
    enum: ['booked', 'completed', 'canceled'],
    default: 'booked',
  },
  notes: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

// Compound index to ensure a candidate can't have multiple appointments for the same job
// AppointmentSchema.index({ candidate_id: 1, job_id: 1 }, { unique: true });
AppointmentSchema.statics.getAll = function (recruiterId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return this.aggregate([
    { $match: { recruiterId: mongoose.Types.ObjectId(recruiterId) } },
    {
      $lookup: {
        from: 'jobs',
        localField: 'job_id',
        foreignField: '_id',
        as: 'job_id'
      }
    },
    { $unwind: { path: '$job_id', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'candidates',
        localField: 'candidate_id',
        foreignField: '_id',
        as: 'candidate_id'
      }
    },
    { $unwind: { path: '$candidate_id', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'slots',
        localField: 'slot_id',
        foreignField: '_id',
        as: 'slot_id'
      }
    },
    { $unwind: { path: '$slot_id', preserveNullAndEmptyArrays: true } },
    { $sort: { 'slot_id.date': 1, 'slot_id.start_time': 1 } },
    {
      $facet: {
        metadata: [
          { $count: "total" },
          { $addFields: { page: page, limit: limit } }
        ],
        data: [{ $skip: skip }, { $limit: parseInt(limit) }]
      }
    }
  ]);
};

// Helper to get upcoming appointments
AppointmentSchema.statics.getUpcoming = function (recruiterId) {
  const now = new Date();

  return this.find({
    recruiterId: recruiterId,
    status: { $ne: 'canceled' },
    'slot_id.date': { $gte: now }
  })
    .populate('job_id candidate_id slot_id')
    .sort({ 'slot_id.date': 1, 'slot_id.start_time': 1 });
};

// Helper to get past appointments
AppointmentSchema.statics.getPast = function (recruiterId) {
  const now = new Date();

  return this.find({
    recruiterId: recruiterId,
    $or: [
      { status: 'completed' },
      { 'slot_id.date': { $lt: now } }
    ]
  })
    .populate('job_id candidate_id slot_id')
    .sort({ 'slot_id.date': -1, 'slot_id.start_time': -1 });
};
module.exports = mongoose.model('Appointment', AppointmentSchema);