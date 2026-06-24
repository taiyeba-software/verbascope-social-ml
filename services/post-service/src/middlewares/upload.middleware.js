import multer from 'multer';

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// SVG intentionally excluded — security risk (can embed scripts)

const MAX_FILE_SIZE_MB = 5;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
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
    files: 4,
  },
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Each image must be under ${MAX_FILE_SIZE_MB}MB.`,
      LIMIT_FILE_COUNT: 'You can upload a maximum of 4 images per post.',
      LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field.',
    };
    return res.status(400).json({
      success: false,
      error: messages[err.code] || `Upload error: ${err.message}`,
    });
  }
  next(err);
};

export const generateImageKitFileName = (originalname) => {
  // Fix 1: guard against filenames with no extension (e.g. "photo" → falls back to 'jpg')
  const ext = originalname.includes('.')
    ? originalname.split('.').pop().toLowerCase()
    : 'jpg';
  const uid = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${uid}.${ext}`;
};

// Use as: upload.array('images', 4)
export default upload;