const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String, default: '' },
  subject: { type: String, default: 'General Enquiry' },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  dateReceived: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
