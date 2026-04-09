/**
 * Bulk Honorific Fix Script
 * 
 * Rules:
 *  - generationLevel 0 to 6  → honorific = "Late", isDeceased = true
 *  - generationLevel > 6 or null:
 *      - gender = "Female" → honorific = "Smt."
 *      - gender = "Male"   → honorific = "Shri"
 *      - (leaves Dr./Er./Prof./Ms. etc. untouched if already set)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
// Use Google's public DNS to resolve MongoDB Atlas SRV records reliably
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const Member = require('../models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('✅ Connected to MongoDB\n');

  // ── 1. Generation 0-6 → Late + isDeceased ────────────────────────────────
  const lateResult = await Member.updateMany(
    {
      generationLevel: { $gte: 0, $lte: 6 }
    },
    {
      $set: { honorific: 'Late', isDeceased: true }
    }
  );
  console.log(`📌 Marked as Late (स्वर्गीय):  ${lateResult.modifiedCount} members (generation 0-6)`);

  // ── 2. Female members (not generation 0-6) → Smt. ────────────────────────
  // Only update if honorific is blank, Shri, or not medically/professionally set
  const AUTO_TITLES = ['', 'Shri', 'Smt.', 'Ms.', 'Late'];
  
  const smtResult = await Member.updateMany(
    {
      gender: 'Female',
      $or: [
        { generationLevel: null },
        { generationLevel: { $gt: 6 } }
      ],
      honorific: { $in: AUTO_TITLES }
    },
    {
      $set: { honorific: 'Smt.' }
    }
  );
  console.log(`👩 Set Smt. (श्रीमती):           ${smtResult.modifiedCount} female members`);

  // ── 3. Male members (not generation 0-6) → Shri ──────────────────────────
  const shriResult = await Member.updateMany(
    {
      gender: 'Male',
      $or: [
        { generationLevel: null },
        { generationLevel: { $gt: 6 } }
      ],
      honorific: { $in: AUTO_TITLES }
    },
    {
      $set: { honorific: 'Shri' }
    }
  );
  console.log(`👨 Set Shri (श्री):              ${shriResult.modifiedCount} male members`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalUpdated = lateResult.modifiedCount + smtResult.modifiedCount + shriResult.modifiedCount;
  console.log(`\n✅ Total updated: ${totalUpdated} members`);

  // Quick verification
  const counts = await Member.aggregate([
    { $group: { _id: '$honorific', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n📊 Honorific distribution after update:');
  counts.forEach(c => console.log(`   ${(c._id || '(none)').padEnd(10)} → ${c.count} members`));

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected. Done!');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
