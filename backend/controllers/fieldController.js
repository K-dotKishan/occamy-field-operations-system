import { Attendance, Activity, Sale, Sample, LocationLog, AdminMessage, User, AnalyticsSummary, LocationTrack } from "../models/index.js"
import { calculateDistance } from "../utils/distance.js"

/* ================= UPLOAD PHOTO ================= */
export async function uploadPhoto(req, res) {
    res.json({ photoUrl: `/uploads/${req.file.filename}` })
}

/* ================= FIELD SUMMARY ================= */
export async function getSummary(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const activeAttendance = await Attendance.findOne({ userId: req.user.id, endTime: null })
        const meetings = await Activity.countDocuments({ userId: req.user.id, createdAt: { $gte: today } })
        const samples = await Sample.countDocuments({ userId: req.user.id, createdAt: { $gte: today } })
        const salesData = await Sale.aggregate([
            { $match: { userId: req.user.id, createdAt: { $gte: today } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }
        ])
        const attendances = await Attendance.find({ userId: req.user.id, startTime: { $gte: today } })
        const distanceTraveled = attendances.reduce((sum, att) => sum + (att.totalDistance || 0), 0)

        res.json({
            today: {
                isActive: !!activeAttendance, meetings, samples,
                sales: salesData[0]?.count || 0, revenue: salesData[0]?.revenue || 0,
                distanceTraveled: parseFloat(distanceTraveled.toFixed(2))
            }
        })
    } catch (err) {
        console.error("Field summary error:", err)
        res.status(500).json({ error: "Failed to fetch summary" })
    }
}

/* ================= FIELD DASHBOARD ================= */
export async function getDashboard(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const activeAttendance = await Attendance.findOne({ userId: req.user.id, endTime: null })
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const locationTrack = await LocationTrack.findOne({ userId: req.user.id, date: today }).sort({ "path.time": -1 })
        const lastLocation = locationTrack?.path?.[locationTrack.path.length - 1] || null

        res.json({
            activeAttendance: activeAttendance || null,
            lastLocation: lastLocation ? { lat: lastLocation.lat, lng: lastLocation.lng, time: lastLocation.time } : null
        })
    } catch (err) {
        console.error("Field dashboard error:", err)
        res.status(500).json({ error: "Failed to fetch dashboard data" })
    }
}

/* ================= LOG LOCATION ================= */
export async function logLocation(req, res) {
    try {
        const { lat, lng } = req.body
        const userId = req.user?.id || req.body.userId
        const today = new Date(); today.setHours(0, 0, 0, 0)

        let track = await LocationTrack.findOne({ userId, date: today })
        if (!track) track = await LocationTrack.create({ userId, date: today, path: [] })

        track.path.push({ lat, lng, time: new Date() })
        await track.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

/* ================= START DAY ================= */
export async function startAttendance(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const activeAttendance = await Attendance.findOne({ userId: req.user.id, endTime: null })
        if (activeAttendance) return res.status(400).json({ error: "Day already started. Please end the current day first." })

        const attendance = await Attendance.create({
            userId: req.user.id,
            startLocation: { lat: req.body.location.lat, lng: req.body.location.lng, address: req.body.location.address || "" },
            startTime: new Date(),
            startOdometer: req.body.odometer || 0
        })
        res.json(attendance)
    } catch (err) {
        console.error("Start day error:", err)
        res.status(500).json({ error: "Failed to start day" })
    }
}

/* ================= END DAY ================= */
export async function endAttendance(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const attendance = await Attendance.findOne({ userId: req.user.id, endTime: null }).sort({ startTime: -1 })
        if (!attendance) return res.status(400).json({ error: "No active day found" })

        const totalDistance = req.body.odometer ? req.body.odometer - attendance.startOdometer : (attendance.totalDistance || 0)
        attendance.endTime = new Date()
        attendance.endLocation = { lat: req.body.location.lat, lng: req.body.location.lng, address: req.body.location.address || "" }
        attendance.endOdometer = req.body.odometer || 0
        attendance.totalDistance = totalDistance
        await attendance.save()

        res.json({ message: "Day ended successfully", attendance })
    } catch (err) {
        console.error("End day error:", err)
        res.status(500).json({ error: "Failed to end day" })
    }
}

/* ================= LOG MEETING (ONE-TO-ONE) ================= */
export async function logOneToOneMeeting(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []
        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        const activity = await Activity.create({
            userId: req.user.id, type: "ONE_TO_ONE",
            personName: req.body.personName, contactNumber: req.body.contactNumber, category: req.body.category,
            landSize: req.body.landSize, cropType: req.body.cropType, shopName: req.body.shopName,
            monthlyTurnover: req.body.monthlyTurnover, socialHandle: req.body.socialHandle,
            followerCount: req.body.followerCount, agencyName: req.body.agencyName, territory: req.body.territory,
            businessPotential: req.body.businessPotential ? (typeof req.body.businessPotential === 'string' ? JSON.parse(req.body.businessPotential) : req.body.businessPotential) : undefined,
            location, village: req.body.village, district: req.body.district, state: req.body.state,
            notes: req.body.notes, photos: photoUrls,
            followUpRequired: req.body.followUpRequired === 'true', followUpDate: req.body.followUpDate || undefined
        })

        LocationLog.create({ userId: req.user.id, location, activity: "MEETING", timestamp: new Date() }).catch(err => console.error("Failed to log meeting location:", err.message))

        try {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
            const officer = await User.findById(req.user.id).select('name phone')
            AdminMessage.create({
                officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
                text: `One-to-one meeting with ${req.body.personName || 'participant'}${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
                location, distanceTravelled: att?.totalDistance || 0, status: 'MEETING', meetingType: 'ONE_TO_ONE', timestamp: new Date()
            }).catch(err => console.error("Failed to create admin message:", err.message))
        } catch (msgErr) { console.error('Error preparing admin message:', msgErr) }

        res.json(activity)
    } catch (err) {
        console.error("Meeting logging error:", err)
        res.status(500).json({ error: "Failed to log meeting: " + err.message })
    }
}

/* ================= LOG MEETING (JSON) ================= */
export async function logMeeting(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const mt = (req.body.meetingType || req.body.type || 'ONE_TO_ONE').toUpperCase()
        const location = parseLoc(req.body.location)

        const activityPayload = {
            userId: req.user.id, type: mt, notes: req.body.notes || '',
            photos: req.body.photos || (req.body.photoUrl ? [req.body.photoUrl] : []),
            category: req.body.category || 'FARMER'
        }

        if (mt === 'ONE_TO_ONE') {
            activityPayload.personName = req.body.personName || req.body.person || req.body.farmerName || ''
            activityPayload.contactNumber = req.body.contactNumber || req.body.contact || req.body.phoneNumber || ''
            activityPayload.location = location; activityPayload.village = req.body.village || ''
            activityPayload.district = req.body.district || ''
            activityPayload.landSize = req.body.landSize; activityPayload.cropType = req.body.cropType
            activityPayload.shopName = req.body.shopName; activityPayload.monthlyTurnover = req.body.monthlyTurnover
            activityPayload.socialHandle = req.body.socialHandle; activityPayload.followerCount = req.body.followerCount
            activityPayload.agencyName = req.body.agencyName; activityPayload.territory = req.body.territory
        } else {
            activityPayload.village = req.body.village || ''; activityPayload.district = req.body.district || ''
            activityPayload.state = req.body.state || ''; activityPayload.attendeesCount = parseInt(req.body.attendeesCount) || 0
            activityPayload.meetingType = req.body.meetingTypeDetail || req.body.meetingType || ''; activityPayload.location = location
        }

        const activity = await Activity.create(activityPayload)
        if (activity.location?.lat) LocationLog.create({ userId: req.user.id, location: activity.location, activity: 'MEETING' }).catch(e => console.error("Loc log error:", e.message))

        try {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
            const officer = await User.findById(req.user.id).select('name phone')
            const text = activity.type === 'ONE_TO_ONE'
                ? `One-to-one meeting with ${activity.personName || 'participant'}${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`
                : `Group meeting at ${activity.village || 'unknown'} with ${activity.attendeesCount || 0} attendees${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`
            await AdminMessage.create({
                officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
                text, location: activity.location || { lat: 0, lng: 0, address: '' },
                distanceTravelled: att?.totalDistance || 0, status: 'MEETING', meetingType: activity.type, timestamp: new Date()
            })
        } catch (msgErr) { console.error('Failed to create admin message for JSON meeting:', msgErr) }

        res.status(201).json(activity)
    } catch (err) {
        console.error('JSON meeting logging error:', err)
        res.status(500).json({ error: 'Failed to log meeting', details: err.message })
    }
}

/* ================= LOG MEETING (GROUP) ================= */
export async function logGroupMeeting(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []
        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        const activity = await Activity.create({
            userId: req.user.id, type: "GROUP",
            village: req.body.village, district: req.body.district, state: req.body.state,
            attendeesCount: parseInt(req.body.attendeesCount), meetingType: req.body.meetingType,
            category: req.body.category || "FARMER", location, notes: req.body.notes, photos: photoUrls
        })

        LocationLog.create({ userId: req.user.id, location, activity: "MEETING" }).catch(e => console.error("Group meeting loc log error:", e.message))

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
        const officer = await User.findById(req.user.id).select('name phone')
        AdminMessage.create({
            officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
            text: `Group meeting at ${req.body.village || 'unknown'} with ${req.body.attendeesCount || 0} attendees${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
            location, distanceTravelled: att?.totalDistance || 0, status: 'MEETING', meetingType: 'GROUP', timestamp: new Date()
        }).catch(e => console.error('Failed to create admin message for group meeting:', e))

        res.json(activity)
    } catch (err) {
        console.error("Group meeting error:", err)
        res.status(500).json({ error: "Failed to log group meeting" })
    }
}

/* ================= DISTRIBUTE SAMPLE ================= */
export async function logSample(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []
        const sample = await Sample.create({
            userId: req.user.id, productName: req.body.productName, productSKU: req.body.productSKU,
            quantity: parseFloat(req.body.quantity), unit: req.body.unit,
            recipientName: req.body.recipientName, recipientContact: req.body.recipientContact, recipientCategory: req.body.recipientCategory,
            purpose: req.body.purpose, expectedFeedbackDate: req.body.expectedFeedbackDate || undefined,
            location: JSON.parse(req.body.location), village: req.body.village, district: req.body.district, state: req.body.state, photos: photoUrls
        })
        LocationLog.create({ userId: req.user.id, location: JSON.parse(req.body.location), activity: "SAMPLE" }).catch(e => console.error("Sample loc log error:", e.message))
        res.json(sample)
    } catch (err) {
        console.error("Sample distribution error:", err)
        res.status(500).json({ error: "Failed to log sample distribution" })
    }
}

/* ================= RECORD SALE ================= */
export async function logSale(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        const sale = await Sale.create({
            userId: req.user.id, productName: req.body.productName, quantity: req.body.quantity,
            pricePerUnit: req.body.price, totalAmount: req.body.totalAmount, saleType: req.body.saleType,
            farmerName: req.body.farmerName, distributorName: req.body.distributorName,
            village: req.body.village, district: req.body.district, state: req.body.state, location,
            photos: req.body.photos || (req.body.photoUrl ? [req.body.photoUrl] : []), notes: req.body.notes
        })

        if (sale.location?.lat) LocationLog.create({ userId: req.user.id, location: sale.location, activity: 'SALE' }).catch(e => console.error("Sale loc log error:", e.message))
        AdminMessage.create({ officerId: req.user.id, officerName: req.user.name || 'Field Officer', text: `New Sale: ${req.body.quantity}x ${req.body.productName} (₹${req.body.totalAmount})`, location, status: 'SALE', timestamp: new Date() }).catch(e => console.error("Sale admin msg error:", e.message))

        const today = new Date(); today.setHours(0, 0, 0, 0)
        AnalyticsSummary.findOneAndUpdate(
            { userId: req.user.id, date: today },
            { $inc: { salesCount: 1, totalSalesAmount: sale.totalAmount || 0, b2cSales: sale.saleType === 'B2C' ? 1 : 0, b2bSales: sale.saleType === 'B2B' ? 1 : 0 } },
            { upsert: true }
        ).catch(err => console.error("Failed to update sales stats:", err))

        res.json(sale)
    } catch (err) {
        console.error("Sale logging error:", err)
        res.status(500).json({ error: "Failed to log sale: " + err.message })
    }
}

/* ================= UPDATE SAMPLE FEEDBACK ================= */
export async function updateSampleFeedback(req, res) {
    try {
        const sample = await Sample.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { feedbackReceived: true, feedbackNotes: req.body.feedbackNotes, convertedToSale: req.body.convertedToSale || false },
            { new: true }
        )
        if (!sample) return res.status(404).json({ error: "Sample not found" })
        res.json(sample)
    } catch (err) {
        res.status(500).json({ error: "Failed to update feedback" })
    }
}

/* ================= TRACK LOCATION ================= */
export async function trackLocation(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        const { lat, lng, accuracy, address, activity } = req.body
        if (!lat || !lng) return res.status(400).json({ error: "Latitude and longitude required" })

        const attendance = await Attendance.findOne({ userId: req.user.id, endTime: null })
        const locationLog = await LocationLog.create({
            userId: req.user.id, attendanceId: attendance?._id,
            location: { lat, lng, address: address || "" }, accuracy: accuracy || 0, activity: activity || "TRAVEL"
        })

        if (attendance) {
            const lastLog = await LocationLog.findOne({ userId: req.user.id, attendanceId: attendance._id, _id: { $ne: locationLog._id } }).sort({ timestamp: -1 })
            if (lastLog?.location?.lat) {
                const dist = calculateDistance(lastLog.location.lat, lastLog.location.lng, lat, lng)
                if (dist > 0.002 && dist < 100) {
                    attendance.totalDistance = (attendance.totalDistance || 0) + dist
                    await attendance.save()
                }
            }
        }

        res.json({ success: true, message: "Location tracked", locationId: locationLog._id, totalDistance: attendance?.totalDistance || 0 })
    } catch (err) {
        console.error("Location tracking error:", err)
        res.status(500).json({ error: "Failed to track location" })
    }
}

/* ================= GET CURRENT LOCATION ================= */
export async function getCurrentLocation(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })
        const latestLocation = await LocationLog.findOne({ userId: req.user.id }).sort({ timestamp: -1 })
        if (!latestLocation) return res.status(404).json({ error: "No location data found" })
        res.json(latestLocation)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch current location" })
    }
}

/* ================= GET LOCATION HISTORY ================= */
export async function getLocationHistory(req, res) {
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })
        const hours = parseInt(req.query.hours) || 24
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
        const locations = await LocationLog.find({ userId: req.user.id, timestamp: { $gte: startTime } }).sort({ timestamp: 1 })
        res.json(locations)
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch location history" })
    }
}
