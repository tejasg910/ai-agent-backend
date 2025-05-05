const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    //mongodb://localhost:27017/
  const { DB_URL } = process.env;
  const uri = `${DB_URL}/interview_scheduler`;
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;