// controllers/candidateController.js
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Slot = require('../models/Slot');
const User = require('../models/User');
const { matchCandidateToJob } = require('../services/match.service');
const { validationResult } = require('express-validator');

exports.createCandidate = async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check if candidate already exists with the same email or phone
        const existingCandidate = await Candidate.findOne({
            $or: [
                { email: req.body.email },
                { phone: req.body.phone }
            ]
        });

        if (existingCandidate) {
            return res.status(409).json({
                error: 'A candidate with this email or phone number already exists',
                field: existingCandidate.email === req.body.email ? 'email' : 'phone'
            });
        }

        // Check if job exists
        if (req.body.jobAssignment) {
            const job = await Job.findById(req.body.jobAssignment)
                .populate('skills');

            if (!job) {
                return res.status(404).json({ error: 'Selected job not found' });
            }

            // Calculate match score
            const matchScore = await matchCandidateToJob(req.body, job);

            console.log(matchScore, "This is match score")

            // Check if candidate is qualified (score > 70%)
            const isQualified = matchScore >= 70;

            // If qualified, check if slots are available
            let slotsAvailable = false;
            if (isQualified) {
                // Get available slots for next 14 days
                const today = new Date();
                const twoWeeksLater = new Date();
                twoWeeksLater.setDate(today.getDate() + 14);

                const availableSlots = await Slot.find({
                    date: { $gte: today, $lte: twoWeeksLater },
                    is_available: true
                });

                slotsAvailable = availableSlots.length > 0;
            }

            // Create the candidate
            const candidate = await Candidate.create({
                ...req.body,
                source: "form",
                status: isQualified && slotsAvailable ? 'shortlisted' : 'pending',
                score: matchScore,
            });

            // Return with matching score and shortlisted status
            return res.status(201).json({
                candidate,
                matchScore,
                shortlisted: isQualified && slotsAvailable,
                slotsAvailable
            });
        } else {
            // Create candidate without job matching
            const candidate = await Candidate.create({ ...req.body, source: "form", });
            return res.status(201).json({ candidate });
        }
    } catch (err) {
        console.error('Error creating candidate:', err);
        next(err);
    }
};


exports.getFormLink = async (req, res, next) => {

    const id = req.user._id;

    if (!id) {
        return res.status(400).json({ error: 'Failed to copy' });

    }

    const url = `${process.env.FRONTEND_URL}/form/${id}`;

    return res.status(200).json({ success: true, message: "Link copied successfully", url });
}


exports.checkValid = async (req, res, next) => {


    const interviewer = await User.findById(req.params.id);
    if (!interviewer) {
        return res.status(404).json({ error: 'Interviwer not found' });

    } else {
        return res.status(200).json({ success: true });
    }
}
