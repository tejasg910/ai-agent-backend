const Candidate = require('../models/Candidate');
exports.create = data => Candidate.create(data);
exports.getAll = async (interviewerId, query) => {
    const { page = 1, limit = 10, source, status, jobId } = query;

    // Build dynamic filter
    const filter = { recruiterId: interviewerId };
    if (source === 'manual' || source === 'form') {
        filter.source = source;
    }
    if (status) {
        filter.status = status;
    }
    if (jobId) {
        filter.jobAssignment = jobId;
    }

    const skip = (page - 1) * limit;

    // Fetch paginated candidates + total counts
    const [candidates, totalAll, totalManual, totalForm] = await Promise.all([
        Candidate.find(filter)
            .populate('ratings.skill')
            .skip(skip)
            .limit(Number(limit)),
        Candidate.countDocuments({ recruiterId: interviewerId }), // total all
        Candidate.countDocuments({ recruiterId: interviewerId, source: 'manual' }),
        Candidate.countDocuments({ recruiterId: interviewerId, source: 'form' }),
    ]);

    // Total count based on current query filter (for pagination)
    const totalFiltered = await Candidate.countDocuments(filter);

    return {
        candidates,
        totalCounts: {
            all: totalAll,
            manual: totalManual,
            form: totalForm,
        },
        currentPage: Number(page),
        totalPages: Math.ceil(totalFiltered / limit),
    };
};

exports.getById = id =>
    Candidate.findById(id)
        .populate('ratings.skill') // populate each skill inside ratings array
        .populate({
            path: 'jobAssignment',
            populate: [
              { path: 'skills' },
            ]
          })
exports.update = (id, data) => Candidate.findByIdAndUpdate(id, data, { new: true });
exports.delete = id => Candidate.findByIdAndDelete(id);