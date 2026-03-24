const mongoose = require('mongoose');

const studentApplicationSchema = new mongoose.Schema({
  studentName: { type: String },
  parentName: { type: String },
  phone: { type: String },
  school: { type: String },
  percentage: { type: Number },
  course: { type: String },
  village: { type: String },
  notes: { type: String, default: '' },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] }
}, { timestamps: true });

module.exports = mongoose.model('StudentApplication', studentApplicationSchema);
