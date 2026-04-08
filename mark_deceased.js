require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('./models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to database');

  const allMembers = await Member.find({});
  const membersMap = new Map();
  allMembers.forEach(m => membersMap.set(m._id.toString(), m));

  const root = allMembers.find(m => m.name === 'Fakir' && m.surname === 'Hota');
  if (!root) {
    console.log('Root Fakir not found');
    process.exit(1);
  }

  const depthMap = new Map();
  depthMap.set(root._id.toString(), 1); // Gen 1
  if (root.spouse) depthMap.set(root.spouse.toString(), 1);

  const queue = [root._id.toString()];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentDepth = depthMap.get(currentId);
    
    // Find children
    const children = allMembers.filter(m => 
      (m.father && m.father.toString() === currentId) || 
      (m.mother && m.mother.toString() === currentId)
    );

    for (const child of children) {
      const childIdStr = child._id.toString();
      if (!depthMap.has(childIdStr)) {
        depthMap.set(childIdStr, currentDepth + 1);
        queue.push(childIdStr);
        if (child.spouse) {
            depthMap.set(child.spouse.toString(), currentDepth + 1);
        }
      }
    }
  }

  let updatedCount = 0;
  for (const [idStr, depth] of depthMap.entries()) {
    if (depth >= 1 && depth <= 7) {
      const member = membersMap.get(idStr);
      let dirty = false;
      
      if (!member.isDeceased) {
        member.isDeceased = true;
        dirty = true;
      }
      
      if (!member.honorific || member.honorific.toLowerCase() !== 'late') {
        member.honorific = 'Late';
        dirty = true;
      }
      
      if (dirty) {
        await member.save();
        console.log(`Marked ${member.name} (Gen ${depth}) as Deceased.`);
        updatedCount++;
      }
    }
  }

  console.log(`Finished updating ${updatedCount} members.`);
  await mongoose.disconnect();
}

run().catch(console.error);
