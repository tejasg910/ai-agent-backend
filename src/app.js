require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const cookieParser = require('cookie-parser');
const jobsRoutes = require('./routes/jobs.routes');
const candidatesRoutes = require('./routes/candidates.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const skillsRoutes = require('./routes/skills.routes');
const userRoutes = require('./routes/auth.routes');
const slotRoutes = require('./routes/slot.routes');
const voiceRoutes = require('./routes/voice.routes');
const formRoutes = require('./routes/form.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
var morgan = require('morgan')

// create "middleware"
const app = express();
app.use(cookieParser());
var logger = morgan('dev')

app.use(logger)

// Middleware
app.use(cors);
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true if HTTPS
}));

// Routes
app.use('/api/jobs', jobsRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/form', formRoutes);
app.use('/api/dashboard', dashboardRoutes);



// Error handler (should be last)
app.use(errorHandler);

module.exports = app;