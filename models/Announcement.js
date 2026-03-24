const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  message: { type: String, required: true },
  icon: { type: String, default: 'fas fa-dharmachakra' },
  isActive: { type: Boolean, default: true },
  expiryDate: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
