const mongoose = require('mongoose');

const matrimonialProfileSchema = new mongoose.Schema({
  isEligible: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isMatrimonialRequest: { type: Boolean, default: false }, // Specific submission
  dateOfBirth: { type: Date },
  education: { type: String },
  educationLevel: { type: String },
  height: { type: String },
  annualIncome: { type: String },
  expectations: { type: String },
  fatherOccupation: { type: String },
  brothers: { type: Number, default: 0 },
  sisters: { type: Number, default: 0 },
  bio: { type: String }
}, { _id: false });

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  surname: { type: String },
  gotra: { type: String },
  village: { type: String },
  occupation: { type: String },
  contactNumber: { type: String },
  email: { type: String },
  address: { type: String },
  profileImage: { type: String, default: '/images/default-avatar.png' },
  bloodGroup: { type: String, enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], default: '' },
  isApproved: { type: Boolean, default: false },
  isCommitteeMember: { type: Boolean, default: false },
  isFamilyTreeOnly: { type: Boolean, default: false }, // Hide from main directory
  
  // Family Tree Fields
  father: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  fatherName: { type: String }, // Manual entry for father if not a member
  mother: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  motherName: { type: String }, // Manual entry for non-member spouses
  spouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  spouseName: { type: String }, // Manual entry for non-member spouses
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],

  // Ancestor / Deceased Support
  isDeceased: { type: Boolean, default: false },
  honorific: { type: String, default: '' }, // e.g., 'Late' / 'स्व.'
  deathDate: Date,
  
  // Generation Tracking (auto-managed, 0 = earliest known ancestor/root)
  generationLevel: { type: Number, default: null },

  matrimonialProfile: { type: matrimonialProfileSchema, default: () => ({}) }
}, { timestamps: true });

// Add Indexes for better performance
memberSchema.index({ surname: 1 });
memberSchema.index({ village: 1 });
memberSchema.index({ contactNumber: 1 });
memberSchema.index({ email: 1 });
memberSchema.index({ father: 1 });
memberSchema.index({ spouse: 1 });
memberSchema.index({ gender: 1, isApproved: 1 });
memberSchema.index({ isFamilyTreeOnly: 1 });

module.exports = mongoose.model('Member', memberSchema);
