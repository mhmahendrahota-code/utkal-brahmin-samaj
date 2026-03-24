const mongoose = require('mongoose');

const surnameReportSchema = new mongoose.Schema({
  surname: { type: String, required: true },
  reporterName: { type: String, default: 'Anonymous' },
  errorType: { type: String, default: 'general', enum: ['meaning', 'hindi', 'gotra', 'general'] },
  description: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'resolved'] }
}, { timestamps: true });

module.exports = mongoose.model('SurnameReport', surnameReportSchema);
