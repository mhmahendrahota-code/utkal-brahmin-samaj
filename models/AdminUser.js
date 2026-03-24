const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Editor', enum: ['Super Admin', 'Editor', 'Viewer'] },
  name: { type: String },
  dateCreated: { type: Date, default: Date.now }
}, { timestamps: true });

// Hash password before saving if it has been modified
adminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare a plain-text password against the stored hash
adminUserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
