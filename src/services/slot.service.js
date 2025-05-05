const Slot = require('../models/Slot');
const Appointment = require('../models/Appointment');

const slotService = {
  createSlot: async (slotData) => {
    return await Slot.create(slotData);
  },

  getAvailableSlots: async (startDate, endDate, interviewer_id) => {
    return await Slot.find({
      date: { $gte: startDate, $lte: endDate },
      is_available: true,
      interviewer_id,
    }).sort({ date: 1, start_time: 1 });
  },

  getAvailableSlotsForDate: async (date, interviewer_id) => {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    return await Slot.find({
      date: { $gte: startDate, $lte: endDate },
      is_available: true,
      interviewer_id,
    }).sort({ start_time: 1 });
  },

  getSlotsByInterviewer: async (interviewerId, startDate, endDate) => {
    return await Slot.find({
      interviewer_id: interviewerId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1, start_time: 1 });
  },

  reserveSlot: async (slotId) => {
    const slot = await Slot.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }
    if (!slot.is_available) {
      throw new Error('Slot is already booked');
    }
    const isBooked = await slot.isBooked();
    if (isBooked) {
      throw new Error('Slot has an appointment associated with it');
    }
    slot.is_available = false;
    return await slot.save();
  },

  releaseSlot: async (slotId) => {
    const slot = await Slot.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }
    const appointment = await Appointment.findOne({
      slot_id: slotId,
      status: { $in: ['completed'] },
    });
    if (appointment) {
      throw new Error('Cannot release slot with active appointment');
    }
    slot.is_available = true;
    return await slot.save();
  },

  generateSlots: async (startDate, endDate, interviewerId, intervalMinutes = 60) => {
    const slots = [];
    const currentDate = new Date(startDate);
    const startHour = 9;
    const endHour = 17;

    while (currentDate <= endDate) {
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += intervalMinutes) {
            const start_time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const endTimeHour = (hour + Math.floor((minute + intervalMinutes) / 60)) % 24;
            const endTimeMinute = (minute + intervalMinutes) % 60;
            const end_time = `${endTimeHour.toString().padStart(2, '0')}:${endTimeMinute.toString().padStart(2, '0')}`;
            if (endTimeHour < endHour || (endTimeHour === endHour && endTimeMinute === 0)) {
              slots.push({
                date: new Date(currentDate),
                start_time,
                end_time,
                interviewer_id: interviewerId,
                is_available: true,
              });
            }
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return await Slot.insertMany(slots);
  },
};

module.exports = slotService;