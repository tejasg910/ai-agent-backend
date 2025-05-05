const DashboardService = require('../services/dashboard.service');
exports.getDashboardData = async (req, res, next) => {
  try {
    const list = await DashboardService.getDashboardData(req.user._id);
    res.json(list);
  } catch (err) {
    next(err);
  }
};