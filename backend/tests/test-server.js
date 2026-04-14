import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { connectDB } from "../models/index.js"
import inventoryRoutes from "../routes/inventory.js"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

console.log("Connecting to MongoDB...")
await connectDB()
console.log("MongoDB connected!")

app.use("/inventory", inventoryRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err)
    res.status(500).json({ error: err.message })
})

// Create server and keep it alive
const server = app.listen(5000, () => {
    console.log("Server listening on port 5000")
})

// Keep process alive
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason)
})
