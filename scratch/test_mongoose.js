const mongoose = require('mongoose');

const subSchema = new mongoose.Schema({
  isEligible: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false }
}, { _id: false });

const parentSchema = new mongoose.Schema({
  name: String,
  sub: { type: subSchema, default: () => ({}) }
});

const Parent = mongoose.model('Parent', parentSchema);

const p = new Parent({
  name: 'Test',
  sub: {
    somethingElse: 'hello'
  }
});

console.log('Default sub.isEligible:', p.sub.isEligible);
