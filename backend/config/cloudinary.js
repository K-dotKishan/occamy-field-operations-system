import { v2 as cloudinary } from "cloudinary"

// NOTE: Do NOT call cloudinary.config() here at module load time.
// In ESM, all imports are hoisted and executed before any code in the
// importing file runs — including `import 'dotenv/config'`.
// This means process.env values are undefined when this module first loads.
//
// Instead, cloudinary is configured on first use inside the middleware
// (see upload.js). The raw cloudinary object is exported so upload.js
// can call .config() at request time when env vars are guaranteed to exist.

export default cloudinary
