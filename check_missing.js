/**
 * check_missing.js — Check which family tree members are missing from DB
 * Run: node check_missing.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member   = require('./models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

// All expected HUSBAND names (first word of each entry) + single-name members
const expectedNames = [
  // Gen 1
  'FAKIR',
  // Gen 2
  'SOBHNATH', 'BHIKHARI', 'KANHAI', 'SHANKARSHAN',
  // Gen 3
  'KRISHNA', 'TRILOCHAN', 'LACHHINDRA', 'GHANSYAM', 'SUDARSHAN', 'GANGADHAR',
  // Gen 4
  'VANMALI', 'KRIPASINDHU', 'BHUVNESHWAR', 'JAGESHWAR', 'MANBODH',
  // Gen 5
  'KRITIWAS', 'SUDARSHAN', 'SATRUGHAN', 'SIDDHESWAR', 'SRIPATI', 'NARAYAN', 'ARJUN', 'UPENDRA',
  // Gen 6
  'DHANURJAYA', 'SAHADEV', 'VRINDAVAN', 'BRAJABANDHU', 'LINGRAJ',
  // Gen 7
  'KARUNAKAR', 'MURLIDHAR', 'SANATAN', 'SANKARSAN', 'GOWARDHAN',
  'JANARDAN', 'MINKETAN', 'GAJANAND', 'MADUSUDAN',
  // Gen 8
  'SUBHASH', 'GOKUL', 'HRISHIKESH', 'KANHYA', 'YUDHISTIR', 'SUSHIL',
  'SURENDRA', 'BANISH', 'DURGACHARAN', 'PITAMBAR', 'SUKLAMBAR',
  'MAHESEWAR', 'SHRADHAKAR', 'CHANDRASEKHAR',
  // Gen 9
  'GAJENDRA', 'HARSHWARDHAN', 'MAHENDRA', 'PRATAP', 'PRANAV',
  'DOBERRAJ', 'OMPRAKASH', 'ANIL', 'ANUP', 'DINESH', 'RAMESH', 'SUDHIR', 'SANJAY',
  // Gen 10
  'PRATWA', 'PARTH', 'SUBHAM', 'RAJU',
  // Wives
  'MALTI', 'SUNAPHUL', 'MUKTA', 'YASHODA',
  'SATYAWATI', 'RADHALAXMI', 'RANI', 'SITA',
  'SATYABHAMA', 'HARAWATI', 'SUBHADRA', 'HEMWATI', 'TRIPURA', 'PARVATI',
  'URVASHI', 'PRIYOWATI', 'GAURI',
  'PRATIVA SEWTI', 'SANKARA', 'MOGRA', 'MAYA', 'BHAGMATI', 'KHIRODHARI',
  'SHAILENDRI', 'UMA', 'URKULI', 'SAFED',
  'SIKHA',
];

// Remove duplicates
const uniqueNames = [...new Set(expectedNames)];

async function checkMissing() {
  console.log('🔌 Connecting...');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  });
  console.log('✅ Connected!\n');

  const missing  = [];
  const found    = [];

  for (const name of uniqueNames) {
    const regex  = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const member = await Member.findOne({ name: regex });
    if (member) {
      found.push(name);
    } else {
      missing.push(name);
    }
  }

  console.log(`✅ Found in DB   (${found.length}):`);
  console.log('  ' + found.join(', ') + '\n');

  if (missing.length === 0) {
    console.log('🎉 No missing members! All', uniqueNames.length, 'are in the database.');
  } else {
    console.log(`❌ Missing from DB (${missing.length}):`);
    missing.forEach(n => console.log(`  ✗ ${n}`));
  }

  // Also show total members in DB
  const total = await Member.countDocuments();
  console.log(`\n📊 Total members in database: ${total}`);

  await mongoose.disconnect();
}

checkMissing()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    if (err.name === 'MongoServerSelectionError') {
      console.error('\n💡 Cannot reach MongoDB Atlas.');
      console.error('   → Check internet connection');
      console.error('   → Whitelist your IP: https://cloud.mongodb.com → Network Access');
    }
    process.exit(1);
  });
