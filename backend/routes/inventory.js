import express from "express"
import auth from "../middleware/auth.js"
import {
    seedProducts, getProducts, getOrders, placeOrder, adminDashboard
} from "../controllers/inventoryController.js"

const router = express.Router()

router.post("/seed", seedProducts)
router.get("/", getProducts)
router.get("/orders", auth, getOrders)
router.post("/order", auth, placeOrder)
router.get("/dashboard", auth, adminDashboard)

export default router
