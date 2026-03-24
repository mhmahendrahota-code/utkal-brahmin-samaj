const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Editor', enum: ['Super Admin', 'Editor', 'Viewer'] },
  name: { type: String },
  dateCreated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', adminUserSchema);
