const CallQueue = require('../models/CallQue');

const CallQueueService = {
    enqueue: async (candidateId, recruiterId, priority = 0, scheduledTime = new Date()) => {
        return await CallQueue.create({
            candidate_id: candidateId,
            job_id: null,
            priority,
            scheduled_time: scheduledTime,
            recruiterId: recruiterId,
            status: 'pending',
        });
    },

    getNextCall: async (req) => {
        const now = new Date();
        const callTask = await CallQueue.aggregate([
            {
                $match: {
                    status: 'pending',
                    recruiterId: req.user._id,
                    scheduled_time: { $lte: now },
                    $expr: { $lt: ['$attempts', '$max_attempts'] },
                },
            },
            {
                $sort: { priority: -1, scheduled_time: 1 },
            },
            {
                $limit: 1,
            },
            {
                $lookup: {
                    from: 'candidates',
                    localField: 'candidate_id',
                    foreignField: '_id',
                    as: 'candidate_id',
                },
            },
            {
                $unwind: '$candidate_id',
            },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'job_id',
                    foreignField: '_id',
                    as: 'job_id',
                },
            },
            {
                $unwind: {
                    path: '$job_id',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ]);

        if (!callTask.length) {
            return null;
        }

        const updatedCallTask = await CallQueue.findOneAndUpdate(
            { _id: callTask[0]._id },
            {
                status: 'in_progress',
                $inc: { attempts: 1 },
                last_attempt: now,
            },
            { new: true }
        ).populate('candidate_id job_id');

        return updatedCallTask;
    },

    markAsCompleted: async (queueId, sessionId) => {
        return await CallQueue.findByIdAndUpdate(
            queueId,
            {
                status: 'completed',
                session_id: sessionId,
            },
            { new: true }
        );
    },

    markAsFailed: async (queueId, errorMessage) => {
        const callTask = await CallQueue.findById(queueId);
        if (!callTask) {
            throw new Error('Call task not found');
        }
        const status = callTask.attempts >= callTask.max_attempts ? 'failed' : 'pending';
        return await CallQueue.findByIdAndUpdate(
            queueId,
            {
                status,
                error_message: errorMessage,
            },
            { new: true }
        );
    },

    updateCallSid: async (queueId, callSid) => {
        return await CallQueue.findByIdAndUpdate(queueId, { call_sid: callSid }, { new: true });
    },

    getAllPending: async (req) => {
        return await CallQueue.find({
            status: 'pending',
            recruiterId: req.user._id,
            $expr: { $lt: ['$attempts', '$max_attempts'] },
        }).sort({ priority: -1, scheduled_time: 1 });
    },

    getCandidateCalls: async (candidateId, recruiterId) => {
        return await CallQueue.find({ recruiterId, candidate_id: candidateId }).sort({ created_at: -1 });
    },

    callExists: async (candidateId, recruiterId, jobId = null,) => {
        const query = {
            recruiterId: recruiterId,
            candidate_id: candidateId,
            status: { $in: ['pending', 'in_progress'] },
        };
        if (jobId) query.job_id = jobId;
        return await CallQueue.exists(query);
    },
};

module.exports = {
    CallQueue,
    CallQueueService,
};