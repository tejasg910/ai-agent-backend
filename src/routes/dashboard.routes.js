const express = require('express');
const authMiddleware = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard.controller');
const router = express.Router();
router.get('/',
    authMiddleware,

    dashboardController.getDashboardData
);

module.exports = router;