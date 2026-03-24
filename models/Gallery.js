const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: { type: String, default: '' },
  imageUrl: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'misc' },
  dateUploaded: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
