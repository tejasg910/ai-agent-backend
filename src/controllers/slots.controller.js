const slotService = require('../services/slot.service');

exports.createSlot = async (req, res, next) => {
  try {
    const { date, start_time, end_time } = req.body;

    const slot = await slotService.createSlot({
      date,
      start_time,
      end_time,
      interviewer_id: req.user._id,
      is_available: true

    });

    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    next(error);
  }
};

exports.generateSlots = async (req, res, next) => {
  try {
    const { start_date, end_date, interval_minutes } = req.body;

    const slots = await slotService.generateSlots(
      new Date(start_date),
      new Date(end_date),
      req.user._id,
      interval_minutes || 60
    );

    res.status(201).json({
      success: true,
      message: `Created ${slots.length} slots`,
      count: slots.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date) : new Date();
    let endDate;

    if (end_date) {
      endDate = new Date(end_date);
    } else {
      // Default to +30 days if no end date provided
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
    }

    const slots = await slotService.getAvailableSlots(startDate, endDate, req.user._id);

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

exports.getSlotsForDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const slots = await slotService.getAvailableSlotsForDate(new Date(date), req.user._id);

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

exports.getSlotsByInterviewer = async (req, res, next) => {
  try {
    const { interviewer_id } = req.params;
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date) : new Date();
    let endDate;

    if (end_date) {
      endDate = new Date(end_date);
    } else {
      // Default to +30 days if no end date provided
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
    }

    const slots = await slotService.getSlotsByInterviewer(
      interviewer_id,
      startDate,
      endDate
    );

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

exports.releaseSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await slotService.releaseSlot(id);

    res.json({ success: true, data: slot });
  } catch (error) {
    next(error);
  }
};
