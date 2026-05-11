import {
    Attendance, Sale, User, LocationLog, LocationTrack,
    AdminMessage, DistributorInventory
} from "../models/index.js"
import { calculateDistance } from "../utils/distance.js"

/* ─────────────────────────────────────────────────────────────
   HELPER — role guard
───────────────────────────────────────────────────────────── */
function requireDistributor(req, res) {
    if (req.user.role !== "DISTRIBUTOR") {
        res.status(403).json({ error: "Only distributors allowed" })
        return false
    }
    return true
}

/* ================= DASHBOARD ================= */
export async function getDashboard(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const activeAttendance = await Attendance.findOne({ userId: req.user.id, endTime: null })
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const locationTrack = await LocationTrack.findOne({ userId: req.user.id, date: today })
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
            lastLocation: lastLocation
                ? { lat: lastLocation.lat, lng: lastLocation.lng, time: lastLocation.time }
                : null
        })
    } catch (err) {
        console.error("Distributor dashboard error:", err)
        res.status(500).json({ error: "Failed to fetch dashboard data" })
    }
}

/* ================= SUMMARY (today's stats) ================= */
export async function getSummary(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const today = new Date(); today.setHours(0, 0, 0, 0)

        const salesData = await Sale.aggregate([
            { $match: { userId: req.user.id, createdAt: { $gte: today } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }
        ])

        const attendances = await Attendance.find({ userId: req.user.id, startTime: { $gte: today } })
        const distanceTraveled = attendances.reduce((sum, a) => sum + (a.totalDistance || 0), 0)

        const inventory = await DistributorInventory.find({ distributorId: req.user.id })
        const totalStock = inventory.reduce((sum, i) => sum + (i.currentStock || 0), 0)

        res.json({
            today: {
                sales: salesData[0]?.count || 0,
                revenue: salesData[0]?.revenue || 0,
                distanceTraveled: parseFloat(distanceTraveled.toFixed(2)),
                totalStock
            }
        })
    } catch (err) {
        console.error("Distributor summary error:", err)
        res.status(500).json({ error: "Failed to fetch summary" })
    }
}

/* ================= START DAY (attendance) ================= */
export async function startAttendance(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const existing = await Attendance.findOne({ userId: req.user.id, endTime: null })
        if (existing) {
            return res.status(400).json({ error: "Day already started. Please end the current day first." })
        }

        const attendance = await Attendance.create({
            userId: req.user.id,
            startLocation: {
                lat: req.body.location?.lat || 0,
                lng: req.body.location?.lng || 0,
                address: req.body.location?.address || ""
            },
            startTime: new Date(),
            startOdometer: req.body.odometer || 0
        })

        res.json(attendance)
    } catch (err) {
        console.error("Distributor start day error:", err)
        res.status(500).json({ error: "Failed to start day" })
    }
}

/* ================= END DAY (attendance) ================= */
export async function endAttendance(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const attendance = await Attendance.findOne({ userId: req.user.id, endTime: null }).sort({ startTime: -1 })
        if (!attendance) return res.status(400).json({ error: "No active day found" })

        // 7-hour time-gate
        const MIN_HOURS = 7
        const elapsedMs = Date.now() - new Date(attendance.startTime).getTime()
        const elapsedHours = elapsedMs / (1000 * 60 * 60)
        if (elapsedHours < MIN_HOURS) {
            const remaining = Math.ceil((MIN_HOURS * 60) - (elapsedMs / (1000 * 60)))
            return res.status(400).json({
                error: `Day End is locked. You must work at least ${MIN_HOURS} hours. ${remaining} minute(s) remaining.`,
                code: "TIME_GATE",
                remainingMinutes: remaining
            })
        }

        const gpsDistance = attendance.totalDistance || 0
        const odometerDistance = req.body.odometer
            ? req.body.odometer - (attendance.startOdometer || 0)
            : null
        const finalDistance = gpsDistance > 0
            ? gpsDistance
            : (odometerDistance !== null && odometerDistance >= 0 ? odometerDistance : 0)

        attendance.endTime = new Date()
        attendance.endLocation = {
            lat: req.body.location?.lat || 0,
            lng: req.body.location?.lng || 0,
            address: req.body.location?.address || ""
        }
        attendance.endOdometer = req.body.odometer || 0
        attendance.totalDistance = parseFloat(finalDistance.toFixed(3))
        await attendance.save()

        res.json({
            message: "Day ended successfully",
            attendance,
            summary: {
                totalDistance: attendance.totalDistance,
                startTime: attendance.startTime,
                endTime: attendance.endTime,
                durationHours: parseFloat(elapsedHours.toFixed(2))
            }
        })
    } catch (err) {
        console.error("Distributor end day error:", err)
        res.status(500).json({ error: "Failed to end day" })
    }
}

/* ================= TRACK LOCATION ================= */
export async function trackLocation(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const { lat, lng, accuracy, address, activity } = req.body
        if (!lat || !lng) return res.status(400).json({ error: "Latitude and longitude required" })

        const attendance = await Attendance.findOne({ userId: req.user.id, endTime: null })

        const locationLog = await LocationLog.create({
            userId: req.user.id,
            attendanceId: attendance?._id || null,
            location: { lat, lng, address: address || "" },
            accuracy: accuracy || 0,
            activity: activity || "TRAVEL"
        })

        // ── Distance accumulation (additive, never overwrites) ────────────
        // Query by userId only (not attendanceId) so we always find the
        // previous point even at the start of a new session
        if (attendance) {
            const lastLog = await LocationLog.findOne({
                userId: req.user.id,
                _id: { $ne: locationLog._id }
            }).sort({ timestamp: -1 })

            if (lastLog?.location?.lat && lastLog?.location?.lng) {
                const distKm = calculateDistance(
                    lastLog.location.lat, lastLog.location.lng,
                    lat, lng
                )
                // Threshold: 0.5 m (0.0005 km) minimum, 5 km maximum per update
                if (distKm > 0.0005 && distKm < 5) {
                    // 6 decimal places = 0.001 m precision before $inc
                    const increment = parseFloat(distKm.toFixed(6))

                    // Atomic $inc with { new: true } — returns updated doc immediately
                    const updated = await Attendance.findByIdAndUpdate(
                        attendance._id,
                        { $inc: { totalDistance: increment } },
                        { new: true }
                    ).select("totalDistance")

                    // Update LocationTrack path
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    let track = await LocationTrack.findOne({ userId: req.user.id, date: today })
                    if (!track) track = await LocationTrack.create({ userId: req.user.id, date: today, path: [] })
                    track.path.push({ lat, lng, time: new Date() })
                    await track.save()

                    return res.json({
                        success: true,
                        totalDistance: parseFloat((updated?.totalDistance || 0).toFixed(6))
                    })
                }
            }
        }

        // Update LocationTrack path regardless of distance threshold
        const today = new Date(); today.setHours(0, 0, 0, 0)
        let track = await LocationTrack.findOne({ userId: req.user.id, date: today })
        if (!track) track = await LocationTrack.create({ userId: req.user.id, date: today, path: [] })
        track.path.push({ lat, lng, time: new Date() })
        await track.save()

        res.json({
            success: true,
            totalDistance: parseFloat((attendance?.totalDistance || 0).toFixed(6))
        })
    } catch (err) {
        console.error("Distributor track location error:", err)
        res.status(500).json({ error: "Failed to track location" })
    }
}

/* ================= LOG SALE ================= */
export async function logSale(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const {
            productName, productSKU, packSize, quantity, pricePerUnit,
            saleType, farmerName, farmerContact,
            distributorName, distributorContact, distributorType,
            paymentMode, paymentStatus, village, district, state, notes
        } = req.body

        if (!productName || !quantity || !saleType) {
            return res.status(400).json({ error: "productName, quantity, and saleType are required" })
        }

        const totalAmount = (parseFloat(pricePerUnit) || 0) * (parseFloat(quantity) || 0)

        const sale = await Sale.create({
            userId: req.user.id,
            productName, productSKU, packSize,
            quantity: parseFloat(quantity),
            pricePerUnit: parseFloat(pricePerUnit) || 0,
            totalAmount,
            saleType,
            farmerName, farmerContact,
            distributorName, distributorContact, distributorType,
            paymentMode: paymentMode || "CASH",
            paymentStatus: paymentStatus || "PAID",
            village, district, state, notes
        })

        // Update distributor inventory — reduce currentStock
        if (productName) {
            const inv = await DistributorInventory.findOne({
                distributorId: req.user.id,
                productName
            })
            if (inv) {
                inv.quantityDistributed = (inv.quantityDistributed || 0) + parseFloat(quantity)
                inv.currentStock = Math.max(0, (inv.currentStock || 0) - parseFloat(quantity))
                inv.lastUpdated = new Date()
                await inv.save()
            }
        }

        // Notify admin
        const distributor = await User.findById(req.user.id).select("name phone")
        AdminMessage.create({
            officerId: req.user.id,
            officerName: distributor?.name || "Distributor",
            officerPhone: distributor?.phone || "",
            text: `${saleType} sale: ${quantity} × ${productName} (₹${totalAmount.toLocaleString()}) — ${village || ""}`,
            status: "SALE",
            meetingType: saleType,
            timestamp: new Date()
        }).catch(e => console.error("AdminMessage error:", e.message))

        res.json(sale)
    } catch (err) {
        console.error("Distributor log sale error:", err)
        res.status(500).json({ error: "Failed to log sale: " + err.message })
    }
}

/* ================= INVENTORY — GET ================= */
export async function getInventory(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const inventory = await DistributorInventory.find({ distributorId: req.user.id })
            .sort({ lastUpdated: -1 })

        res.json(inventory)
    } catch (err) {
        console.error("Get inventory error:", err)
        res.status(500).json({ error: "Failed to fetch inventory" })
    }
}

/* ================= INVENTORY — ADD / UPDATE STOCK RECEIVED ================= */
export async function updateInventory(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const { productName, productSKU, packSize, quantityReceived, pricePerUnit, notes } = req.body

        if (!productName || !quantityReceived) {
            return res.status(400).json({ error: "productName and quantityReceived are required" })
        }

        const qty = parseFloat(quantityReceived)

        let inv = await DistributorInventory.findOne({
            distributorId: req.user.id,
            productName
        })

        if (inv) {
            inv.quantityReceived = (inv.quantityReceived || 0) + qty
            inv.currentStock = (inv.currentStock || 0) + qty
            if (productSKU) inv.productSKU = productSKU
            if (packSize) inv.packSize = packSize
            if (pricePerUnit) inv.pricePerUnit = parseFloat(pricePerUnit)
            if (notes) inv.notes = notes
            inv.lastUpdated = new Date()
            await inv.save()
        } else {
            inv = await DistributorInventory.create({
                distributorId: req.user.id,
                productName,
                productSKU: productSKU || "",
                packSize: packSize || "",
                quantityReceived: qty,
                quantityDistributed: 0,
                currentStock: qty,
                pricePerUnit: parseFloat(pricePerUnit) || 0,
                notes: notes || "",
                lastUpdated: new Date()
            })
        }

        res.json(inv)
    } catch (err) {
        console.error("Update inventory error:", err)
        res.status(500).json({ error: "Failed to update inventory: " + err.message })
    }
}

/* ================= SALES HISTORY ================= */
export async function getSalesHistory(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const sales = await Sale.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(100)

        res.json(sales)
    } catch (err) {
        console.error("Sales history error:", err)
        res.status(500).json({ error: "Failed to fetch sales history" })
    }
}

/* ================= ATTENDANCE HISTORY ================= */
export async function getAttendanceHistory(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        const records = await Attendance.find({ userId: req.user.id })
            .sort({ startTime: -1 })
            .limit(30)

        res.json(records)
    } catch (err) {
        console.error("Attendance history error:", err)
        res.status(500).json({ error: "Failed to fetch attendance history" })
    }
}

/* ================= INVENTORY HISTORY (per product, with daily breakdown) ================= */
export async function getInventoryHistory(req, res) {
    try {
        if (!requireDistributor(req, res)) return

        // All inventory records for this distributor
        const inventory = await DistributorInventory.find({ distributorId: req.user.id })
            .sort({ lastUpdated: -1 })
            .lean()

        // All sales — to compute per-product sold quantities
        const sales = await Sale.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .lean()

        // Build per-product summary: received, sold, remaining
        const result = inventory.map(item => {
            const productSales = sales.filter(s => s.productName === item.productName)
            const totalSold = productSales.reduce((sum, s) => sum + (s.quantity || 0), 0)
            const remaining = Math.max(0, (item.quantityReceived || 0) - totalSold)

            return {
                _id:               item._id,
                productName:       item.productName,
                productSKU:        item.productSKU,
                packSize:          item.packSize,
                quantityReceived:  item.quantityReceived || 0,
                quantityDistributed: totalSold,
                currentStock:      remaining,
                pricePerUnit:      item.pricePerUnit || 0,
                lastUpdated:       item.lastUpdated,
                // Daily sales breakdown for this product
                salesHistory: productSales.map(s => ({
                    date:     s.createdAt,
                    quantity: s.quantity,
                    amount:   s.totalAmount,
                    saleType: s.saleType
                }))
            }
        })

        res.json(result)
    } catch (err) {
        console.error("Inventory history error:", err)
        res.status(500).json({ error: "Failed to fetch inventory history" })
    }
}
