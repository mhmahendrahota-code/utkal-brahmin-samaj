require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('./models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const members = await Member.find({});
  let count = 0;
  for (let m of members) {
    let dirty = false;
    const properName = toTitleCase(m.name);
    if (m.name !== properName) { m.name = properName; dirty = true; }
    
    if (m.fatherName) {
      const pFatherName = toTitleCase(m.fatherName);
      if (m.fatherName !== pFatherName) { m.fatherName = pFatherName; dirty = true; }
    }
    if (m.spouseName) {
      const pSpouseName = toTitleCase(m.spouseName);
      if (m.spouseName !== pSpouseName) { m.spouseName = pSpouseName; dirty = true; }
    }
    
    if (dirty) {
      await m.save();
      count++;
    }
  }
  
  // Pass 2 for gender logic
  // Get all fathers
  const fathers = await Member.distinct('father');
  await Member.updateMany({ _id: { $in: fathers } }, { $set: { gender: 'Male' } });
  
  // Get all people who are Male and have spouses
  const males = await Member.find({ gender: 'Male', spouse: { $exists: true } });
  for (const male of males) {
    await Member.updateOne({ _id: male.spouse }, { $set: { gender: 'Female' } });
  }
  
  // For remaining family tree members, if they are spouses of existing members...
  // Actually, the easiest rule for this specific import: The first word was Husband, second word was Wife.
  // We can just query those whose spouses are Female and set them to Male.
  const females = await Member.find({ gender: 'Female', spouse: { $exists: true } });
  for (const female of females) {
    await Member.updateOne({ _id: female.spouse }, { $set: { gender: 'Male' } });
  }

  // Any single members from import (from rawData, if they don't have spouse or children, they are usually the single sons).
  const remaining = await Member.find({ gender: { $exists: false }, isFamilyTreeOnly: true });
  for (const rem of remaining) {
    await Member.updateOne({ _id: rem._id }, { $set: { gender: 'Male' } });
  }

  console.log(`Updated ${count} members to title case and set genders.`);
  await mongoose.disconnect();
}

run();