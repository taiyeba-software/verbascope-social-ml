import multer from 'multer';

// memoryStorage matches post-service's pattern: imagekit.js expects a Buffer,
// not a path on disk, so we never write the file locally.
const storage = multer.memoryStorage();

// Basic guardrails: avatars only, reasonable size cap so a multi-GB upload
// can't tie up the request — adjust the limit if you need bigger images.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

/**
 * Build a unique, collision-safe filename for ImageKit.
 * userId is included so avatar files are traceable back to their owner.
 */
export function generateAvatarFileName(userId, originalName) {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
  return `avatar_${userId}_${Date.now()}.${ext}`;
}

// Single-file upload, field name "avatar" — frontend must send the file
// under this field name in the multipart form.
export const avatarUpload = upload.single('avatar');