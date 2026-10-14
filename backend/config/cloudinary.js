import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Configure Cloudinary SDK with .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a memory buffer (from Multer) directly to Cloudinary.
 * Automatically compresses to modern WebP format with auto-quality.
 *
 * @param {Buffer} fileBuffer - File buffer from multer memoryStorage
 * @param {Object} options - Upload options (folder, custom dimensions, etc.)
 * @returns {Promise<{ url: string, publicId: string, format: string, width: number, height: number }>}
 */
export const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'wholesale_catalog/products',
        resource_type: 'image',
        format: 'webp', // Force modern Google WebP format for fast 4G loading
        transformation: [
          {
            width: options.width || 800,
            crop: 'limit', // Only downscale if larger than 800px; never upscale
            quality: 'auto:eco', // Optimal 85% compression with crisp visuals
            fetch_format: 'auto',
          },
        ],
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Generate a lightweight 150x150 thumbnail URL from a Cloudinary publicId
 * (Generated on-the-fly via CDN transformations without saving a second file)
 *
 * @param {string} publicId - The Cloudinary asset public_id
 * @returns {string} - Optimized thumbnail CDN URL
 */
export const getThumbnailUrl = (publicId) => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    width: 150,
    height: 150,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:eco',
    fetch_format: 'auto',
    secure: true,
  });
};

/**
 * Delete an image asset from Cloudinary by its publicId.
 * Keeps free-tier storage clean and avoids orphaned files.
 *
 * @param {string} publicId - Cloudinary asset ID to destroy
 * @returns {Promise<Object>}
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`⚠️ Failed to delete Cloudinary asset [${publicId}]:`, error.message);
    throw error;
  }
};

export default cloudinary;
