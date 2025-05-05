const { body, validationResult } = require('express-validator');

const validate = (checks) => [
  ...checks,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

exports.validateJob = validate([
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required')
]);


exports.validateLogin = validate([
  body('email').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required')
]);



exports.validateSignup = validate([
  body('email').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('name').notEmpty().withMessage('Name is required')
]);

exports.validateCandidate = validate([
  body('name').notEmpty(),
  body('phone').notEmpty(),
  body('email').notEmpty(),

]);


exports.validateForm = [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[0-9\s\-()]+$/).withMessage('Please enter a valid phone number'),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address'),
  body('location_preference')
    .isIn(['onsite', 'remote', 'hybrid', 'flexible']).withMessage('Invalid location preference'),
  body('jobAssignment').optional(),
  body('about').optional(),
  body('current_ctc').optional().isNumeric().withMessage('Current CTC must be a number'),
  body('expected_ctc').optional().isNumeric().withMessage('Expected CTC must be a number'),
  body('notice_period').optional(),
  body('experience').optional().isNumeric().withMessage('Experience must be a number'),
  body('available').optional().isISO8601().withMessage('Invalid date format for availability'),
  body('ratings').optional().isArray().withMessage('Ratings must be an array'),
  body('ratings.*.skill').optional().isMongoId().withMessage('Invalid skill ID'),
  body('ratings.*.rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
];



exports.validateAppointment = validate([
  body('job_id').notEmpty(),
  body('candidate_id').notEmpty(),
  body('date_time').notEmpty()
]);

exports.validateConversation = validate([
  body('candidate_id').notEmpty(),
  body('transcript').notEmpty(),
  body('entities_extracted').notEmpty()
]);