const mongoose = require('mongoose');

const occupationSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  hindiName: { type: String, default: '', trim: true },
  category:  { type: String, default: 'Other', trim: true }, // e.g. Government, Business, Agriculture
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Occupation', occupationSchema);
