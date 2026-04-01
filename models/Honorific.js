const mongoose = require('mongoose');

const honorificSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, trim: true }, // e.g. "Shri", "Smt."
  label:      { type: String, required: true, trim: true },
  hindiLabel: { type: String, default: '', trim: true },
  gender:     { type: String, enum: ['M', 'F', 'Both'], default: 'Both' },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Honorific', honorificSchema);
