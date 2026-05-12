import mongoose from "mongoose"
import {
    Attendance, Activity, Sale, Sample, User,
    LocationLog, AdminMessage, DistributorInventory
} from "../models/index.js"

/* ================= MAIN DASHBOARD ================= */
export async function getDashboard(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        let endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()
        endDate.setHours(23, 59, 59, 999)

        let startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        startDate.setHours(0, 0, 0, 0)

        const [attendance, meetings, users, sales, samples] = await Promise.all([
            Attendance.find({ startTime: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email state district")
                .sort({ startTime: -1 })   // newest first
                .limit(100),
            Activity.find({ createdAt: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email").sort({ createdAt: -1 }).limit(50).lean(),
            User.find().select("-password"),
            Sale.find({ createdAt: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email").sort({ createdAt: -1 }),
            Sample.find({ createdAt: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email").sort({ createdAt: -1 })
        ])

        const adminMessages = await AdminMessage.find().sort({ timestamp: -1 }).limit(100).lean()

        // Distributor data
        const distributors = users.filter(u => u.role === "DISTRIBUTOR")
        const distributorIds = distributors.map(d => d._id)
        const [distributorSales, distributorInventory, distributorAttendance] = await Promise.all([
            Sale.find({ userId: { $in: distributorIds }, createdAt: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email").sort({ createdAt: -1 }),
            DistributorInventory.find({ distributorId: { $in: distributorIds } })
                .populate("distributorId", "name email").sort({ lastUpdated: -1 }),
            Attendance.find({ userId: { $in: distributorIds }, startTime: { $gte: startDate, $lte: endDate } })
                .populate("userId", "name role email state district").sort({ startTime: -1 })
        ])

        const messageMap = {}
        adminMessages.forEach(msg => {
            if (msg.officerId && msg.meetingType) {
                const key = `${msg.officerId.toString()}_${msg.meetingType}`
                if (!messageMap[key]) messageMap[key] = msg
            }
        })

        meetings.forEach(meeting => {
            const officerId = typeof meeting.userId === 'object' ? meeting.userId._id : meeting.userId
            const meetingType = meeting.type || meeting.meetingType
            if (officerId && meetingType) {
                const key = `${officerId.toString()}_${meetingType}`
                meeting.adminMessage = messageMap[key]?.text || null
            } else {
                meeting.adminMessage = null
            }
        })

        const totalDistance = attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)
        const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
        const b2cSales = sales.filter(s => s.saleType === 'B2C').length
        const b2bSales = sales.filter(s => s.saleType === 'B2B').length
        const oneToOneMeetings = meetings.filter(m => m.meetingType === 'ONE_TO_ONE' || m.type === 'ONE_TO_ONE').length
        const groupMeetings = meetings.filter(m => m.meetingType === 'GROUP' || m.type === 'GROUP').length

        const salesChart = [
            { type: 'B2C', count: b2cSales, amount: sales.filter(s => s.saleType === 'B2C').reduce((sum, s) => sum + s.totalAmount, 0) },
            { type: 'B2B', count: b2bSales, amount: sales.filter(s => s.saleType === 'B2B').reduce((sum, s) => sum + s.totalAmount, 0) }
        ]
        const meetingChart = [{ type: 'One-to-One', count: oneToOneMeetings }, { type: 'Group', count: groupMeetings }]

        const stateStats = {}
        meetings.forEach(m => { if (m.state) { if (!stateStats[m.state]) stateStats[m.state] = { meetings: 0, sales: 0, samples: 0 }; stateStats[m.state].meetings++ } })
        sales.forEach(s => { if (s.state && stateStats[s.state]) stateStats[s.state].sales++ })
        samples.forEach(s => { if (s.state && stateStats[s.state]) stateStats[s.state].samples++ })
        const stateData = Object.entries(stateStats).map(([state, data]) => ({ state, ...data }))

        const totalFarmersContacted = meetings.filter(m => m.category === 'FARMER').length
        const farmersConverted = sales.filter(s => s.saleType === 'B2C').length
        const conversionRate = totalFarmersContacted > 0 ? ((farmersConverted / totalFarmersContacted) * 100).toFixed(1) : 0

        const totalDistributorRevenue = distributorSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
        const totalDistributorStock = distributorInventory.reduce((sum, i) => sum + (i.currentStock || 0), 0)

        res.json({
            stats: { totalUsers: users.length, totalMeetings: meetings.length, totalSales: sales.length, totalSamples: samples.length, totalRevenue, totalDistance, totalFarmersContacted, farmersConverted, conversionRate },
            attendance, meetings, users, sales, samples,
            adminMessages: adminMessages || [], salesChart, meetingChart, stateData,
            distributors,
            distributorSales,
            distributorInventory,
            distributorAttendance,
            distributorStats: {
                totalDistributors: distributors.length,
                totalDistributorRevenue,
                totalDistributorStock,
                totalDistributorSales: distributorSales.length
            },
            dateRange: { startDate, endDate }
        })
    } catch (err) {
        console.error("Admin dashboard error:", err)
        res.status(500).json({ error: "Failed to fetch dashboard data" })
    }
}

/* ================= ANALYTICS: PERFORMANCE BY OFFICER ================= */
export async function getOfficerAnalytics(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const officers = await User.find({ role: "FIELD" }).select("-password")
        const performanceData = await Promise.all(
            officers.map(async (officer) => {
                const [meetings, sales, samples, attendance] = await Promise.all([
                    Activity.countDocuments({ userId: officer._id }),
                    Sale.find({ userId: officer._id }),
                    Sample.countDocuments({ userId: officer._id }),
                    Attendance.find({ userId: officer._id })
                ])
                const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)
                const totalDistance = attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)
                return {
                    officerId: officer._id, name: officer.name, email: officer.email,
                    state: officer.state, district: officer.district,
                    metrics: { meetings, sales: sales.length, samples, revenue: totalRevenue, distance: totalDistance, activeDays: attendance.length }
                }
            })
        )
        performanceData.sort((a, b) => b.metrics.revenue - a.metrics.revenue)
        res.json(performanceData)
    } catch (err) {
        console.error("Officer analytics error:", err)
        res.status(500).json({ error: "Failed to fetch analytics" })
    }
}

/* ================= ANALYTICS: GEOGRAPHIC BREAKDOWN ================= */
export async function getGeographyAnalytics(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const stateAggregation = await Activity.aggregate([
            { $group: { _id: "$state", meetings: { $sum: 1 }, villages: { $addToSet: "$village" } } },
            { $project: { state: "$_id", meetings: 1, uniqueVillages: { $size: "$villages" } } },
            { $sort: { meetings: -1 } }
        ])
        const salesByState = await Sale.aggregate([
            { $group: { _id: "$state", totalSales: { $sum: 1 }, totalRevenue: { $sum: "$totalAmount" } } }
        ])
        const geoData = stateAggregation.map(state => {
            const salesData = salesByState.find(s => s._id === state.state)
            return { state: state.state || "Unknown", meetings: state.meetings, villages: state.uniqueVillages, sales: salesData?.totalSales || 0, revenue: salesData?.totalRevenue || 0 }
        })
        res.json(geoData)
    } catch (err) {
        console.error("Geography analytics error:", err)
        res.status(500).json({ error: "Failed to fetch geographic data" })
    }
}

/* ================= ANALYTICS: MONTHLY REPORT ================= */
export async function getMonthlyReport(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const year = parseInt(req.query.year) || new Date().getFullYear()
        const month = parseInt(req.query.month) || new Date().getMonth() + 1
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59)

        const [meetings, sales, samples, attendance] = await Promise.all([
            Activity.find({ createdAt: { $gte: startDate, $lte: endDate } }).populate("userId", "name"),
            Sale.find({ createdAt: { $gte: startDate, $lte: endDate } }).populate("userId", "name"),
            Sample.find({ createdAt: { $gte: startDate, $lte: endDate } }).populate("userId", "name"),
            Attendance.find({ startTime: { $gte: startDate, $lte: endDate } }).populate("userId", "name")
        ])

        const dailyData = {}
        for (let day = 1; day <= endDate.getDate(); day++) {
            const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0]
            dailyData[dateStr] = { date: dateStr, meetings: 0, sales: 0, samples: 0, revenue: 0, distance: 0 }
        }
        meetings.forEach(m => { const d = m.createdAt.toISOString().split('T')[0]; if (dailyData[d]) dailyData[d].meetings++ })
        sales.forEach(s => { const d = s.createdAt.toISOString().split('T')[0]; if (dailyData[d]) { dailyData[d].sales++; dailyData[d].revenue += s.totalAmount } })
        samples.forEach(s => { const d = s.createdAt.toISOString().split('T')[0]; if (dailyData[d]) dailyData[d].samples++ })
        attendance.forEach(a => { const d = a.startTime.toISOString().split('T')[0]; if (dailyData[d]) dailyData[d].distance += a.totalDistance || 0 })

        const officerPerformance = {}
        sales.forEach(s => {
            const id = s.userId._id.toString()
            if (!officerPerformance[id]) officerPerformance[id] = { name: s.userId.name, sales: 0, revenue: 0 }
            officerPerformance[id].sales++
            officerPerformance[id].revenue += s.totalAmount
        })

        res.json({
            period: { year, month },
            summary: {
                totalMeetings: meetings.length, totalSales: sales.length, totalSamples: samples.length,
                totalRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
                totalDistance: attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0),
                uniqueVillages: [...new Set(meetings.map(m => m.village).filter(Boolean))].length
            },
            dailyData: Object.values(dailyData),
            topPerformers: Object.values(officerPerformance).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        })
    } catch (err) {
        console.error("Monthly report error:", err)
        res.status(500).json({ error: "Failed to generate monthly report" })
    }
}

/* ================= MAP DATA ================= */
export async function getMapActivities(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const activityType = req.query.type
        let query = {}
        if (activityType && activityType !== 'all') query.activity = activityType.toUpperCase()

        const locations = await LocationLog.find(query).populate("userId", "name").sort({ timestamp: -1 }).limit(1000)
        res.json(locations.map(loc => ({
            lat: loc.location.lat, lng: loc.location.lng, address: loc.location.address,
            activity: loc.activity, officer: loc.userId?.name, timestamp: loc.timestamp
        })))
    } catch (err) {
        console.error("Map data error:", err)
        res.status(500).json({ error: "Failed to fetch map data" })
    }
}

/* ================= MEETING DETAIL ================= */
export async function getMeetingDetail(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })
        const meeting = await Activity.findById(req.params.id).populate("userId", "name email phone state district")
        if (!meeting) return res.status(404).json({ error: "Meeting not found" })
        res.json(meeting)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch meeting details" })
    }
}

/* ================= SALE DETAIL ================= */
export async function getSaleDetail(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })
        const sale = await Sale.findById(req.params.id).populate("userId", "name email phone state district")
        if (!sale) return res.status(404).json({ error: "Sale not found" })
        res.json(sale)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sale details" })
    }
}

/* ================= USER MANAGEMENT ================= */
export async function createUser(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })
        const user = await User.create(req.body)
        res.json({ message: "User created", user })
    } catch (err) {
        res.status(500).json({ error: "Failed to create user" })
    }
}

export async function updateUser(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select("-password")
        res.json(user)
    } catch (err) {
        res.status(500).json({ error: "Failed to update user" })
    }
}

/* ================= LIVE TRACKING ================= */
export async function getLiveLocations(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admin allowed" })

        const fieldOfficers = await User.find({ role: "FIELD" }).select("-password")
        const locations = await Promise.all(fieldOfficers.map(async (officer) => {
            const latestLocation = await LocationLog.findOne({ userId: officer._id }).sort({ timestamp: -1 })
            const activeAttendance = await Attendance.findOne({ userId: officer._id, endTime: null })
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const todayAttendance = await Attendance.findOne({ userId: officer._id, startTime: { $gte: today } }).sort({ startTime: -1 })
            return {
                officer: { id: officer._id, name: officer.name, phone: officer.phone, email: officer.email, state: officer.state, district: officer.district },
                location: latestLocation?.location || null, timestamp: latestLocation?.timestamp || null,
                accuracy: latestLocation?.accuracy || null, activity: latestLocation?.activity || null,
                distanceTravelled: todayAttendance?.totalDistance || 0, isActive: !!activeAttendance,
                lastUpdated: latestLocation ? new Date(latestLocation.timestamp).toLocaleString() : "No data"
            }
        }))
        res.json(locations)
    } catch (err) {
        console.error("Live tracking error:", err)
        res.status(500).json({ error: "Failed to fetch live locations" })
    }
}

export async function getLocationHistory(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admin allowed" })
        const hours = parseInt(req.query.hours) || 24
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
        const locations = await LocationLog.find({ userId: req.params.userId, timestamp: { $gte: startTime } }).populate("userId", "name email phone").sort({ timestamp: 1 })
        res.json(locations)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch location history" })
    }
}

export async function getOfficerTracking(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admin allowed" })
        const officer = await User.findById(req.params.userId).select("-password")
        const latestLocation = await LocationLog.findOne({ userId: req.params.userId }).sort({ timestamp: -1 })
        const activeAttendance = await Attendance.findOne({ userId: req.params.userId, endTime: null })
        res.json({
            officer: { id: officer._id, name: officer.name, phone: officer.phone, email: officer.email, state: officer.state, district: officer.district },
            location: latestLocation?.location || null, timestamp: latestLocation?.timestamp || null,
            accuracy: latestLocation?.accuracy || null, activity: latestLocation?.activity || null,
            isActive: !!activeAttendance, lastUpdated: latestLocation ? new Date(latestLocation.timestamp).toLocaleString() : "No data"
        })
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch officer tracking data" })
    }
}

/* ================= MESSAGES ================= */
export async function getMessages(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admin allowed" })
        const limit = parseInt(req.query.limit) || 100
        const messages = await AdminMessage.find().sort({ timestamp: -1 }).limit(limit).lean()
        res.json(messages)
    } catch (err) {
        console.error("Get messages error:", err)
        res.status(500).json({ error: "Failed to fetch messages" })
    }
}

export async function createMessage(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers can create messages" })
        const { text, location, distanceTravelled, status, meetingType } = req.body
        const message = await AdminMessage.create({
            officerId: req.user._id, officerName: req.user.name, officerPhone: req.user.phone,
            text, location, distanceTravelled, status: status || "UPDATE", meetingType
        })
        res.status(201).json(message)
    } catch (err) {
        console.error("Create message error:", err)
        res.status(500).json({ error: "Failed to create message" })
    }
}

/* ================= FIELD OFFICERS LIST ================= */
export async function getFieldOfficers(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        // Role in the User schema enum is "FIELD" (all caps) — confirmed from models/index.js
        const fieldOfficers = await User.find({ role: "FIELD" }).select("-password").lean()

        if (fieldOfficers.length === 0) {
            // Return empty but valid response so the frontend shows the empty state
            return res.json({
                officers: [],
                summary: { totalOfficers: 0, activeNow: 0, totalMeetingsToday: 0, totalSamplesToday: 0, totalFleetDistance: 0 }
            })
        }

        // Cast to mongoose ObjectId for aggregation pipeline compatibility
        const officerIds = fieldOfficers.map(u => new mongoose.Types.ObjectId(u._id))

        const today = new Date(); today.setHours(0, 0, 0, 0)

        // All queries run in parallel for performance
        const [
            activeAttendances,
            todayAttendances,
            todayMeetingsAgg,
            todaySamplesAgg,
            todayMeetingSamplesAgg,
            lastLocations,
            recentDailyLogs
        ] = await Promise.all([
            // Open attendance sessions → GPS active + live distance
            Attendance.find({ userId: { $in: officerIds }, endTime: null })
                .select("userId totalDistance startTime")
                .lean(),

            // Today's closed + open attendance → total distance today
            Attendance.find({ userId: { $in: officerIds }, startTime: { $gte: today } })
                .select("userId totalDistance endTime")
                .lean(),

            // Today's meetings per officer (aggregation needs ObjectId cast)
            Activity.aggregate([
                { $match: { userId: { $in: officerIds }, createdAt: { $gte: today } } },
                { $group: { _id: "$userId", meetingsToday: { $sum: 1 } } }
            ]),

            // Today's samples per officer — counts BOTH Sample records AND meetings where productSampleGiven=true
            Sample.aggregate([
                { $match: { userId: { $in: officerIds }, createdAt: { $gte: today } } },
                { $group: { _id: "$userId", samplesToday: { $sum: 1 } } }
            ]),

            // Today's meeting-based samples (productSampleGiven=true in Activity)
            Activity.aggregate([
                { $match: { userId: { $in: officerIds }, createdAt: { $gte: today }, productSampleGiven: true } },
                { $group: { _id: "$userId", meetingSamplesToday: { $sum: 1 } } }
            ]),

            // Most recent GPS point per officer
            LocationLog.aggregate([
                { $match: { userId: { $in: officerIds } } },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: "$userId",
                        location: { $first: "$location" },
                        timestamp: { $first: "$timestamp" },
                        accuracy: { $first: "$accuracy" }
                    }
                }
            ]),

            // Last 2 days of completed attendance sessions per officer (dailyLogs)
            Attendance.find({
                userId: { $in: officerIds },
                endTime: { $ne: null },
                startTime: { $gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
            })
                .select("userId startTime endTime totalDistance startLocation endLocation")
                .sort({ startTime: -1 })
                .lean()
        ])

        // Build O(1) lookup maps — keys are string IDs
        const activeAttMap      = new Map(activeAttendances.map(a => [a.userId.toString(), a]))
        const meetingMap        = new Map(todayMeetingsAgg.map(m => [m._id.toString(), m.meetingsToday]))
        const sampleMap         = new Map(todaySamplesAgg.map(s => [s._id.toString(), s.samplesToday]))
        const meetingSampleMap  = new Map(todayMeetingSamplesAgg.map(s => [s._id.toString(), s.meetingSamplesToday]))
        const locationMap       = new Map(lastLocations.map(l => [l._id.toString(), l]))

        // Sum today's distance per officer (handles multiple sessions in one day)
        const distanceMap = new Map()
        todayAttendances.forEach(a => {
            const id = a.userId.toString()
            distanceMap.set(id, (distanceMap.get(id) || 0) + (a.totalDistance || 0))
        })

        // Group last-2-days completed sessions per officer
        const dailyLogsMap = new Map()
        recentDailyLogs.forEach(a => {
            const id = a.userId.toString()
            if (!dailyLogsMap.has(id)) dailyLogsMap.set(id, [])
            dailyLogsMap.get(id).push({
                startTime:     a.startTime,
                endTime:       a.endTime,
                totalDistance: parseFloat((a.totalDistance || 0).toFixed(3)),
                startLocation: a.startLocation || null,
                endLocation:   a.endLocation   || null
            })
        })

        const result = fieldOfficers.map(officer => {
            const id  = officer._id.toString()
            const att = activeAttMap.get(id)
            const loc = locationMap.get(id)

            // currentSession: the live open attendance record (null if day not started)
            const currentSession = att ? {
                isActive:      true,
                startTime:     att.startTime,
                totalDistance: parseFloat((att.totalDistance || 0).toFixed(6))
            } : { isActive: false, startTime: null, totalDistance: 0 }

            return {
                _id:              officer._id,
                name:             officer.name,
                email:            officer.email,
                phone:            officer.phone,
                state:            officer.state,
                district:         officer.district,
                isActive:         !!att,
                startTime:        att?.startTime || null,
                totalDistance:    parseFloat((distanceMap.get(id) || 0).toFixed(6)),
                lastLocation:     loc?.location  || null,
                lastLocationTime: loc?.timestamp || null,
                locationAccuracy: loc?.accuracy  || null,
                meetingsToday:    meetingMap.get(id) || 0,
                samplesToday:     (sampleMap.get(id) || 0) + (meetingSampleMap.get(id) || 0),
                currentSession
            }
        })

        const summary = {
            totalOfficers:      result.length,
            activeNow:          result.filter(o => o.isActive).length,
            totalMeetingsToday: result.reduce((s, o) => s + o.meetingsToday, 0),
            totalSamplesToday:  result.reduce((s, o) => s + o.samplesToday, 0),
            totalFleetDistance: parseFloat(result.reduce((s, o) => s + o.totalDistance, 0).toFixed(6))
        }

        res.json({ officers: result, summary })
    } catch (err) {
        console.error("Fetch field officers error:", err)
        res.status(500).json({ error: "Failed to fetch field officers" })
    }
}

/* ================= OFFICER MEETING HISTORY ================= */
export async function getOfficerMeetings(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const meetings = await Activity.find({ userId: req.params.officerId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()

        res.json(meetings)
    } catch (err) {
        console.error("Get officer meetings error:", err)
        res.status(500).json({ error: "Failed to fetch officer meetings" })
    }
}

/* ================= OFFICER DAILY LOGS (distance history) ================= */
export async function getOfficerDailyLogs(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const days = parseInt(req.query.days) || 30
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

        // Completed sessions only (endTime set) — these are the historical dailyLogs
        const logs = await Attendance.find({
            userId: req.params.officerId,
            endTime: { $ne: null },
            startTime: { $gte: since }
        })
            .select("startTime endTime totalDistance startLocation endLocation")
            .sort({ startTime: -1 })
            .lean()

        // Active session (if any) — this is the currentSession
        const currentSession = await Attendance.findOne({
            userId: req.params.officerId,
            endTime: null
        })
            .select("startTime totalDistance startLocation")
            .lean()

        res.json({
            currentSession: currentSession
                ? {
                    isActive:      true,
                    startTime:     currentSession.startTime,
                    totalDistance: parseFloat((currentSession.totalDistance || 0).toFixed(3)),
                    startLocation: currentSession.startLocation || null
                }
                : { isActive: false, startTime: null, totalDistance: 0 },
            dailyLogs: logs.map(l => ({
                startTime:     l.startTime,
                endTime:       l.endTime,
                totalDistance: parseFloat((l.totalDistance || 0).toFixed(3)),
                startLocation: l.startLocation || null,
                endLocation:   l.endLocation   || null,
                durationHours: parseFloat(
                    ((new Date(l.endTime) - new Date(l.startTime)) / (1000 * 60 * 60)).toFixed(2)
                )
            }))
        })
    } catch (err) {
        console.error("Get officer daily logs error:", err)
        res.status(500).json({ error: "Failed to fetch officer daily logs" })
    }
}

/* ================= DISTRIBUTOR MANAGEMENT ================= */
export async function getDistributors(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const distributors = await User.find({ role: "DISTRIBUTOR" }).select("-password").lean()
        const distributorIds = distributors.map(d => d._id)

        const today = new Date(); today.setHours(0, 0, 0, 0)

        // Run all queries in parallel for performance
        const [
            activeAttendances,
            todaySalesAgg,
            inventoryAgg,
            lastLocations
        ] = await Promise.all([
            // Active (open) attendance sessions — gives live distance + GPS status
            Attendance.find({ userId: { $in: distributorIds }, endTime: null })
                .select("userId totalDistance startTime startLocation")
                .lean(),

            // Today's sales aggregated per distributor
            Sale.aggregate([
                { $match: { userId: { $in: distributorIds }, createdAt: { $gte: today } } },
                {
                    $group: {
                        _id: "$userId",
                        todayRevenue: { $sum: "$totalAmount" },
                        todaySalesCount: { $sum: 1 }
                    }
                }
            ]),

            // Current stock per distributor (sum of currentStock across all products)
            DistributorInventory.aggregate([
                { $match: { distributorId: { $in: distributorIds } } },
                {
                    $group: {
                        _id: "$distributorId",
                        totalStock: { $sum: "$currentStock" },
                        productCount: { $sum: 1 }
                    }
                }
            ]),

            // Most recent GPS point per distributor
            LocationLog.aggregate([
                { $match: { userId: { $in: distributorIds } } },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: "$userId",
                        location: { $first: "$location" },
                        timestamp: { $first: "$timestamp" },
                        accuracy: { $first: "$accuracy" }
                    }
                }
            ])
        ])

        // Build lookup maps for O(1) access
        const activeAttMap  = new Map(activeAttendances.map(a => [a.userId.toString(), a]))
        const salesMap      = new Map(todaySalesAgg.map(s => [s._id.toString(), s]))
        const inventoryMap  = new Map(inventoryAgg.map(i => [i._id.toString(), i]))
        const locationMap   = new Map(lastLocations.map(l => [l._id.toString(), l]))

        const result = distributors.map(d => {
            const id        = d._id.toString()
            const att       = activeAttMap.get(id)
            const sales     = salesMap.get(id)
            const inv       = inventoryMap.get(id)
            const loc       = locationMap.get(id)

            return {
                _id:          d._id,
                name:         d.name,
                email:        d.email,
                phone:        d.phone,
                state:        d.state,
                district:     d.district,
                // GPS / attendance
                isActive:     !!att,                                          // Day started and not ended
                startTime:    att?.startTime || null,
                // High-precision distance from the $inc-accumulated field
                totalDistance: parseFloat((att?.totalDistance || 0).toFixed(6)),
                lastLocation: loc?.location || null,
                lastLocationTime: loc?.timestamp || null,
                locationAccuracy: loc?.accuracy || null,
                // Today's commercial activity
                todayRevenue:     sales?.todayRevenue     || 0,
                todaySalesCount:  sales?.todaySalesCount  || 0,
                // Inventory
                totalStock:   inv?.totalStock   || 0,
                productCount: inv?.productCount || 0
            }
        })

        // Summary stats for the stat row
        const summary = {
            totalDistributors:  result.length,
            activeDistributors: result.filter(d => d.isActive).length,
            totalFleetDistance: parseFloat(result.reduce((s, d) => s + d.totalDistance, 0).toFixed(6)),
            totalTodayRevenue:  result.reduce((s, d) => s + d.todayRevenue, 0),
            totalStock:         result.reduce((s, d) => s + d.totalStock, 0)
        }

        res.json({ distributors: result, summary })
    } catch (err) {
        console.error("Get distributors error:", err)
        res.status(500).json({ error: "Failed to fetch distributor data" })
    }
}

/* ================= DISTRIBUTOR SALE HISTORY ================= */
export async function getDistributorSales(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const sales = await Sale.find({ userId: req.params.distributorId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()

        res.json(sales)
    } catch (err) {
        console.error("Get distributor sales error:", err)
        res.status(500).json({ error: "Failed to fetch distributor sales" })
    }
}

/* ================= DISTRIBUTOR ANALYTICS (charts + inventory) ================= */
export async function getDistributorAnalytics(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const { distributorId } = req.params
        const days = parseInt(req.query.days) || 30
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        startDate.setHours(0, 0, 0, 0)

        const [sales, inventory] = await Promise.all([
            Sale.find({ userId: distributorId, createdAt: { $gte: startDate } })
                .sort({ createdAt: 1 })
                .lean(),
            DistributorInventory.find({ distributorId })
                .sort({ lastUpdated: -1 })
                .lean()
        ])

        // Build daily sales chart data
        const dailyMap = {}
        sales.forEach(s => {
            const day = new Date(s.createdAt).toISOString().split("T")[0]
            if (!dailyMap[day]) dailyMap[day] = { date: day, quantity: 0, revenue: 0, count: 0 }
            dailyMap[day].quantity += s.quantity || 0
            dailyMap[day].revenue  += s.totalAmount || 0
            dailyMap[day].count    += 1
        })
        const dailyChart = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

        // Inventory summary with correct math: received - sold
        const allSales = await Sale.find({ userId: distributorId }).lean()
        const inventorySummary = inventory.map(item => {
            const sold = allSales
                .filter(s => s.productName === item.productName)
                .reduce((sum, s) => sum + (s.quantity || 0), 0)
            return {
                productName:      item.productName,
                packSize:         item.packSize,
                quantityReceived: item.quantityReceived || 0,
                quantityDistributed: sold,
                currentStock:     Math.max(0, (item.quantityReceived || 0) - sold),
                pricePerUnit:     item.pricePerUnit || 0,
                lastUpdated:      item.lastUpdated
            }
        })

        const totalRevenue   = sales.reduce((s, x) => s + (x.totalAmount || 0), 0)
        const totalStock     = inventorySummary.reduce((s, i) => s + i.currentStock, 0)
        const totalReceived  = inventorySummary.reduce((s, i) => s + i.quantityReceived, 0)
        const totalSold      = inventorySummary.reduce((s, i) => s + i.quantityDistributed, 0)

        res.json({
            dailyChart,
            inventorySummary,
            summary: { totalRevenue, totalStock, totalReceived, totalSold, salesCount: sales.length }
        })
    } catch (err) {
        console.error("Distributor analytics error:", err)
        res.status(500).json({ error: "Failed to fetch distributor analytics" })
    }
}

/* ================= GLOBAL MONTHLY DISTRIBUTOR CHART ================= */
export async function getDistributorMonthlyChart(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const distributors = await User.find({ role: "DISTRIBUTOR" }).select("_id").lean()
        const distIds = distributors.map(d => d._id)

        const sales = await Sale.find({
            userId: { $in: distIds },
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }).sort({ createdAt: 1 }).lean()

        // Aggregate by day
        const dailyMap = {}
        for (let d = 1; d <= endOfMonth.getDate(); d++) {
            const dateStr = new Date(now.getFullYear(), now.getMonth(), d).toISOString().split("T")[0]
            dailyMap[dateStr] = { date: dateStr, quantity: 0, revenue: 0, count: 0 }
        }
        sales.forEach(s => {
            const day = new Date(s.createdAt).toISOString().split("T")[0]
            if (dailyMap[day]) {
                dailyMap[day].quantity += s.quantity || 0
                dailyMap[day].revenue  += s.totalAmount || 0
                dailyMap[day].count    += 1
            }
        })

        res.json({
            chart: Object.values(dailyMap),
            summary: {
                totalRevenue:  sales.reduce((s, x) => s + (x.totalAmount || 0), 0),
                totalQuantity: sales.reduce((s, x) => s + (x.quantity || 0), 0),
                totalSales:    sales.length,
                month:         startOfMonth.toLocaleString("default", { month: "long", year: "numeric" })
            }
        })
    } catch (err) {
        console.error("Monthly distributor chart error:", err)
        res.status(500).json({ error: "Failed to fetch monthly chart" })
    }
}
