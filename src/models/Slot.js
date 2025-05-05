const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  start_time: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: (props) => `${props.value} is not a valid time format (HH:MM)`,
    },
  },
  end_time: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: (props) => `${props.value} is not a valid time format (HH:MM)`,
    },
  },
  is_available: {
    type: Boolean,
    default: true,
  },
  interviewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

SlotSchema.index({ date: 1, interviewer_id: 1, start_time: 1 }, { unique: true });

SlotSchema.methods.isBooked = async function () {
  const Appointment = mongoose.model('Appointment');
  const slotStartTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.start_time}:00`);
  const slotEndTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.end_time}:00`);

  const appointment = await Appointment.findOne({
    slot_id: this._id,
    status: { $in: ['booked', 'completed'] },
  });

  return appointment !== null;
};

module.exports = mongoose.model('Slot', SlotSchema);