const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date },
  location: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  rsvpCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
