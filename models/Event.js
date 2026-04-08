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

// Add Indexes
eventSchema.index({ title: 'text' });
eventSchema.index({ description: 'text' });
eventSchema.index({ date: 1 });
eventSchema.index({ isActive: 1 });

module.exports = mongoose.model('Event', eventSchema);
