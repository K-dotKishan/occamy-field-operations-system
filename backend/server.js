import 'dotenv/config'
import express from "express"
import cors from "cors"
import http from "http"
import { Server } from "socket.io"

import { connectDB } from "./models/index.js"
import { Location, AdminMessage } from "./models/index.js"   // 🔥 Needed for tracking DB
import { geoFenceCheck } from "./geoFence.js" // 🔥 Create file if not yet

console.log("1. Importing routes...")
import authRoutes from "./routes/auth.js"
console.log("2. Auth routes imported")
import adminRoutes from "./routes/admin.js"
console.log("3. Admin routes imported")
import fieldRoutes from "./routes/field.js"
console.log("4. Field routes imported")
import inventoryRoutes from "./routes/inventory.js"
console.log("5. Inventory routes imported")
import distributorRoutes from "./routes/distributor.js"
console.log("6. Distributor routes imported")

const app = express()

/* ================= BASIC MIDDLEWARE ================= */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ================= ROUTES ================= */
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/field", fieldRoutes)
app.use("/inventory", inventoryRoutes)
app.use("/distributor", distributorRoutes)

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Error:", err)
  res.status(500).json({ error: err.message })
})

/* ================= HTTP SERVER ================= */
const httpServer = http.createServer(app)

/* ================= SOCKET SERVER ================= */
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

/* ================= SOCKET CONNECTION ================= */
/*
io.on("connection", socket => {

  console.log("🟢 Socket Connected:", socket.id)

  // Listen for location updates from clients
  socket.on("location-update", (data) => {
    // console.log("📍 Location Update:", data.userId, data.lat, data.lng)
    
    // Broadcast to admins
    io.emit("officer-location-update", data)

    // Check Geofence
    try {
      geoFenceCheck(data)
    } catch (err) {
      console.error("Geofence Check Error:", err)
    }
  })

  // Listen for new admin messages (optional, if sent via socket)
  socket.on("send-admin-message", async (data) => {
    try {
      const message = await AdminMessage.create({
        officerId: data.officerId,
        officerName: data.officerName,
        officerPhone: data.officerPhone,
        text: data.text,
        location: data.location,
        distanceTravelled: data.distanceTravelled,
        status: data.status || "UPDATE",
        meetingType: data.meetingType
      })

      // Broadcast to all admins
      io.emit("admin-message-update", message)

    } catch (err) {
      console.error("Message Save Error:", err.message)
    }

  })

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected:", socket.id)
  })

})
*/

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

/* ================= MONGODB ================= */
connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.warn("⚠ MongoDB connection failed:", err.message)
  })

/* ================= GLOBAL ERROR SAFETY ================= */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason)
})


