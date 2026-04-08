require('dotenv').config();
const dns = require('dns');
// Use public DNS to resolve Atlas SRV records reliably from local environment
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs');

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected to DB for admin password migration');

  const admins = await AdminUser.find().lean();
  let migrated = 0;
  let skipped = 0;

  for (const a of admins) {
    const id = a._id;
    // If already has passwordHash, skip
    if (a.passwordHash) {
      skipped++;
      continue;
    }

    // If has legacy plaintext `password` field, hash it and save
    if (a.password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(a.password, salt);
      await AdminUser.findByIdAndUpdate(id, { $set: { passwordHash: hash }, $unset: { password: '' } });
      console.log(`Migrated admin ${a.username} (${id})`);
      migrated++;
      continue;
    }

    // No usable password found
    console.warn(`No password found for admin ${a.username} (${id}) — manual reset required`);
  }

  console.log(`Migration complete. Migrated: ${migrated}, Skipped(already hashed): ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
