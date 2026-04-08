require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function list() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  const admins = await AdminUser.find().lean();
  console.log('Admins:');
  admins.forEach(a => {
    console.log(`- username: ${a.username}, name: ${a.name || ''}, role: ${a.role}, passwordHash: ${a.passwordHash ? 'YES' : 'NO'}, hasPlainPassword: ${a.password ? 'YES' : 'NO'}`);
  });
  await mongoose.disconnect();
}

list().catch(err => { console.error(err); process.exit(1); });
