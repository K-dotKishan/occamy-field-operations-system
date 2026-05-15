import multer from "multer"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import cloudinary from "../config/cloudinary.js"

// ─── Single photo (e.g. profile picture, standalone upload-photo route) ───────
const singlePhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "field_photos",       // Cloudinary folder name – change as you like
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
})

// ─── Multiple photos (meetings, samples, sales) ───────────────────────────────
const multiPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "field_photos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
})

const FILE_SIZE_LIMIT = 5 * 1024 * 1024 // 5 MB

// upload.single("photo")  – use on routes that accept one file
export const uploadSingle = multer({
  storage: singlePhotoStorage,
  limits: { fileSize: FILE_SIZE_LIMIT },
})

// upload.array("photos", 10)  – use on routes that accept multiple files
export const uploadMultiple = multer({
  storage: multiPhotoStorage,
  limits: { fileSize: FILE_SIZE_LIMIT },
})

// ─── Convenience aliases so existing route code needs minimal changes ─────────
// These match the old API:  upload.single(...)  /  upload.array(...)
export const upload = {
  single: (fieldName) => uploadSingle.single(fieldName),
  array:  (fieldName, maxCount) => uploadMultiple.array(fieldName, maxCount),
}
