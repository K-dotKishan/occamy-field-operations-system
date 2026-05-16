import { Attendance, Activity, Sale, Sample, LocationLog, AdminMessage, User, AnalyticsSummary, LocationTrack } from "../models/index.js"
import { calculateDistance } from "../utils/distance.js"
import { uploadBufferToCloudinary } from "../middleware/upload.js"

// Upload all files in req.files to Cloudinary; returns array of secure URLs.
// Uses Promise.allSettled so a single upload failure never crashes the whole batch.
async function uploadFiles(files) {
    if (!files || files.length === 0) return []
    const results = await Promise.allSettled(
        files.map(f => uploadBufferToCloudinary(f.buffer))
    )
    return results
        .filter(r => r.status === "fulfilled")
        .map(r => r.value)
}

/* ================= UPLOAD PHOTO ================= */
export async function uploadPhoto(req, res) {
    // req.file.path is the full Cloudinary HTTPS URL when using multer-storage-cloudinary
    res.json({ photoUrl: req.file.path })
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
            activeAttendance: activeAttendance
                ? {
                    _id: activeAttendance._id,
                    startTime: activeAttendance.startTime,
                    startLocation: activeAttendance.startLocation,
                    totalDistance: activeAttendance.totalDistance || 0,
                    endTime: activeAttendance.endTime || null
                }
                : null,
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

        // Create a fresh session — totalDistance is explicitly 0 (clean slate)
        const attendance = await Attendance.create({
            userId: req.user.id,
            startLocation: { lat: req.body.location.lat, lng: req.body.location.lng, address: req.body.location.address || "" },
            startTime: new Date(),
            startOdometer: req.body.odometer || 0,
            totalDistance: 0
        })

        res.json({
            ...attendance.toObject(),
            resetDistance: 0   // signal to frontend: distance starts at 0
        })
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

        const elapsedMs = Date.now() - new Date(attendance.startTime).getTime()
        const elapsedHours = elapsedMs / (1000 * 60 * 60)

        // Use GPS-accumulated distance; fall back to odometer diff if GPS is zero
        const gpsDistance = attendance.totalDistance || 0
        const odometerDistance = req.body.odometer ? req.body.odometer - (attendance.startOdometer || 0) : null
        const finalDistance = gpsDistance > 0 ? gpsDistance : (odometerDistance !== null && odometerDistance >= 0 ? odometerDistance : 0)

        attendance.endTime = new Date()
        attendance.endLocation = {
            lat: req.body.location?.lat || 0,
            lng: req.body.location?.lng || 0,
            address: req.body.location?.address || ""
        }
        attendance.endOdometer = req.body.odometer || 0
        attendance.totalDistance = parseFloat(finalDistance.toFixed(3))
        await attendance.save()

        // Build the dailyLog entry that the admin panel reads
        const dailyLog = {
            startTime:     attendance.startTime,
            endTime:       attendance.endTime,
            totalDistance: attendance.totalDistance,
            startLocation: attendance.startLocation || null,
            endLocation:   attendance.endLocation   || null,
            durationHours: parseFloat(elapsedHours.toFixed(2))
        }

        res.json({
            message: "Day ended successfully",
            attendance,
            dailyLog,           // completed session — admin can read this directly
            summary: {
                totalDistance: attendance.totalDistance,
                startTime:     attendance.startTime,
                endTime:       attendance.endTime,
                durationHours: parseFloat(elapsedHours.toFixed(2))
            },
            resetDistance: 0    // explicit signal to frontend: reset live distance to 0
        })
    } catch (err) {
        console.error("End day error:", err)
        res.status(500).json({ error: "Failed to end day" })
    }
}

/* ================= LOG MEETING (ONE-TO-ONE) ================= */
export async function logOneToOneMeeting(req, res) {
    console.log("[ONE-TO-ONE] Route hit")
    try {
        console.log("[ONE-TO-ONE] Auth passed, user:", req.user?.id, "role:", req.user?.role)
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        console.log("[ONE-TO-ONE] Upload middleware finished, files:", req.files?.length ?? 0)

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        console.log("[ONE-TO-ONE] DB save starting...")
        // Save the activity — single DB write, no parallel queries
        const activity = await Activity.create({
            userId: req.user.id, type: "ONE_TO_ONE",
            personName: req.body.personName, contactNumber: req.body.contactNumber, category: req.body.category,
            landSize: req.body.landSize, cropType: req.body.cropType, shopName: req.body.shopName,
            monthlyTurnover: req.body.monthlyTurnover, socialHandle: req.body.socialHandle,
            followerCount: req.body.followerCount, agencyName: req.body.agencyName, territory: req.body.territory,
            businessPotential: req.body.businessPotential ? (typeof req.body.businessPotential === 'string' ? JSON.parse(req.body.businessPotential) : req.body.businessPotential) : undefined,
            location, village: req.body.village, district: req.body.district, state: req.body.state,
            notes: req.body.notes, photos: [],
            followUpRequired: req.body.followUpRequired === 'true', followUpDate: req.body.followUpDate || undefined
        })
        console.log("[ONE-TO-ONE] DB saved, id:", activity._id)

        // ── Respond immediately ───────────────────────────────────────────
        res.json(activity)
        console.log("[ONE-TO-ONE] Response sent")

        // ── Fire-and-forget: Cloudinary upload + side-effects ─────────────
        uploadFiles(req.files).then(photoUrls => {
            if (photoUrls.length > 0) {
                Activity.findByIdAndUpdate(activity._id, { photos: photoUrls }).catch(e => console.error("[ONE-TO-ONE] Photo URL update error:", e.message))
            }
        }).catch(e => console.error("[ONE-TO-ONE] Cloudinary upload error:", e.message))

        LocationLog.create({ userId: req.user.id, location, activity: "MEETING", timestamp: new Date() })
            .catch(err => console.error("[ONE-TO-ONE] Location log error:", err.message))

        // Fetch officer name only for the admin message (non-blocking)
        User.findById(req.user.id).select('name phone').lean().then(officer => {
            AdminMessage.create({
                officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
                text: `One-to-one meeting with ${req.body.personName || 'participant'}${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
                location, distanceTravelled: 0, status: 'MEETING', meetingType: 'ONE_TO_ONE', timestamp: new Date()
            }).catch(err => console.error("[ONE-TO-ONE] Admin message error:", err.message))
        }).catch(err => console.error("[ONE-TO-ONE] Officer lookup error:", err.message))

    } catch (err) {
        console.error("[ONE-TO-ONE] Error in catch block:", err.message, err.stack)
        if (!res.headersSent) res.status(500).json({ error: "Failed to log meeting: " + err.message })
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

        // ── Critical path: save activity, respond immediately ─────────────
        const activity = await Activity.create(activityPayload)
        res.status(201).json(activity)

        // ── Fire-and-forget side-effects (non-blocking) ───────────────────
        if (activity.location?.lat) {
            LocationLog.create({ userId: req.user.id, location: activity.location, activity: 'MEETING' })
                .catch(e => console.error("Loc log error:", e.message))
        }

        Promise.all([
            Attendance.findOne({ userId: req.user.id, startTime: { $gte: (() => { const d = new Date(); d.setHours(0,0,0,0); return d })() } }).sort({ startTime: -1 }).select("totalDistance").lean(),
            User.findById(req.user.id).select('name phone').lean()
        ]).then(([att, officer]) => {
            const text = activity.type === 'ONE_TO_ONE'
                ? `One-to-one meeting with ${activity.personName || 'participant'}${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`
                : `Group meeting at ${activity.village || 'unknown'} with ${activity.attendeesCount || 0} attendees${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`
            AdminMessage.create({
                officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
                text, location: activity.location || { lat: 0, lng: 0, address: '' },
                distanceTravelled: att?.totalDistance || 0, status: 'MEETING', meetingType: activity.type, timestamp: new Date()
            }).catch(e => console.error("Admin message error:", e.message))
        }).catch(err => console.error('Failed to create admin message for JSON meeting:', err))

    } catch (err) {
        console.error('JSON meeting logging error:', err)
        if (!res.headersSent) res.status(500).json({ error: 'Failed to log meeting', details: err.message })
    }
}

/* ================= LOG MEETING (GROUP) ================= */
export async function logGroupMeeting(req, res) {
    console.log("[GROUP] Route hit")
    try {
        console.log("[GROUP] Auth passed, user:", req.user?.id, "role:", req.user?.role)
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        console.log("[GROUP] Upload middleware finished, files:", req.files?.length ?? 0)

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)
        const attendeesCount = parseInt(req.body.attendeesCount) || 0

        console.log("[GROUP] DB save starting...")
        const activity = await Activity.create({
            userId: req.user.id, type: "GROUP",
            village: req.body.village, district: req.body.district, state: req.body.state,
            attendeesCount, meetingType: req.body.meetingType,
            category: req.body.category || "FARMER", location, notes: req.body.notes, photos: []
        })
        console.log("[GROUP] DB saved, id:", activity._id)

        res.json(activity)
        console.log("[GROUP] Response sent")

        // ── Fire-and-forget ───────────────────────────────────────────────
        uploadFiles(req.files).then(photoUrls => {
            if (photoUrls.length > 0) {
                Activity.findByIdAndUpdate(activity._id, { photos: photoUrls }).catch(e => console.error("[GROUP] Photo URL update error:", e.message))
            }
        }).catch(e => console.error("[GROUP] Cloudinary upload error:", e.message))

        LocationLog.create({ userId: req.user.id, location, activity: "MEETING" })
            .catch(e => console.error("[GROUP] Location log error:", e.message))

        User.findById(req.user.id).select('name phone').lean().then(officer => {
            AdminMessage.create({
                officerId: req.user.id, officerName: officer?.name || 'Field Officer', officerPhone: officer?.phone || '',
                text: `Group meeting at ${req.body.village || 'unknown'} with ${attendeesCount} attendees${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
                location, distanceTravelled: 0, status: 'MEETING', meetingType: 'GROUP', timestamp: new Date()
            }).catch(e => console.error("[GROUP] Admin message error:", e.message))
        }).catch(e => console.error("[GROUP] Officer lookup error:", e.message))

    } catch (err) {
        console.error("[GROUP] Error in catch block:", err.message, err.stack)
        if (!res.headersSent) res.status(500).json({ error: "Failed to log group meeting: " + err.message })
    }
}

/* ================= DISTRIBUTE SAMPLE ================= */
export async function logSample(req, res) {
    console.log("[SAMPLE] Route hit")
    try {
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        console.log("[SAMPLE] files:", req.files?.length ?? 0, "body keys:", Object.keys(req.body || {}))

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        const sample = await Sample.create({
            userId: req.user.id,
            productName: req.body.productName,
            productSKU: req.body.productSKU,
            quantity: parseFloat(req.body.quantity) || 0,
            unit: req.body.unit,
            recipientName: req.body.recipientName,
            recipientContact: req.body.recipientContact,
            recipientCategory: req.body.recipientCategory,
            purpose: req.body.purpose,
            expectedFeedbackDate: req.body.expectedFeedbackDate || undefined,
            location,
            village: req.body.village,
            district: req.body.district,
            state: req.body.state,
            photos: [] // added async below
        })
        console.log("[SAMPLE] DB saved, id:", sample._id)

        res.json(sample)

        // ── Fire-and-forget ───────────────────────────────────────────────
        uploadFiles(req.files).then(photoUrls => {
            if (photoUrls.length > 0) {
                Sample.findByIdAndUpdate(sample._id, { photos: photoUrls }).catch(e => console.error("[SAMPLE] Photo URL update error:", e.message))
            }
        }).catch(e => console.error("[SAMPLE] Cloudinary upload error:", e.message))

        LocationLog.create({ userId: req.user.id, location, activity: "SAMPLE" })
            .catch(e => console.error("[SAMPLE] Location log error:", e.message))

    } catch (err) {
        console.error("[SAMPLE] Error in catch block:", err.message, err.stack)
        if (!res.headersSent) res.status(500).json({ error: "Failed to log sample distribution: " + err.message })
    }
}

/* ================= RECORD SALE ================= */
export async function logSale(req, res) {
    console.log("[SALE] Route hit")
    try {
        console.log("[SALE] Auth passed, user:", req.user?.id, "role:", req.user?.role)
        if (req.user.role !== "FIELD") return res.status(403).json({ error: "Only field officers allowed" })

        console.log("[SALE] Upload middleware finished, files:", req.files?.length ?? 0)

        const parseLoc = (loc) => { try { return typeof loc === 'string' ? JSON.parse(loc) : (typeof loc === 'object' && loc !== null ? loc : { lat: 0, lng: 0 }) } catch { return { lat: 0, lng: 0 } } }
        const location = parseLoc(req.body.location)

        const saleType = (req.body.saleType || '').toUpperCase()
        const quantity = parseFloat(req.body.quantity) || 0
        const pricePerUnit = parseFloat(req.body.pricePerUnit) || 0
        const totalAmount = parseFloat(req.body.totalAmount) || (quantity * pricePerUnit)
        const customerName = req.body.customerName || ''

        console.log("[SALE] saleType:", saleType, "qty:", quantity, "total:", totalAmount)

        console.log("[SALE] DB save starting...")
        const sale = await Sale.create({
            userId: req.user.id,
            productName: req.body.productName,
            productSKU: req.body.productSKU,
            packSize: req.body.packSize,
            quantity, pricePerUnit, totalAmount, saleType,
            farmerName:         saleType === 'B2C' ? customerName : undefined,
            farmerContact:      saleType === 'B2C' ? (req.body.customerContact || '') : undefined,
            distributorName:    saleType === 'B2B' ? customerName : undefined,
            distributorContact: saleType === 'B2B' ? (req.body.customerContact || '') : undefined,
            distributorType:    saleType === 'B2B' ? req.body.distributorType : undefined,
            paymentMode:        req.body.paymentMode || 'CASH',
            isRepeatOrder:      req.body.isRepeatOrder === 'true' || req.body.isRepeatOrder === true,
            village: req.body.village, district: req.body.district, state: req.body.state,
            location, photos: [], notes: req.body.notes
        })
        console.log("[SALE] DB saved, id:", sale._id)

        res.json(sale)
        console.log("[SALE] Response sent")

        // ── Fire-and-forget ───────────────────────────────────────────────
        uploadFiles(req.files).then(photoUrls => {
            if (photoUrls.length > 0) {
                Sale.findByIdAndUpdate(sale._id, { photos: photoUrls }).catch(e => console.error("[SALE] Photo URL update error:", e.message))
            }
        }).catch(e => console.error("[SALE] Cloudinary upload error:", e.message))

        if (sale.location?.lat) {
            LocationLog.create({ userId: req.user.id, location: sale.location, activity: 'SALE' })
                .catch(e => console.error("[SALE] Location log error:", e.message))
        }

        User.findById(req.user.id).select('name phone').lean().then(officer => {
            AdminMessage.create({
                officerId: req.user.id,
                officerName: officer?.name || 'Field Officer',
                officerPhone: officer?.phone || '',
                text: `New ${saleType} Sale: ${quantity}x ${req.body.productName} (₹${totalAmount}) to ${customerName}`,
                location, distanceTravelled: 0, status: 'SALE', timestamp: new Date()
            }).catch(e => console.error("[SALE] Admin message error:", e.message))
        }).catch(e => console.error("[SALE] Officer lookup error:", e.message))

        const today = new Date(); today.setHours(0, 0, 0, 0)
        AnalyticsSummary.findOneAndUpdate(
            { userId: req.user.id, date: today },
            { $inc: { salesCount: 1, totalSalesAmount: totalAmount, b2cSales: saleType === 'B2C' ? 1 : 0, b2bSales: saleType === 'B2B' ? 1 : 0 } },
            { upsert: true }
        ).catch(err => console.error("[SALE] Analytics update error:", err))

    } catch (err) {
        console.error("[SALE] Error in catch block:", err.message, err.stack)
        if (!res.headersSent) res.status(500).json({ error: "Failed to log sale: " + err.message })
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

        // Find active attendance session (if any)
        const attendance = await Attendance.findOne({ userId: req.user.id, endTime: null })

        // Create the new location log entry
        const locationLog = await LocationLog.create({
            userId: req.user.id,
            attendanceId: attendance?._id || null,
            location: { lat, lng, address: address || "" },
            accuracy: accuracy || 0,
            activity: activity || "TRAVEL"
        })

        // ── Distance accumulation ──────────────────────────────────────────
        // Scope the previous-point lookup to the CURRENT attendance session
        // so a GPS point from a prior session never bleeds into this one.
        if (attendance) {
            const lastLog = await LocationLog.findOne({
                userId: req.user.id,
                attendanceId: attendance._id,   // same session only
                _id: { $ne: locationLog._id }
            }).sort({ timestamp: -1 })

            if (lastLog?.location?.lat && lastLog?.location?.lng) {
                // calculateDistance now uses the Haversine formula in metres
                // internally, so sub-metre precision is preserved.
                const distKm = calculateDistance(
                    lastLog.location.lat, lastLog.location.lng,
                    lat, lng
                )

                // Threshold: 0.5 m (0.0005 km) minimum, 5 km maximum per update
                if (distKm > 0.0005 && distKm < 5) {
                    // 6 decimal places = 0.001 m precision before $inc
                    const increment = parseFloat(distKm.toFixed(6))

                    // Atomic $inc — never overwrites, safe under concurrent updates
                    const updated = await Attendance.findByIdAndUpdate(
                        attendance._id,
                        { $inc: { totalDistance: increment } },
                        { new: true }          // return the document AFTER update
                    ).select("totalDistance")

                    return res.json({
                        success: true,
                        locationId: locationLog._id,
                        totalDistance: parseFloat((updated?.totalDistance || 0).toFixed(6))
                    })
                }
            }
        }

        // No active attendance or movement below threshold — return current total
        res.json({
            success: true,
            locationId: locationLog._id,
            totalDistance: parseFloat((attendance?.totalDistance || 0).toFixed(6))
        })
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
