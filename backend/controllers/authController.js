import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User } from "../models/index.js"

/* ================= SIGNUP ================= */
export async function signup(req, res) {
    try {
        const { name, phone, email, password, role } = req.body

        if (!name || !phone || !email || !password) {
            return res.status(400).json({ error: "All fields are required" })
        }

        const cleanPhone = phone.trim()
        const cleanEmail = email.trim().toLowerCase()

        const existing = await User.findOne({
            $or: [{ phone: cleanPhone }, { email: cleanEmail }]
        })

        if (existing) {
            return res.status(400).json({ error: "User with this email or phone already exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await User.create({
            name: name.trim(),
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            role: (role || "USER").toUpperCase()
        })

        res.status(201).json({ message: "Signup successful" })
    } catch (err) {
        console.error("Signup error details:", err)
        res.status(500).json({ error: "Signup failed due to server error" })
    }
}

/* ================= LOGIN ================= */
export async function login(req, res) {
    try {
        const { identifier, password } = req.body

        if (!identifier || !password) {
            return res.status(400).json({ error: "Email/phone and password are required" })
        }

        const cleanIdentifier = identifier.trim()

        // Always search both fields — user can type either email or phone number
        const user = await User.findOne({
            $or: [
                { email: cleanIdentifier.toLowerCase() },
                { phone: cleanIdentifier }
            ]
        })

        if (!user) {
            return res.status(401).json({ error: "Invalid email/phone or password" })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email/phone or password" })
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        )

        res.json({
            token,
            role: user.role,
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
        })
    } catch (err) {
        console.error("Login error details:", err)
        res.status(500).json({ error: "Internal server error" })
    }
}

/* ================= FORGOT PASSWORD ================= */
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body

        if (!email) return res.status(400).json({ error: "Email is required" })

        const user = await User.findOne({ email: email.toLowerCase().trim() })
        if (!user) return res.status(404).json({ error: "User not found" })

        const resetToken = Math.random().toString(36).substring(7)

        console.log(`\n==========================================`)
        console.log(`🔐 PASSWORD RESET REQUEST`)
        console.log(`👤 User: ${user.email}`)
        console.log(`🎫 Token: ${resetToken}`)
        console.log(`🔗 Link: http://localhost:5173/reset-password?token=${resetToken}`)
        console.log(`==========================================\n`)

        res.json({ message: "Password reset link sent to email (Check Server Console)" })
    } catch (err) {
        console.error("Forgot password error:", err)
        res.status(500).json({ error: "Failed to process request" })
    }
}

/* ================= MOCK SOCIAL LOGIN ================= */
export async function mockSocialLogin(req, res) {
    try {
        const { provider, email } = req.body

        const mockEmail = email || `mock_${provider.toLowerCase()}@example.com`
        const mockName = `${provider} User`

        let user = await User.findOne({ email: mockEmail })

        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-8)
            const hashedPassword = await bcrypt.hash(randomPassword, 10)

            user = await User.create({
                name: mockName,
                email: mockEmail,
                password: hashedPassword,
                phone: "0000000000",
                role: "USER"
            })
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        )

        res.json({
            token,
            role: user.role,
            user: { id: user._id, name: user.name, email: user.email }
        })
    } catch (err) {
        console.error("Mock Social Login Error:", err)
        res.status(500).json({ error: "Failed to perform mock login" })
    }
}

/* ================= RESET PASSWORD ================= */
export async function resetPassword(req, res) {
    try {
        const { email, token, newPassword } = req.body

        if (!email || !token || !newPassword) {
            return res.status(400).json({ error: "All fields are required" })
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() })
        if (!user) return res.status(404).json({ error: "User not found" })

        user.password = await bcrypt.hash(newPassword, 10)
        await user.save()

        res.json({ message: "Password reset successful! Please login." })
    } catch (err) {
        console.error("Reset password error:", err)
        res.status(500).json({ error: "Failed to reset password" })
    }
}
