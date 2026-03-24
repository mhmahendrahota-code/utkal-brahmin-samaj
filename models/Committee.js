const mongoose = require('mongoose');

const committeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: 'Member' },
  phone: { type: String, default: '' },
  photoUrl: { type: String, default: '/images/default-avatar.png' },
  priority: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Committee', committeeSchema);
