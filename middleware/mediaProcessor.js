const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Configure memory storage for multer as we'll process with sharp before saving
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'));
  }
});

/**
 * Middleware to process uploaded profile images
 * Resizes to 600x600 (center crop) and converts to WebP
 */
const processProfileImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const filename = `profile-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, '../public/uploads/profiles', filename);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(req.file.buffer)
      .resize(600, 600, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Attach the new path to req.body for database saving
    req.body.profileImage = `/uploads/profiles/${filename}`;
    
    next();
  } catch (error) {
    console.error('Sharp Image Processing Error:', error);
    next(); // Continue without image or handle error as needed
  }
};

module.exports = {
  uploadProfile: upload.single('profileImageFile'),
  processProfileImage
};
