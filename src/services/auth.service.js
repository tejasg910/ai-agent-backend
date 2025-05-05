const bcrypt = require('bcrypt');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { v4: uuidv4 } = require('uuid');

const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('./token.service');
const ms = require('ms'); // for parsing '7d' into milliseconds

exports.signup = async ({ name, email, password }) => {
  if (await User.findOne({ email })) throw new Error('User already exists');
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });

  // Issue tokens
  const accessToken = signAccessToken({ id: user._id });
  const jti = uuidv4();
  const refreshToken = signRefreshToken(user._id, jti);

  // Store refresh token
  await RefreshToken.create({
    jti,
    user: user._id,
    expiresAt: new Date(Date.now() + ms('7d')),
  });

  return { user, accessToken, refreshToken };
};

exports.login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Invalid credentials');
  if (!(await bcrypt.compare(password, user.password))) throw new Error('Invalid credentials');

  const accessToken = signAccessToken({ id: user._id });
  const jti = uuidv4();
  const refreshToken = signRefreshToken(user._id, jti);

  await RefreshToken.create({
    jti,
    user: user._id,
    expiresAt: new Date(Date.now() + ms('7d')),
  });

  return { user, accessToken, refreshToken };
};


exports.refreshTokens = async (oldToken) => {
  const payload = verifyRefreshToken(oldToken);  // Verify signature + decode
  const stored = await RefreshToken.findOne({ jti: payload.jti, valid: true });
  console.log('Stored refresh token:', payload,  stored); // Debugging line
  if (!stored || stored.expiresAt < Date.now()) {
    throw new Error('Invalid or expired refresh token');
  }

  // DELETE old token (not just invalidate)
  await stored.deleteOne();

  // Issue new tokens
  const accessToken = signAccessToken({ id: payload.sub });
  const newJti = uuidv4();
  const refreshToken = signRefreshToken(payload.sub, newJti);

  await RefreshToken.create({
    jti: newJti,
    user: payload.sub,
    expiresAt: new Date(Date.now() + ms('7d')),
    valid: true,
  });

  return { accessToken, refreshToken };
};



exports.logout = async (token) => {
  try {
    const payload = verifyRefreshToken(token);
    await RefreshToken.findOneAndUpdate({ jti: payload.jti }, { valid: false });
  } catch (e) {
    // ignore errors
  }
};



exports.checkValidRefreshToken = async (token) => {
  const payload = verifyRefreshToken(token);

  const stored = await RefreshToken.findOne({ jti: payload.jti, valid: true });
  console.log('Stored refresh token:', stored); // Debugging line
  if (!stored || stored.expiresAt < Date.now()) throw new Error('Invalid or expired refresh token');
};
