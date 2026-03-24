const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  amount: { type: Number, required: true },
  purpose: { type: String, default: 'Samaj Bhawan' },
  paymentMethod: { type: String, default: 'Cash' },
  transactionId: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
