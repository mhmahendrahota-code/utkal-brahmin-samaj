const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  hindiName: { type: String, default: '', trim: true },
  district:  { type: String, default: '', trim: true },
  state:     { type: String, default: 'Odisha', trim: true },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Village', villageSchema);
