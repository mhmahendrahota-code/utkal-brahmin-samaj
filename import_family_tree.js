/**
 * import_family_tree.js — Import family tree data from the Fakir Malti lineage image.
 * 
 * Data Source: Family tree photograph/diagram
 * Generations: 10 (Root: FAKIR MALTI → Gen 10 leaf members)
 * Total Members: ~70 nodes
 * 
 * Run: node import_family_tree.js
 */

require('dotenv').config();
const dns = require('dns');
// Use Google's public DNS to resolve MongoDB Atlas SRV records reliably
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('./models/Member');

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY TREE DATA  (read from the family tree image)
// Format: { name, fatherName?, isDeceased?, honorific? }
// Names with a spouse suffix (e.g. "VANMALI SATYAWATI") use the combined
// node label exactly as shown in the tree diagram.
// ─────────────────────────────────────────────────────────────────────────────
const membersData = [

  // ── Generation 1 – Root Ancestor ──────────────────────────────────────────
  { name: "FAKIR MALTI", isDeceased: true, honorific: "Late" },

  // ── Generation 2 ──────────────────────────────────────────────────────────
  { name: "SOBHNATH",          isDeceased: true, honorific: "Late", fatherName: "FAKIR MALTI" },
  { name: "BHIKHARI SUNAPHUL", isDeceased: true, honorific: "Late", fatherName: "FAKIR MALTI" },
  { name: "KANHAI",            fatherName: "FAKIR MALTI" },
  { name: "SHANKARSHAN",       fatherName: "FAKIR MALTI" },

  // ── Generation 3 ──────────────────────────────────────────────────────────
  { name: "KRISHNA",            fatherName: "SOBHNATH" },
  { name: "TRILOCHAN MUKTA",    isDeceased: true, honorific: "Late", fatherName: "BHIKHARI SUNAPHUL" },
  { name: "LACHHINDRA YASHODA", isDeceased: true, honorific: "Late", fatherName: "BHIKHARI SUNAPHUL" },
  { name: "GHANSYAM",           fatherName: "KANHAI" },
  { name: "SUDARSHAN",          fatherName: "KANHAI" },
  { name: "GANGADHAR",          fatherName: "SHANKARSHAN" },

  // ── Generation 4 ──────────────────────────────────────────────────────────
  { name: "VANMALI SATYAWATI",      isDeceased: true, honorific: "Late", fatherName: "TRILOCHAN MUKTA" },
  { name: "KRIPASINDHU RADHALAXMI", isDeceased: true, honorific: "Late", fatherName: "LACHHINDRA YASHODA" },
  { name: "BHUVNESHWAR RANI",       isDeceased: true, honorific: "Late", fatherName: "LACHHINDRA YASHODA" },
  { name: "JAGESHWAR SITA",         isDeceased: true, honorific: "Late", fatherName: "LACHHINDRA YASHODA" },
  { name: "MANBODH",                fatherName: "GANGADHAR" },

  // ── Generation 5 ──────────────────────────────────────────────────────────
  { name: "KRITIWAS",              fatherName: "VANMALI SATYAWATI" },
  { name: "SUDARSHAN SATYABHAMA",  isDeceased: true, honorific: "Late", fatherName: "VANMALI SATYAWATI" },
  { name: "SATRUGHAN",             fatherName: "VANMALI SATYAWATI" },
  { name: "SIDDHESWAR JARAWATI",   isDeceased: true, honorific: "Late", fatherName: "KRIPASINDHU RADHALAXMI" },
  { name: "SRIPATI SUBHADRA",      fatherName: "BHUVNESHWAR RANI" },
  { name: "NARAYAN HEMWATI",       isDeceased: true, honorific: "Late", fatherName: "JAGESHWAR SITA" },
  { name: "ARJUN TRIPURA",         fatherName: "JAGESHWAR SITA" },
  { name: "UPENDRA PARVATI",       fatherName: "JAGESHWAR SITA" },

  // ── Generation 6 ──────────────────────────────────────────────────────────
  { name: "DHANURJAYA",           fatherName: "SUDARSHAN SATYABHAMA" },
  { name: "SAHADEV URVASHI",      fatherName: "SUDARSHAN SATYABHAMA" },
  { name: "VRINDAVAN",            fatherName: "SUDARSHAN SATYABHAMA" },
  { name: "BRAJABANDHU PRIYAWATI", isDeceased: true, honorific: "Late", fatherName: "SIDDHESWAR JARAWATI" },
  { name: "LINGRAJ GAURI",        isDeceased: true, honorific: "Late", fatherName: "NARAYAN HEMWATI" },

  // ── Generation 7 ──────────────────────────────────────────────────────────
  { name: "KARUNAKAR",          fatherName: "BRAJABANDHU PRIYAWATI" },
  { name: "MURLIDHAR",          fatherName: "BRAJABANDHU PRIYAWATI" },
  { name: "SANATAN PRATIVA SEWTI", fatherName: "LINGRAJ GAURI" },
  { name: "SANKARSAN SANKARA",  fatherName: "LINGRAJ GAURI" },
  { name: "GOWARDHAN MOGRA",    fatherName: "LINGRAJ GAURI" },
  { name: "JANARDAN MAYA",      fatherName: "LINGRAJ GAURI" },
  { name: "MINKETAN BHAGMATI", fatherName: "LINGRAJ GAURI" },
  { name: "GAJANAND KHIRODHARI", fatherName: "LINGRAJ GAURI" },
  { name: "MADUSUDAN",          fatherName: "LINGRAJ GAURI" },

  // ── Generation 8 ──────────────────────────────────────────────────────────
  { name: "SUBHASH",             isDeceased: true, honorific: "Late", fatherName: "KARUNAKAR" },
  { name: "GOKUL",               fatherName: "KARUNAKAR" },
  { name: "HRISHIKESH",          fatherName: "MURLIDHAR" },
  { name: "KANHYA",              fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "YUDHISTIR",           fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "SUSHIL SHAILENDRI",   isDeceased: true, honorific: "Late", fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "SURENDRA",            fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "BANISH",              fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "DURGACHARAN",         fatherName: "SANATAN PRATIVA SEWTI" },
  { name: "PITAMBAR UMA",        fatherName: "SANKARSAN SANKARA" },
  { name: "SUKLAMBAR URKULI",    isDeceased: true, honorific: "Late", fatherName: "JANARDAN MAYA" },
  { name: "MAHESEWAR SAFED",     isDeceased: true, honorific: "Late", fatherName: "JANARDAN MAYA" },
  { name: "SHRADHAKAR SHAILENDRI", isDeceased: true, honorific: "Late", fatherName: "JANARDAN MAYA" },
  { name: "CHANDRASEKHAR",       fatherName: "MINKETAN BHAGMATI" },

  // ── Generation 9 ──────────────────────────────────────────────────────────
  { name: "GAJENDRA",    fatherName: "SUBHASH" },
  { name: "HARSHWARDHAN", fatherName: "SUBHASH" },
  { name: "MAHENDRA",    fatherName: "SUBHASH" },
  { name: "PRATAP",      fatherName: "GOKUL" },
  { name: "PRANAV",      fatherName: "GOKUL" },
  { name: "DOBERRAJ",    fatherName: "SUSHIL SHAILENDRI" },
  { name: "OMPRAKASH",   fatherName: "PITAMBAR UMA" },
  { name: "ANIL",        fatherName: "PITAMBAR UMA" },
  { name: "ANUP",        fatherName: "SUKLAMBAR URKULI" },
  { name: "DINESH",      fatherName: "SUKLAMBAR URKULI" },
  { name: "RAMESH SIKHA", fatherName: "MAHESEWAR SAFED" },
  { name: "SUDHIR",      fatherName: "SHRADHAKAR SHAILENDRI" },
  { name: "SANJAY",      fatherName: "SHRADHAKAR SHAILENDRI" },

  // ── Generation 10 (leaf nodes) ────────────────────────────────────────────
  { name: "PRATWA",  fatherName: "GAJENDRA" },   // image: PRATWA
  { name: "PARTH",   fatherName: "MAHENDRA" },
  { name: "SUBHAM",  fatherName: "OMPRAKASH" },
  { name: "RAJU",    fatherName: "RAMESH SIKHA" }
];

// ─────────────────────────────────────────────────────────────────────────────

async function runImport() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const nameToIdMap = {};
    let created = 0, updated = 0, skipped = 0;

    // ── Pass 1: Upsert all members ───────────────────────────────────────────
    console.log('📋 Pass 1: Creating / verifying members...');
    for (const data of membersData) {
      const escapedName = data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let member = await Member.findOne({ name: new RegExp('^' + escapedName + '$', 'i') });

      if (!member) {
        member = new Member({
          name: data.name,
          isDeceased: data.isDeceased || false,
          honorific: data.honorific || '',
          isFamilyTreeOnly: true,   // keep out of main member directory
          isApproved: true
        });
        await member.save();
        console.log(`  ➕ Created : ${data.name}`);
        created++;
      } else {
        // Patch deceased / honorific if missing
        let dirty = false;
        if (data.isDeceased && !member.isDeceased) {
          member.isDeceased = true;
          member.honorific  = data.honorific || 'Late';
          dirty = true;
        }
        if (!member.isFamilyTreeOnly) {
          member.isFamilyTreeOnly = true;
          dirty = true;
        }
        if (dirty) {
          await member.save();
          console.log(`  ✏️  Updated : ${data.name}`);
          updated++;
        } else {
          console.log(`  ℹ️  Exists  : ${data.name}`);
          skipped++;
        }
      }
      nameToIdMap[data.name.toUpperCase()] = member._id;
    }

    // ── Pass 2: Link relationships ───────────────────────────────────────────
    console.log('\n🔗 Pass 2: Linking parent → child relationships...');
    let linked = 0, missing = 0;
    for (const data of membersData) {
      if (!data.fatherName) continue;

      const memberId = nameToIdMap[data.name.toUpperCase()];
      const fatherId  = nameToIdMap[data.fatherName.toUpperCase()];

      if (memberId && fatherId) {
        await Member.findByIdAndUpdate(memberId, { father: fatherId });
        await Member.findByIdAndUpdate(fatherId, { $addToSet: { children: memberId } });
        console.log(`  🔗 ${data.fatherName}  ──►  ${data.name}`);
        linked++;
      } else {
        console.warn(`  ⚠️  Missing reference: "${data.fatherName}" for child "${data.name}"`);
        missing++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅  Import summary`);
    console.log(`    Created  : ${created}`);
    console.log(`    Updated  : ${updated}`);
    console.log(`    Skipped  : ${skipped}`);
    console.log(`    Links    : ${linked}`);
    if (missing) console.log(`    ⚠️  Missing: ${missing}`);
    console.log('═══════════════════════════════════════');
    console.log('🎉  Family tree import complete!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Import error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runImport();
