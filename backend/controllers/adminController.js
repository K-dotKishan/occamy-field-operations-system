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

        const fieldOfficers = await User.find({ role: "FIELD" }).select("-password").lean()
        const officerIds = fieldOfficers.map(u => u._id)

        const lastLocations = await LocationLog.aggregate([
            { $match: { userId: { $in: officerIds } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$userId", location: { $first: "$location" }, timestamp: { $first: "$timestamp" } } }
        ])

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const todayAttendances = await Attendance.find({ userId: { $in: officerIds }, startTime: { $gte: today } }).select("userId totalDistance endTime").lean()
        const todayActivities = await Activity.aggregate([
            { $match: { userId: { $in: officerIds }, createdAt: { $gte: today } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ])

        const locationMap = new Map(lastLocations.map(l => [l._id.toString(), l]))
        const attendanceMap = new Map()
        const meetingMap = new Map(todayActivities.map(a => [a._id.toString(), a.count]))

        todayAttendances.forEach(a => {
            if (!attendanceMap.has(a.userId.toString())) attendanceMap.set(a.userId.toString(), [])
            attendanceMap.get(a.userId.toString()).push(a)
        })

        res.json(fieldOfficers.map(officer => {
            const loc = locationMap.get(officer._id.toString())
            const userAttendances = attendanceMap.get(officer._id.toString()) || []
            return {
                _id: officer._id, name: officer.name, email: officer.email, phone: officer.phone,
                lastLocation: loc?.location || null, lastUpdate: loc?.timestamp || null,
                totalDistance: userAttendances.reduce((sum, a) => sum + (a.totalDistance || 0), 0),
                meetingsToday: meetingMap.get(officer._id.toString()) || 0,
                isOnline: userAttendances.some(a => !a.endTime), battery: 100
            }
        }))
    } catch (err) {
        console.error("Fetch field officers error:", err)
        res.status(500).json({ error: "Failed to fetch field officers" })
    }
}
