const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'site_settings' },
  siteTitle: { type: String, default: 'Utkal Brahmin Samaj' },
  donationTarget: { type: Number, default: 500000 },
  upiId: { type: String, default: 'mahendraget@ybl' },
  qrCodeUrl: { type: String, default: '/images/qr-code.jpg' },
  contactEmail: { type: String, default: 'contact@utkalbrahminsamaj.com' },
  contactPhone: { type: String, default: '+91 98765 43210' },
  facebookUrl: { type: String, default: '#' },
  whatsappGroupUrl: { type: String, default: '#' },
  // Bank Details for Donations
  accountName: { type: String, default: 'Pusaur Utkal Brahmin Samaj Trust' },
  accountNumber: { type: String, default: '3142 5678 9012 3456' },
  bankName: { type: String, default: 'State Bank of India' },
  ifscCode: { type: String, default: 'SBIN0001234' },
  branchName: { type: String, default: 'Pusaur Main' },
  isChatbotEnabled: { type: Boolean, default: true },
  geminiApiKey: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

module.exports = mongoose.model('Settings', settingsSchema);
