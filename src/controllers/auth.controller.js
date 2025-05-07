const authService = require('../services/auth.service');
const cookieOptions = {
  httpOnly: true,
  secure: true,  // Must be true for cross-origin in production
  sameSite: 'None',  // Must be 'None' for cross-origin cookies
  path: '/',  // Make cookie available on all paths
  // Remove domain setting completely - this is often the issue
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
};


exports.signup = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.signup(req.body);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.json({ user, accessToken });
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const oldToken = req.cookies.refreshToken;
    console.log('oldToken', oldToken);
    if (!oldToken) return res.sendStatus(401);

    const { accessToken, refreshToken } = await authService.refreshTokens(oldToken);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};


exports.checkValidRefreshToken = async (req, res) => {
  const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    if (!token) return res.sendStatus(401);
  try {
    await authService.checkValidRefreshToken(token);
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(401);
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  await authService.logout(token);
  res.clearCookie('refreshToken').sendStatus(200);
};
