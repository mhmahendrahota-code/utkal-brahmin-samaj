const mongoose = require('mongoose');
require('dotenv').config();
const Member = require('../models/Member');

async function cleanup() {
  try {
    console.log('--- Matrimonial Data Cleanup ---');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Identify members who were likely wrongly flagged as 'isEligible'
    // Logic: 
    // 1. isEligible is true
    // 2. isApproved is false (not yet active)
    // 3. isMatrimonialRequest is false (not a specific submission)
    // 4. No bio, education, or height provided (indicates no real matrimonial data)
    
    const query = {
      'matrimonialProfile.isEligible': true,
      'matrimonialProfile.isApproved': { $ne: true },
      'matrimonialProfile.isMatrimonialRequest': { $ne: true },
      $or: [
        { 'matrimonialProfile.bio': { $exists: false } },
        { 'matrimonialProfile.bio': '' }
      ],
      $or: [
        { 'matrimonialProfile.height': { $exists: false } },
        { 'matrimonialProfile.height': '' }
      ]
    };

    const countBefore = await Member.countDocuments(query);
    console.log(`Found ${countBefore} members with inconsistent matrimonial eligibility.`);

    if (countBefore > 0) {
      const result = await Member.updateMany(query, {
        $set: { 'matrimonialProfile.isEligible': false }
      });
      console.log(`Successfully updated ${result.modifiedCount} members. isEligible set to false.`);
    } else {
      console.log('No inconsistent records found.');
    }

    await mongoose.disconnect();
    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
