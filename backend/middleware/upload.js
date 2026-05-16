import multer from "multer"
import { Readable } from "stream"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import cloudinary from "../config/cloudinary.js"

// ─── Configure Cloudinary on first use ───────────────────────────────────────
// ESM imports are hoisted and run BEFORE any code in the importing file,
// including `import 'dotenv/config'`. So process.env is empty at module load.
// We call cloudinary.config() inside functions that execute at request time,
// when dotenv has already populated process.env.
function ensureCloudinaryConfigured() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
  }
}

const FILE_SIZE_LIMIT = 5 * 1024 * 1024 // 5 MB

// ─── Cloudinary storage — only for /upload-photo (single file) ───────────────
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, _file) => {
    ensureCloudinaryConfigured()  // runs at request time — env vars are ready
    return {
      folder: "field_photos",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    }
  },
})

// ─── Memory storage — for meeting / sale / sample forms ──────────────────────
// Files land in req.files[i].buffer. No Cloudinary call during the request.
// Controller uploads to Cloudinary AFTER sending the response (fire-and-forget).
const memoryStorage = multer.memoryStorage()

// ─── Exported middleware ──────────────────────────────────────────────────────

export const uploadSingleToCloudinary = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: FILE_SIZE_LIMIT },
}).single("photo")

export const uploadFormFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMIT },
}).array("photos", 10)

// ─── Post-response Cloudinary upload helper (used by controllers) ─────────────
// Converts a memory buffer to a readable stream and pipes it to Cloudinary.
// Called AFTER res.json() so it never blocks the HTTP response.
export function uploadBufferToCloudinary(buffer) {
  ensureCloudinaryConfigured()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "field_photos", resource_type: "image" },
      (err, result) => {
        if (err) return reject(err)
        resolve(result.secure_url)
      }
    )
    Readable.from(buffer).pipe(stream)
  })
}
