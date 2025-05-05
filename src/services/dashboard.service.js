const Appointment = require("../models/Appointment");
const Candidate = require("../models/Candidate");
const Job = require("../models/Job");

exports.getDashboardData = async (recruiterId) => {
    try {

        console.log(recruiterId, "Recruiter ID in dashboard service");
        // Convert recruiterId to ObjectId
        const recruiterObjectId = recruiterId;

        const currentDate = new Date();
        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const lastMonthEnd = new Date(currentMonthStart - 1);

        // Fetch total jobs count for current and last month
        const totalJobs = await Job.countDocuments({ userId: recruiterObjectId });
        console.log(totalJobs, "Total Jobs Count");
        const lastMonthJobs = await Job.countDocuments({
            userId: recruiterObjectId,
            created_at: { $gte: lastMonthStart, $lte: lastMonthEnd }
        });

        // Fetch total candidates count for current and last month
        const totalCandidates = await Candidate.countDocuments({ recruiterId: recruiterObjectId });
        const lastMonthCandidates = await Candidate.countDocuments({
            recruiterId: recruiterObjectId,
            created_at: { $gte: lastMonthStart, $lte: lastMonthEnd }
        });

        // Fetch booked appointments count for current and last month
        const bookedAppointments = await Appointment.countDocuments({
            recruiterId: recruiterObjectId
          
        });
        const lastMonthAppointments = await Appointment.countDocuments({
            recruiterId: recruiterObjectId
           ,
            created_at: { $gte: lastMonthStart, $lte: lastMonthEnd }
        });

        // Calculate percentage changes
        const calculatePercentageChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const jobsPercentageChange = calculatePercentageChange(totalJobs, lastMonthJobs);
        const candidatesPercentageChange = calculatePercentageChange(totalCandidates, lastMonthCandidates);
        const appointmentsPercentageChange = calculatePercentageChange(bookedAppointments, lastMonthAppointments);

        // Dynamic interview overview: Count appointments per month for the current year
        const currentYear = new Date().getFullYear();
        const appointmentCounts = await Appointment.aggregate([
            {
                $match: {
                    recruiterId: recruiterObjectId,
                    created_at: {
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: '$created_at' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Generate labels and data for all 12 months
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const data = Array(12).fill(0); // Initialize with zeros for all months
        appointmentCounts.forEach(({ _id, count }) => {
            data[_id - 1] = count; // _id is 1-based (January = 1), array is 0-based
        });

        const interviewOverview = { labels, data };

        // Fetch recent jobs (last 3) with candidate and appointment counts
        const recentJobs = await Job.aggregate([
            { $match: { userId: recruiterObjectId } },
            { $sort: { created_at: -1 } },
            { $limit: 3 },
            {
                $lookup: {
                    from: 'candidates',
                    localField: '_id',
                    foreignField: 'jobAssignment',
                    as: 'candidates'
                }
            },
            {
                $lookup: {
                    from: 'appointments',
                    localField: '_id',
                    foreignField: 'job_id',
                    as: 'appointments'
                }
            },
            {
                $project: {
                    id: '$_id',
                    title: 1,
                    candidates: { $size: '$candidates' },
                    appointments: { $size: '$appointments' },
                    _id: 0
                }
            }
        ]);

        // Fetch recent appointments (last 3)
        const recentAppointments = await Appointment.find({
            recruiterId: recruiterObjectId
        })
            .populate('candidate_id', 'name')
            .populate('job_id', 'title')
            .sort({ created_at: -1 })
            .limit(3)
            .lean()
            .then(appointments => appointments.map(appointment => ({
                id: appointment._id,
                candidate: appointment.candidate_id?.name || 'Unknown',
                job: appointment.job_id?.title || 'Unknown',
                date: appointment.slot_id?.start_time?.toISOString().split('T')[0] || 'Unknown',
                status: appointment.status
            })));
console.log(recentAppointments, bookedAppointments, "Recent Appointments and Interview Overview")
        return {
            success: true,
            data: {
                totalJobs,
                jobsPercentageChange,
                totalCandidates,
                candidatesPercentageChange,
                bookedAppointments,
                appointmentsPercentageChange,
                interviewOverview,
                recentJobs,
                recentAppointments
            }
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return {
            success: false,
            error: 'Failed to fetch dashboard data'
        };
    }
};

