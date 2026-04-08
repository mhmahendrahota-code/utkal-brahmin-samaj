const mongoose = require('mongoose');

const meetRegistrationSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  age:     { type: Number },
  gotra:   { type: String, trim: true },
  location:{ type: String, trim: true },  // Village / Location
  contact: { type: String, trim: true },  // Contact number
  notes:   { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('MeetRegistration', meetRegistrationSchema);
