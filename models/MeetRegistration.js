const mongoose = require('mongoose');

const meetRegistrationSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  village: { type: String },
  numberOfAttendees: { type: Number, default: 1 },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('MeetRegistration', meetRegistrationSchema);
