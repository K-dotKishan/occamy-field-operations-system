import { Attendance, Activity, Sale, Sample, User, Product } from "../models/index.js"

/* ================= SEED PRODUCTS ================= */
export async function seedProducts(req, res) {
    try {
        const existingProducts = await Product.find()
        if (existingProducts.length > 0) {
            return res.json({ message: "Products already exist", count: existingProducts.length })
        }

        const sampleProducts = [
            {
                name: "Cattle Feed Pro", sku: "CFP-001", category: "Animal Feed",
                description: "Premium cattle feed with essential nutrients", unit: "kg",
                packSizes: [{ size: "1kg", price: 120, stock: 100 }, { size: "5kg", price: 550, stock: 50 }, { size: "10kg", price: 1000, stock: 30 }]
            },
            {
                name: "NPK Fertilizer", sku: "NPK-10-10-10", category: "Fertilizer",
                description: "Balanced NPK fertilizer for general crops", unit: "kg",
                packSizes: [{ size: "2kg", price: 250, stock: 200 }, { size: "10kg", price: 1000, stock: 100 }]
            },
            {
                name: "Organic Pesticide", sku: "PEST-ORG-500", category: "Pesticide",
                description: "Natural organic pesticide safe for crops", unit: "litre",
                packSizes: [{ size: "500ml", price: 200, stock: 150 }, { size: "1L", price: 350, stock: 100 }]
            },
            {
                name: "Urea Fertilizer", sku: "UREA-46", category: "Fertilizer",
                description: "High nitrogen content fertilizer", unit: "kg",
                packSizes: [{ size: "1kg", price: 25, stock: 500 }, { size: "5kg", price: 120, stock: 200 }]
            }
        ]

        await Product.insertMany(sampleProducts)
        res.json({ message: "Products seeded successfully", count: sampleProducts.length })
    } catch (err) {
        console.error("Seed error:", err)
        res.status(500).json({ error: "Failed to seed products: " + err.message })
    }
}

/* ================= GET ALL PRODUCTS ================= */
export async function getProducts(req, res) {
    try {
        const products = await Product.find()
        const transformedProducts = []

        products.forEach(product => {
            if (product.packSizes && Array.isArray(product.packSizes) && product.packSizes.length > 0) {
                product.packSizes.forEach(packSize => {
                    transformedProducts.push({
                        _id: product._id, name: product.name, sku: product.sku,
                        category: product.category, description: product.description,
                        unit: product.unit, packSize: packSize.size, price: packSize.price,
                        quantity: packSize.stock, imageUrl: product.imageUrl
                    })
                })
            } else {
                transformedProducts.push({
                    _id: product._id, name: product.name, sku: product.sku,
                    category: product.category, description: product.description,
                    unit: product.unit || 'unit', packSize: product.packSize || null,
                    price: product.price || 0,
                    quantity: product.stock || product.quantity || 0,
                    imageUrl: product.imageUrl
                })
            }
        })

        res.json(transformedProducts)
    } catch (err) {
        console.error("Get products error:", err.message)
        res.status(500).json({ error: err.message })
    }
}

/* ================= GET USER'S ORDERS ================= */
export async function getOrders(req, res) {
    try {
        const orders = await Sale.find({ userId: req.user.id }).sort({ createdAt: -1 })
        res.json(orders || [])
    } catch (err) {
        console.error("Get orders error:", err)
        res.status(500).json({ error: "Failed to fetch orders" })
    }
}

/* ================= PLACE ORDER ================= */
export async function placeOrder(req, res) {
    try {
        const { productId, quantity, deliveryAddress, phoneNumber } = req.body

        if (!productId || !quantity || !deliveryAddress) {
            return res.status(400).json({ error: "Missing required fields: productId, quantity, deliveryAddress" })
        }

        const product = await Product.findById(productId)
        if (!product) return res.status(404).json({ error: "Product not found" })

        const packSize = product.packSizes[0]
        if (!packSize) return res.status(400).json({ error: "Product has no pack sizes" })

        const totalAmount = packSize.price * quantity

        const sale = await Sale.create({
            userId: req.user.id,
            productName: product.name, productSKU: product.sku,
            packSize: packSize.size, quantity: parseInt(quantity),
            pricePerUnit: packSize.price, totalAmount,
            saleType: "B2C", farmerName: req.user.name, farmerContact: phoneNumber,
            location: { address: deliveryAddress },
            village: "N/A", district: "N/A", state: "N/A",
            paymentMode: "CASH", paymentStatus: "PENDING", deliveryStatus: "IMMEDIATE"
        })

        res.json({ success: true, sale })
    } catch (err) {
        console.error("Place order error:", err.message)
        res.status(500).json({ error: "Failed to place order: " + err.message })
    }
}

/* ================= ADMIN DASHBOARD (inventory view) ================= */
export async function adminDashboard(req, res) {
    try {
        if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })

        const attendance = await Attendance.find().populate("userId", "name role email").sort({ startTime: -1 }).limit(20)
        const meetings = await Activity.find().populate("userId", "name role email").sort({ createdAt: -1 }).limit(20)
        const users = await User.find().select("-password")
        const sales = await Sale.find().populate("userId", "name role email").sort({ createdAt: -1 })
        const samples = await Sample.find()

        const salesByMode = await Sale.aggregate([
            { $group: { _id: "$saleType", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } }
        ])

        const salesChart = salesByMode.map(item => ({
            type: item._id || "Unknown", count: item.count, amount: item.totalAmount || 0
        }))

        const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0)

        res.json({
            stats: {
                totalUsers: users.length, totalMeetings: meetings.length,
                totalSales: sales.length, totalSamples: samples.length, totalRevenue
            },
            attendance, meetings, users, sales, salesChart
        })
    } catch (err) {
        console.error("Admin dashboard error:", err)
        res.status(500).json({ error: "Failed to fetch dashboard data" })
    }
}
