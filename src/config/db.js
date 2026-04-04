const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const { DB_URL } = process.env;
  const uri = `${DB_URL}`;
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'recruitment',
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

module.exports = connectDB;