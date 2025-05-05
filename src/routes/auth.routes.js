const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { validateLogin, validateSignup } = require('../middleware/validateInput');

router.post('/signup', validateSignup, authCtrl.signup);
router.post('/login', validateLogin, authCtrl.login);
router.post('/logout', authCtrl.logout);
router.post('/refresh-token', authCtrl.refreshToken);  // ← New!
router.get('/check-valid-refresh-token', authCtrl.checkValidRefreshToken); // ← New!

module.exports = router;
