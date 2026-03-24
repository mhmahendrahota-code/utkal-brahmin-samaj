const mongoose = require('mongoose');

const matrimonialProfileSchema = new mongoose.Schema({
  isEligible: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  dateOfBirth: { type: Date },
  education: { type: String },
  height: { type: String }
}, { _id: false });

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gotra: { type: String },
  village: { type: String },
  occupation: { type: String },
  contactNumber: { type: String },
  email: { type: String },
  address: { type: String },
  profileImage: { type: String, default: '/images/default-avatar.png' },
  isCommitteeMember: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  matrimonialProfile: { type: matrimonialProfileSchema, default: () => ({}) }
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);
