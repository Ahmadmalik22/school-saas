import multer from 'multer';

// Use memory storage: files stay in memory buffers before being streamed directly to Cloudinary.
// This prevents leftover temporary files on your server or hosting provider.
const storage = multer.memoryStorage();

// File filter: accept only image types (JPEG, PNG, WEBP, AVIF)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/avif'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type! Only JPG, PNG, WEBP, and AVIF images are allowed.'), false);
  }
};

// Multer upload instance with 10MB file limit for images
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum upload size
  },
  fileFilter,
});

/**
 * Middleware for uploading a single image
 * Example usage: uploadSingleImage('image')
 */
export const uploadSingleImage = (fieldName = 'image') => upload.single(fieldName);

/**
 * Middleware for uploading multiple images (e.g. product gallery)
 * Example usage: uploadMultipleImages('images', 5)
 */
export const uploadMultipleImages = (fieldName = 'images', maxCount = 5) => upload.array(fieldName, maxCount);

// ==========================================
// EXCEL / CSV BULK IMPORT MIDDLEWARE
// ==========================================
const excelFilter = (req, file, cb) => {
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const originalName = file.originalname.toLowerCase();
  const isAllowed = allowedExtensions.some((ext) => originalName.endsWith(ext));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file! Please upload an Excel (.xlsx, .xls) or CSV file.'), false);
  }
};

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for excel sheets (tens of thousands of rows)
  fileFilter: excelFilter,
}).single('file');
