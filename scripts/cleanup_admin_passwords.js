require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function cleanup() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected to DB for admin password cleanup');

  const admins = await AdminUser.find().lean();
  let removed = 0;
  for (const a of admins) {
    if (a.password && a.passwordHash) {
      await AdminUser.updateOne({ _id: a._id }, { $unset: { password: '' } });
      console.log(`Unset plaintext password for ${a.username}`);
      removed++;
    } else if (a.password && !a.passwordHash) {
      console.warn(`Admin ${a.username} has plaintext password but no hash — skipping (manual review needed)`);
    }
  }

  console.log(`Cleanup complete. Removed plaintext passwords from ${removed} admin(s).`);
  await mongoose.disconnect();
}

cleanup().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
