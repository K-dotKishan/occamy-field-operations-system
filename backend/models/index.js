import mongoose from "mongoose"



/* ================= LOCATION TRACK ================= */

const LocationTrackSchema = new mongoose.Schema({

    userId: mongoose.Schema.Types.ObjectId,

    date: {
        type: Date,
        default: () => new Date().setHours(0, 0, 0, 0)
    },


    path: [
        {
            lat: Number,
            lng: Number,
            time: Date
        }
    ]

})

export const LocationTrack = mongoose.model("LocationTrack", LocationTrackSchema)



/* ================== MONGODB CONNECTION ================== */
export async function connectDB() {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/occamy"
    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000
    })
    console.log("MongoDB connected to", uri)
}



const LocationSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    lat: Number,
    lng: Number,
    time: Date
})

export const Location = mongoose.model("Location", LocationSchema)


/* ================= USER ================= */
const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ["ADMIN", "FIELD", "USER", "DISTRIBUTOR"],
            default: "FIELD"
        },
        state: String,
        district: String,
        assignedRegions: [String], // Villages/regions assigned to field officer
        enterpriseName: String     // Business/enterprise name for distributors
    },
    { timestamps: true }
)

export const User = mongoose.model("User", userSchema)

/* ================= ATTENDANCE ================= */
export const Attendance = mongoose.model(
    "Attendance",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            startLocation: {
                lat: Number,
                lng: Number,
                address: String
            },
            endLocation: {
                lat: Number,
                lng: Number,
                address: String
            },
            startTime: { type: Date, default: Date.now },
            endTime: Date,
            startOdometer: Number, // NEW: Starting odometer reading
            endOdometer: Number,   // NEW: Ending odometer reading
            totalDistance: Number, // Calculated from odometer
            villages: [String],    // Villages visited during the day
            photos: [String]       // Photo URLs from the day
        },
        { timestamps: true }
    )
)

/* ================= ACTIVITY (MEETINGS) ================= */
export const Activity = mongoose.model(
    "Activity",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            type: { type: String, enum: ["ONE_TO_ONE", "GROUP"] },

            // Person details (for ONE_TO_ONE)
            personName: String,
            contactNumber: String,
            category: { type: String, enum: ["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN", "DAIRY_COLLECTION_CENTER", "RETAIL_OUTLET", "KVK", "FPO", "DISTRIBUTOR", "DEALER"] },

            // Business potential
            businessPotential: {
                estimatedVolume: Number, // in kg
                estimatedFrequency: String, // monthly, quarterly, etc.
                likelihood: { type: String, enum: ["LOW", "MEDIUM", "HIGH"] }
            },

            // Group meeting details
            village: String,
            district: String,
            state: String,
            attendeesCount: Number,
            meetingType: String, // demo, training, feedback, etc.

            // Category-specific details
            landSize: String,       // For Farmer
            cropType: String,       // For Farmer
            shopName: String,       // For Seller/Dealer
            monthlyTurnover: String,// For Seller/Dealer
            socialHandle: String,   // For Influencer
            followerCount: String,  // For Influencer
            agencyName: String,     // For Distributor
            territory: String,      // For Distributor

            // Sample tracking (replaces landSize/cropType for new categories)
            productSampleAvailable: { type: Boolean, default: false },
            productSampleGiven:     { type: Boolean, default: false },
            entityName:             String,  // Name of Dairy Center / Retail Outlet / KVK / FPO

            // Location & media
            location: { lat: Number, lng: Number, address: String },
            photos: [String], // Photo URLs
            notes: String,

            // Follow-up tracking
            followUpRequired: { type: Boolean, default: false },
            followUpDate: Date,
            status: { type: String, enum: ["COMPLETED", "PENDING_FOLLOWUP", "CONVERTED"], default: "COMPLETED" }
        },
        { timestamps: true }
    )
)

/* ================= SAMPLE DISTRIBUTION ================= */
export const Sample = mongoose.model(
    "Sample",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            productName: String,
            productSKU: String,
            quantity: Number,
            unit: String, // kg, litre, packet

            // Recipient details
            recipientName: String,
            recipientContact: String,
            recipientCategory: { type: String, enum: ["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN"] },

            // Distribution details
            purpose: { type: String, enum: ["TRIAL", "DEMO", "TRAINING", "FOLLOWUP"] },
            expectedFeedbackDate: Date,

            // Location
            location: { lat: Number, lng: Number, address: String },
            village: String,
            district: String,
            state: String,

            // Tracking
            feedbackReceived: { type: Boolean, default: false },
            feedbackNotes: String,
            convertedToSale: { type: Boolean, default: false },
            photos: [String]
        },
        { timestamps: true }
    )
)

/* ================= SALES ================= */
export const Sale = mongoose.model(
    "Sale",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

            // Product details
            productName: String,
            productSKU: String,
            packSize: String, // "1kg", "5kg", "500ml", etc.
            quantity: Number,  // Number of packs
            pricePerUnit: Number,
            totalAmount: Number,

            // Sale type
            saleType: { type: String, enum: ["B2C", "B2B"], required: true },

            // B2C details (direct farmer)
            farmerName: String,
            farmerContact: String,

            // B2B details (distributor/reseller)
            distributorName: String,
            distributorContact: String,
            distributorType: String, // retailer, wholesaler, etc.

            // Order tracking
            isRepeatOrder: { type: Boolean, default: false },
            previousOrderDate: Date,
            paymentMode: { type: String, enum: ["CASH", "UPI", "CREDIT", "BANK_TRANSFER"] },
            paymentStatus: { type: String, enum: ["PAID", "PENDING", "PARTIAL"], default: "PAID" },

            // Location
            location: { lat: Number, lng: Number, address: String },
            village: String,
            district: String,
            state: String,

            // Delivery
            deliveryStatus: { type: String, enum: ["IMMEDIATE", "SCHEDULED", "DELIVERED"], default: "IMMEDIATE" },
            deliveryDate: Date,

            photos: [String],
            notes: String
        },
        { timestamps: true }
    )
)

/* ================= PRODUCT ================= */
export const Product = mongoose.model(
    "Product",
    new mongoose.Schema(
        {
            name: { type: String, required: true },
            sku: { type: String, required: true, unique: true },
            category: String,
            description: String,
            packSizes: [{ // Multiple pack sizes per product
                size: String, // "1kg", "5kg", etc.
                price: Number,
                stock: Number
            }],
            unit: { type: String, default: "kg" },
            imageUrl: String,
            isActive: { type: Boolean, default: true }
        },
        { timestamps: true }
    )
)

/* ================= ORDER (for e-commerce) ================= */
export const Order = mongoose.model(
    "Order",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            productName: String,
            productSKU: String,
            packSize: String,
            quantity: Number,
            pricePerUnit: Number,
            totalAmount: Number,
            status: {
                type: String,
                enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
                default: "PENDING"
            },
            deliveryAddress: String,
            phoneNumber: String,
            paymentMode: String,
            paymentStatus: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" }
        },
        { timestamps: true }
    )
)

/* ================= LOCATION LOG (for tracking) ================= */
export const LocationLog = mongoose.model(
    "LocationLog",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance" },
            location: { lat: Number, lng: Number, address: String },
            accuracy: Number, // in meters
            timestamp: { type: Date, default: Date.now },
            activity: String // "MEETING", "TRAVEL", "SAMPLE", "SALE"
        },
        { timestamps: true }
    )
)

/* ================= ANALYTICS SUMMARY (for faster queries) ================= */
export const AnalyticsSummary = mongoose.model(
    "AnalyticsSummary",
    new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            date: { type: Date, required: true },

            // Daily metrics
            distanceTraveled: Number,
            meetingsCount: Number,
            samplesDistributed: Number,
            salesCount: Number,
            totalSalesAmount: Number,

            // Breakdown
            oneToOneMeetings: Number,
            groupMeetings: Number,
            b2cSales: Number,
            b2bSales: Number,

            // Contacts
            farmersContacted: Number,
            farmersConverted: Number,

            // Geography
            villagesVisited: [String],
            district: String,
            state: String
        },
        { timestamps: true }
    )
)

/* ================= ADMIN MESSAGES ================= */
export const AdminMessage = mongoose.model(
    "AdminMessage",
    new mongoose.Schema(
        {
            officerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            officerName: String,
            officerPhone: String,
            text: { type: String, required: true },
            location: {
                lat: Number,
                lng: Number,
                address: String
            },
            distanceTravelled: Number, // Distance travelled by officer in km
            status: { type: String, enum: ["UPDATE", "ALERT", "LOCATION", "MEETING", "SALE"], default: "UPDATE" },
            meetingType: String, // ONE_TO_ONE, GROUP, etc.
            timestamp: { type: Date, default: Date.now }
        },
        { timestamps: true }
    )
)

/* ================= DISTRIBUTOR INVENTORY ================= */
export const DistributorInventory = mongoose.model(
    "DistributorInventory",
    new mongoose.Schema(
        {
            distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            productName: { type: String, required: true },
            productSKU: String,
            packSize: String,
            // Stock received from company ("mall" / inward)
            quantityReceived: { type: Number, default: 0 },
            // Stock distributed / sold outward
            quantityDistributed: { type: Number, default: 0 },
            // Current balance = received - distributed
            currentStock: { type: Number, default: 0 },
            pricePerUnit: Number,
            notes: String,
            lastUpdated: { type: Date, default: Date.now }
        },
        { timestamps: true }
    )
)
