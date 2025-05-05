const Job = require('../models/Job');
exports.create = data => Job.create(data);
exports.getAll = async (query, recruiterId) => {
    try {
        const { page = 1, limit = 10 } = query;

        const skip = (page - 1) * limit;

        const jobs = await Job.aggregate([
            // 1) Join in skills as before
            {
              $match: {
                userId: recruiterId  // recruiterId should be ObjectId type if userId is stored as ObjectId
              }
            },

            {
              $lookup: {
                from: 'skills',
                localField: 'skills',
                foreignField: '_id',
                as: 'skills'
              }
            },
          
            // 2) Count assigned candidates via a pipeline lookup
            {
              $lookup: {
                from: 'candidates',                    // foreign collection :contentReference[oaicite:0]{index=0}
                let: { jobId: '$_id' },                // expose job._id into the pipeline :contentReference[oaicite:1]{index=1}
                pipeline: [
                  { $match: { $expr: { $eq: ['$jobAssignment', '$$jobId'] } } },  // match assignments :contentReference[oaicite:2]{index=2}
                  { $count: 'assignedCount' }           // count matching docs :contentReference[oaicite:3]{index=3}
                ],
                as: 'assignedStats'
              }
            },
          
            // 3) Turn that single-array result into a numeric field
            {
              $addFields: {
                assignedCount: {
                  $ifNull: [
                    { $arrayElemAt: ['$assignedStats.assignedCount', 0] },
                    0
                  ]
                }
              }
            },
          
            // 4) Remove the intermediate lookup array
            { $project: { assignedStats: 0 } },
          
            // 5) Your existing appointment stats, pagination, etc…
            {
              $lookup: {
                from: 'appointments',
                let: { jobId: '$_id' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$job_id', '$$jobId'] } } },
                  {
                    $group: {
                      _id: null,
                      candidateCount: { $addToSet: '$candidate_id' },
                      appointmentCount: { $sum: 1 }
                    }
                  },
                  {
                    $project: {
                      _id: 0,
                      candidateCount: { $size: '$candidateCount' },
                      appointmentCount: 1
                    }
                  }
                ],
                as: 'appointmentStats'
              }
            },
            {
              $addFields: {
                candidateCount: { $ifNull: [{ $arrayElemAt: ['$appointmentStats.candidateCount', 0] }, 0] },
                appointmentCount: { $ifNull: [{ $arrayElemAt: ['$appointmentStats.appointmentCount', 0] }, 0] }
              }
            },
            { $project: { appointmentStats: 0 } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit, 10) }
          ]);
          
          

        const totalJobs = await Job.countDocuments();

        return {
            data: jobs,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalJobs / limit),
            totalJobs
        };

    } catch (error) {
        console.error('Error fetching jobs:', error);
        throw Error('Error fetching jobs');
    }
}; // populate the skills field


exports.getById = id => Job.findById(id);
exports.getAllJobsForCanidates = id => Job.find({userId:id}).populate("skills")
exports.getAllJobsForCanidatesRecruiter = id => Job.find({userId:id}).populate("skills")
;
exports.update = (id, data) => Job.findByIdAndUpdate(id, data, { new: true });
exports.delete = id => Job.findByIdAndDelete(id);