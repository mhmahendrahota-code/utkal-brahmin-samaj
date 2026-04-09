require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('../models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  const total = await Member.countDocuments();
  const noGender = await Member.countDocuments({gender: {$exists: false}});
  const nullGender = await Member.countDocuments({gender: null});
  const noHonorific = await Member.countDocuments({honorific: {$in: [null, '', undefined]}});
  console.log({total, noGender, nullGender, noHonorific});
  
  // also group by honorific
  const honorifics = await Member.aggregate([
    { $group: { _id: '$honorific', count: { $sum: 1 } } }
  ]);
  console.log('Honorifics:', honorifics);

  // also group by gender
  const genders = await Member.aggregate([
    { $group: { _id: '$gender', count: { $sum: 1 } } }
  ]);
  console.log('Genders:', genders);
  
  process.exit();
}
run();
