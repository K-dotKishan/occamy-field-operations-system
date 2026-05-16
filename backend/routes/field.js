import express from "express"
import auth from "../middleware/auth.js"
import { uploadSingleToCloudinary, uploadFormFiles } from "../middleware/upload.js"
import {
    uploadPhoto, getSummary, getDashboard, logLocation,
    startAttendance, endAttendance,
    logOneToOneMeeting, logMeeting, logGroupMeeting,
    logSample, logSale, updateSampleFeedback,
    trackLocation, getCurrentLocation, getLocationHistory
} from "../controllers/fieldController.js"

const router = express.Router()

router.use((req, res, next) => {
    console.log(`[Field] ${req.method} ${req.url}`)
    next()
})

// ── Single-file direct-to-Cloudinary upload ───────────────────────────────────
router.post("/upload-photo",        auth, uploadSingleToCloudinary, uploadPhoto)

// ── Read-only / JSON-body routes (no file upload) ─────────────────────────────
router.get("/summary",              auth, getSummary)
router.get("/dashboard",            auth, getDashboard)
router.post("/location",                  logLocation)
router.post("/attendance/start",    auth, startAttendance)
router.post("/attendance/end",      auth, endAttendance)
router.post("/meeting",             auth, logMeeting)          // JSON body, no files
router.patch("/sample/:id/feedback",auth, updateSampleFeedback)
router.post("/location/track",      auth, trackLocation)
router.get("/location/current",     auth, getCurrentLocation)
router.get("/location/history",     auth, getLocationHistory)

// ── FormData routes (text fields + optional photo buffers) ────────────────────
// Diagnostic wrapper: logs before and after uploadFormFiles so we can see
// exactly whether multer is hanging or calling next() correctly.
function diagUpload(req, res, next) {
    console.log(`[DIAG] Before uploadFormFiles — Content-Type: ${req.headers['content-type']}`)
    uploadFormFiles(req, res, (err) => {
        if (err) {
            console.error('[DIAG] uploadFormFiles ERROR:', err.message, err.code)
            return res.status(400).json({ error: 'Upload error: ' + err.message })
        }
        console.log(`[DIAG] After uploadFormFiles — body keys: ${Object.keys(req.body || {}).join(', ')} | files: ${req.files?.length ?? 0}`)
        next()
    })
}

router.post("/meeting/one-to-one",  auth, diagUpload, logOneToOneMeeting)
router.post("/meeting/group",       auth, diagUpload, logGroupMeeting)
router.post("/sample",              auth, diagUpload, logSample)
router.post("/sale",                auth, diagUpload, logSale)

export default router
