import express from "express"
import { signup, login, forgotPassword, mockSocialLogin, resetPassword } from "../controllers/authController.js"

const router = express.Router()

router.post("/signup", signup)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.post("/mock-social-login", mockSocialLogin)
router.post("/reset-password", resetPassword)

export default router
