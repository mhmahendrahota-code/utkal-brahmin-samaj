const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  // Store bcrypt hash only
  passwordHash: { type: String },
  // Password reset token and expiry
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  role: { type: String, default: 'Editor', enum: ['Super Admin', 'Editor', 'Viewer'] },
  name: { type: String },
  dateCreated: { type: Date, default: Date.now }
}, { timestamps: true });

// Virtual `password` setter — hashes before save
adminUserSchema.virtual('password')
  .set(function(pw) {
    this._password = pw;
  });

adminUserSchema.pre('save', async function(next) {
  if (this._password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.passwordHash = await bcrypt.hash(this._password, salt);
    } catch (e) {
      return next(e);
    }
  }
  next();
});

adminUserSchema.methods.comparePassword = function(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
