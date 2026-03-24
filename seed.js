/**
 * seed.js — One-time migration script
 * Reads data/db.json and inserts all records into MongoDB Atlas.
 *
 * Usage:
 *   1. Make sure MONGODB_URI in .env points to your Atlas cluster
 *   2. Run: node seed.js
 *   3. Check MongoDB Atlas to confirm data was seeded
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix for querySrv ECONNREFUSED on some networks
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import all Mongoose models
const Member = require('./models/Member');
const Announcement = require('./models/Announcement');
const Donation = require('./models/Donation');
const Event = require('./models/Event');
const Committee = require('./models/Committee');
const Document = require('./models/Document');
const Gallery = require('./models/Gallery');
const Message = require('./models/Message');
const MeetRegistration = require('./models/MeetRegistration');
const StudentApplication = require('./models/StudentApplication');
const Surname = require('./models/Surname');
const SurnameReport = require('./models/SurnameReport');
const Settings = require('./models/Settings');

// Map collection names to Mongoose models
const modelMap = {
  members: Member,
  announcements: Announcement,
  donations: Donation,
  events: Event,
  committee: Committee,
  documents: Document,
  gallery: Gallery,
  messages: Message,
  meetRegistrations: MeetRegistration,
  studentApplications: StudentApplication,
  surnames: Surname,
  surnameReports: SurnameReport,
};

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI || MONGODB_URI.includes('YOUR_USERNAME')) {
    console.error('❌ Please set a valid MONGODB_URI in your .env file before seeding.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  const dbPath = path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.log('ℹ️  No db.json found at data/db.json — nothing to seed.');
    process.exit(0);
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  for (const [collectionName, Model] of Object.entries(modelMap)) {
    const records = db[collectionName] || [];
    if (records.length === 0) {
      console.log(`⏭️  Skipping ${collectionName} (empty)`);
      continue;
    }
    try {
      // Clean old data first to avoid duplicates on re-run
      await Model.deleteMany({});
      // Remove _id and createdAt/updatedAt so Mongoose generates fresh ones
      const cleaned = records.map(r => {
        const { _id, ...rest } = r;
        return rest;
      });
      await Model.insertMany(cleaned, { ordered: false });
      console.log(`✅ Seeded ${records.length} records → ${collectionName}`);
    } catch (err) {
      console.error(`❌ Error seeding ${collectionName}:`, err.message);
    }
  }

  // Seed settings singleton
  if (db.settings && db.settings.length > 0) {
    try {
      const { _id, ...settingsData } = db.settings[0];
      await Settings.findByIdAndUpdate('site_settings', { $set: settingsData }, { upsert: true });
      console.log('✅ Seeded settings');
    } catch (err) {
      console.error('❌ Error seeding settings:', err.message);
    }
  }

  console.log('\n🎉 Seeding complete! Disconnecting...');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
