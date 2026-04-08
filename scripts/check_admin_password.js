require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function check(username, candidate) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  const user = await AdminUser.findOne({ username });
  if (!user) { console.log('No user'); process.exit(1); }
  const ok = await user.comparePassword(candidate);
  console.log('comparePassword result:', ok);
  console.log('passwordHash present:', !!user.passwordHash);
  console.log('raw document fields:', Object.keys(user.toObject()));
  await mongoose.disconnect();
}

const [,, username, candidate] = process.argv;
check(username, candidate).catch(err => { console.error(err); process.exit(1); });
