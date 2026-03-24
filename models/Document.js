const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'Minutes' },
  fileUrl: { type: String },
  description: { type: String, default: '' },
  dateUploaded: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
