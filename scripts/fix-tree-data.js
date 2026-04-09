require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('../models/Member');

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // 1. Authoritative Deceased List (from original import data)
  const DECEASED_NAMES = [
    'fakir', 'Malti', 'Sobhnath', 'Bhikhari', 'Sunaphool', 'Trilochan', 'Mukta', 
    'Lachhindra', 'Yashoda', 'Jageshwar', 'Sita', 'Vanmali', 'Satyawati', 
    'Kripasindhu', 'Rahilaxmi', 'Bhuvneshwar', 'Rahi', 'Narayan', 'Hemwati', 
    'Sudarshan', 'Satyabhama', 'Siddheswar', 'Harawati', 'Lingraj', 'Gauri', 
    'Brajabandhu', 'Priyowati', 'Sushil', 'Suklambar', 'Maheshwar', 
    'Shradhakar', 'Subhash', 'Gokul'
  ];

  console.log('--- REPAIRING DECEASED STATUS ---');

  // 2. Reset everyone to "Alive" first
  const resetResult = await Member.updateMany({}, { 
    $set: { isDeceased: false } 
  });
  console.log(`- Reset ${resetResult.modifiedCount} members to Alive.`);

  // 3. Mark by Generation (Ancestors - safeguard)
  // We assume anyone up to Gen 5 is deceased
  const genResult = await Member.updateMany(
    { generationLevel: { $gte: 0, $lte: 5 } },
    { $set: { isDeceased: true } }
  );
  console.log(`- Marked ${genResult.modifiedCount} ancestors (Gen 0-5) as Deceased.`);

  // 4. Mark by Explicit Name Match
  let nameMatchCount = 0;
  for (const name of DECEASED_NAMES) {
    const res = await Member.updateMany(
      { name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      { $set: { isDeceased: true } }
    );
    nameMatchCount += res.modifiedCount;
  }
  console.log(`- Marked ${nameMatchCount} members as Deceased via explicit name list.`);

  // 5. Final Step: Fix Honorifics for EVERYONE based on their new status
  console.log('\n--- FIXING HONORIFICS ---');
  
  // Late for Deceased
  const lateRes = await Member.updateMany(
    { isDeceased: true },
    { $set: { honorific: 'Late' } }
  );
  console.log(`- Set "Late" for ${lateRes.modifiedCount} deceased members.`);

  // Shri for Alive Males
  const shriRes = await Member.updateMany(
    { isDeceased: false, gender: 'Male' },
    { $set: { honorific: 'Shri' } }
  );
  console.log(`- Set "Shri" for ${shriRes.modifiedCount} living males.`);

  // Smt. for Alive Females
  const smtRes = await Member.updateMany(
    { isDeceased: false, gender: 'Female' },
    { $set: { honorific: 'Smt.' } }
  );
  console.log(`- Set "Smt." for ${smtRes.modifiedCount} living females.`);

  console.log('\n✅ Repair complete!');

  await mongoose.disconnect();
}

run().catch(console.error);
