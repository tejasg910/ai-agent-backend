const { verifyAccessToken } = require('../services/token.service');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token' });

    const payload = verifyAccessToken(token);  // throws if invalid :contentReference[oaicite:7]{index=7}
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(401).json({ error: 'Unauthorized: User not found' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
