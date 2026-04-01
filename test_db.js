require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('./models/Member');

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected!");

    console.log("Fetching members...");
    const members = await Member.find().sort({ name: 1 }).limit(5);
    console.log("Output Length:", members.length);
    members.forEach(m => {
      console.log(`ID: ${m._id}, Name: ${m.name}`);
    });
    
    await mongoose.connection.close();
  } catch(err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();
