require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const { recalculateAllGenerations } = require('../utils/generationHelper');

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const result = await recalculateAllGenerations();
  console.log('\nRecalculation Complete:');
  console.log(`- Updated: ${result.updated} members`);
  console.log(`- Errors: ${result.errors}`);

  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(console.error);
