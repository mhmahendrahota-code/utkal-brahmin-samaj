const mongoose = require('mongoose');

const surnameSchema = new mongoose.Schema({
  surname: { type: String, required: true },
  hindiName: { type: String, default: '' },
  meaning: { type: String, default: '' },
  meaningHindi: { type: String, default: '' },
  gotra: { type: String, default: '' },
  letter: { type: String }
}, { timestamps: true });

// Auto-compute letter before saving
surnameSchema.pre('save', function(next) {
  if (this.surname) {
    this.letter = this.surname.charAt(0).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Surname', surnameSchema);
