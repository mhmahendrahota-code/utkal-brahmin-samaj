require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('./models/Member');

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const all = await Member.find({});
  const idSet = new Set(all.map(m => m._id.toString()));

  const broken = [];

  for (const m of all) {
    const issues = [];

    if (m.father && !idSet.has(m.father.toString())) {
      issues.push(`  ❌ father ID ${m.father} does not exist`);
    }
    if (m.mother && !idSet.has(m.mother.toString())) {
      issues.push(`  ❌ mother ID ${m.mother} does not exist`);
    }
    if (m.spouse && !idSet.has(m.spouse.toString())) {
      issues.push(`  ❌ spouse ID ${m.spouse} does not exist`);
    }
    for (const childId of (m.children || [])) {
      if (!idSet.has(childId.toString())) {
        issues.push(`  ❌ child ID ${childId} does not exist`);
      }
    }

    // Check for missing reciprocal child links: if I have a father, I should be in father's children
    if (m.father && idSet.has(m.father.toString())) {
      const father = all.find(a => a._id.toString() === m.father.toString());
      if (father && !father.children.some(c => c.toString() === m._id.toString())) {
        issues.push(`  ⚠️  Father "${father.name}" does not have this member in children[] → reciprocal missing`);
      }
    }
    if (m.mother && idSet.has(m.mother.toString())) {
      const mother = all.find(a => a._id.toString() === m.mother.toString());
      if (mother && !mother.children.some(c => c.toString() === m._id.toString())) {
        issues.push(`  ⚠️  Mother "${mother.name}" does not have this member in children[] → reciprocal missing`);
      }
    }

    if (issues.length > 0) {
      broken.push({ name: m.name, id: m._id.toString(), issues });
    }
  }

  if (broken.length === 0) {
    console.log('✅ No broken lineage connections found!');
  } else {
    console.log(`Found ${broken.length} member(s) with broken/missing connections:\n`);
    for (const b of broken) {
      console.log(`👤 ${b.name} (${b.id})`);
      b.issues.forEach(i => console.log(i));
      console.log('');
    }
  }

  await mongoose.connection.close();
}

diagnose().catch(err => { console.error(err); process.exit(1); });
