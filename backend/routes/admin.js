import express from "express"
import auth from "../middleware/auth.js"
import {
    getDashboard, getOfficerAnalytics, getGeographyAnalytics, getMonthlyReport,
    getMapActivities, getMeetingDetail, getSaleDetail, createUser, updateUser,
    getLiveLocations, getLocationHistory, getOfficerTracking,
    getMessages, createMessage, getFieldOfficers
} from "../controllers/adminController.js"

const router = express.Router()

router.get("/dashboard", auth, getDashboard)
router.get("/analytics/officers", auth, getOfficerAnalytics)
router.get("/analytics/geography", auth, getGeographyAnalytics)
router.get("/analytics/monthly", auth, getMonthlyReport)
router.get("/map/activities", auth, getMapActivities)
router.get("/meeting/:id", auth, getMeetingDetail)
router.get("/sale/:id", auth, getSaleDetail)
router.post("/user/create", auth, createUser)
router.patch("/user/:id", auth, updateUser)
router.get("/tracking/live-locations", auth, getLiveLocations)
router.get("/tracking/location-history/:userId", auth, getLocationHistory)
router.get("/tracking/officer/:userId", auth, getOfficerTracking)
router.get("/messages", auth, getMessages)
router.post("/messages", auth, createMessage)
router.get("/field-officers", auth, getFieldOfficers)

export default router
