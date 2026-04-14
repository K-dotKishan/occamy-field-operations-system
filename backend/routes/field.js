import express from "express"
import auth from "../middleware/auth.js"
import { upload } from "../middleware/upload.js"
import {
    uploadPhoto, getSummary, getDashboard, logLocation,
    startAttendance, endAttendance,
    logOneToOneMeeting, logMeeting, logGroupMeeting,
    logSample, logSale, updateSampleFeedback,
    trackLocation, getCurrentLocation, getLocationHistory
} from "../controllers/fieldController.js"

const router = express.Router()

router.use((req, res, next) => { console.log(`[Field] ${req.method} ${req.url}`); next() })

router.post("/upload-photo", upload.single("photo"), uploadPhoto)
router.get("/summary", auth, getSummary)
router.get("/dashboard", auth, getDashboard)
router.post("/location", logLocation)
router.post("/attendance/start", auth, startAttendance)
router.post("/attendance/end", auth, endAttendance)
router.post("/meeting/one-to-one", auth, upload.array("photos", 10), logOneToOneMeeting)
router.post("/meeting", auth, logMeeting)
router.post("/meeting/group", auth, upload.array("photos", 10), logGroupMeeting)
router.post("/sample", auth, upload.array("photos", 10), logSample)
router.post("/sale", auth, upload.array("photos", 10), logSale)
router.patch("/sample/:id/feedback", auth, updateSampleFeedback)
router.post("/location/track", auth, trackLocation)
router.get("/location/current", auth, getCurrentLocation)
router.get("/location/history", auth, getLocationHistory)

export default router
