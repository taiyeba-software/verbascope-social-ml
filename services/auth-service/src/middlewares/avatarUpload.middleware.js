import multer from 'multer';

// memoryStorage matches post-service's pattern: imagekit.js expects a Buffer,
// not a path on disk, so we never write the file locally.
const storage = multer.memoryStorage();

// Same allowed list as post-service — SVG intentionally excluded (can embed scripts).
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_FILE_SIZE_MB = 5;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // Use a real MulterError (not a plain Error) so it's caught by
    // handleAvatarUploadError below instead of falling through to
    // Express's default error handler and 500ing.
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    err.message = `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF.`;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

/**
 * Mirrors post-service's handleMulterError. Without this, a bad file type
 * or oversized file throws inside fileFilter/limits, skips the controller
 * entirely, and reaches Express's default error handler — which returns a
 * raw stack trace with a 500 instead of a clean JSON 400.
 */
export const handleAvatarUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Avatar image must be under ${MAX_FILE_SIZE_MB}MB.`,
      LIMIT_FILE_COUNT: 'Only one avatar file can be uploaded at a time.',
      LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field.',
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || `Upload error: ${err.message}`,
    });
  }
  next(err);
};

/**
 * Build a unique, collision-safe filename for ImageKit.
 * userId is included so avatar files are traceable back to their owner,
 * and so old-avatar cleanup can find this user's previous files by prefix.
 */
export function generateAvatarFileName(userId, originalName) {
  const ext = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : 'jpg';
  return `avatar_${userId}_${Date.now()}.${ext}`;
}

// Single-file upload, field name "avatar" — frontend must send the file
// under this field name in the multipart form.
export const avatarUpload = upload.single('avatar');