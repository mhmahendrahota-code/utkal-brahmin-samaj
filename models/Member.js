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
  isApproved: { type: Boolean, default: false },
  isCommitteeMember: { type: Boolean, default: false },
  isFamilyTreeOnly: { type: Boolean, default: false }, // Hide from main directory
  
  // Family Tree Fields
  father: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  mother: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  spouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],

  // Ancestor / Deceased Support
  isDeceased: { type: Boolean, default: false },
  honorific: { type: String, default: '' }, // e.g., 'Late' / 'स्व.'
  deathDate: Date,
  matrimonialProfile: { type: matrimonialProfileSchema, default: () => ({}) }
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);
