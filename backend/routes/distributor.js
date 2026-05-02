import express from "express"
import auth from "../middleware/auth.js"
import {
    getDashboard, getSummary,
    startAttendance, endAttendance, trackLocation,
    logSale, getInventory, updateInventory,
    getSalesHistory, getAttendanceHistory
} from "../controllers/distributorController.js"

const router = express.Router()

router.use((req, res, next) => { console.log(`[Distributor] ${req.method} ${req.url}`); next() })

router.get("/dashboard",          auth, getDashboard)
router.get("/summary",            auth, getSummary)
router.post("/attendance/start",  auth, startAttendance)
router.post("/attendance/end",    auth, endAttendance)
router.post("/location/track",    auth, trackLocation)
router.post("/sale",              auth, logSale)
router.get("/inventory",          auth, getInventory)
router.post("/inventory",         auth, updateInventory)
router.get("/sales",              auth, getSalesHistory)
router.get("/attendance",         auth, getAttendanceHistory)

export default router
