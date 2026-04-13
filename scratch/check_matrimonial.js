const mongoose = require('mongoose');
require('dotenv').config();
const Member = require('../models/Member');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const stats = {
      totalMembers: await Member.countDocuments({}),
      isEligible_True: await Member.countDocuments({ 'matrimonialProfile.isEligible': true }),
      isApproved_True: await Member.countDocuments({ 'matrimonialProfile.isApproved': true }),
      bothTrue: await Member.countDocuments({ 'matrimonialProfile.isEligible': true, 'matrimonialProfile.isApproved': true }),
      isRequest_True: await Member.countDocuments({ 'matrimonialProfile.isMatrimonialRequest': true }),
      eligible_not_request: await Member.countDocuments({ 
        'matrimonialProfile.isEligible': true, 
        'matrimonialProfile.isMatrimonialRequest': { $ne: true } 
      })
    };
    console.log(JSON.stringify(stats, null, 2));
    
    // Sample one that is eligible but not a request
    const sample = await Member.findOne({ 
      'matrimonialProfile.isEligible': true, 
      'matrimonialProfile.isMatrimonialRequest': { $ne: true } 
    }).select('name matrimonialProfile createdAt');
    
    console.log('Sample weird member:', JSON.stringify(sample, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
