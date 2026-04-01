const mongoose = require('mongoose');

const gotraSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  hindiName:   { type: String, default: '', trim: true },
  description: { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Gotra', gotraSchema);
