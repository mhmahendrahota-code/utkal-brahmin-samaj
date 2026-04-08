require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function setPassword(username, password) {
  if (!username || !password) {
    console.error('Usage: node scripts/set_admin_password.js <username> <newPassword>');
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });

  let user = await AdminUser.findOne({ username });
  if (!user) {
    console.log(`No admin found with username '${username}', creating a new Super Admin.`);
    user = new AdminUser({ username, role: 'Super Admin', name: username });
  }

  user.password = password; // virtual property triggers hashing in pre-save
  await user.save();

  console.log(`Password set for admin '${username}'.`);
  await mongoose.disconnect();
}

const [,, username, password] = process.argv;
setPassword(username, password).catch(err => { console.error('Error:', err); process.exit(1); });
