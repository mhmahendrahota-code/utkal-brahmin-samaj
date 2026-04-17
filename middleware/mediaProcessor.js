const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Set up Cloudinary storage for profile images
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ubs_profiles', // Cloudinary folder name
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'center', format: 'webp' }]
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Middleware to handle Cloudinary image path
 * Attaches the secure URL to req.body.profileImage
 */
const processProfileImage = (req, res, next) => {
  if (req.file && req.file.path) {
    // req.file.path contains the secure Cloudinary URL
    req.body.profileImage = req.file.path;
  }
  next();
};

module.exports = {
  uploadProfile: upload.single('profileImageFile'),
  processProfileImage
};
