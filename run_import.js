/**
 * run_import.js — Family tree import (Hota family - from Google Sheet)
 *
 * SOURCE: Google Sheets "final family tree data of hota family"
 * URL: https://docs.google.com/spreadsheets/d/1u87hzd1Z5uuFIQ2GMjoP2KqrOdDxg72kah5peO1tjBI
 *
 * RULES:
 *   - Surname  : Hota  (all members)
 *   - Gotra    : Jat Konenya  (all members)
 *   - 2-word name entries → word[0]=husband, word[1..]=wife
 *   - Children link to the HUSBAND as father
 *
 * Usage: node run_import.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member   = require('./models/Member');

const MONGODB_URI    = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
const FAMILY_SURNAME = 'Hota';
const FAMILY_GOTRA   = 'Jat Konenya';

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE DATA — from Google Sheet (70 entries)
// Format: { husband, wife?, fatherKey?, isDeceased?, honorific? }
// fatherKey = husband name of parent (or "HUSBAND & WIFE" style reference)
// ─────────────────────────────────────────────────────────────────────────────
const familyData = [

  // ── Gen 1 – Root ────────────────────────────────────────────────────────
  { husband: 'Fakir',        wife: 'Malti',       isDeceased: true, honorific: 'Late' },

  // ── Gen 2 ───────────────────────────────────────────────────────────────
  { husband: 'Sobhnath',     wife: null,           fatherKey: 'Fakir',       isDeceased: true, honorific: 'Late' },
  { husband: 'Bhikhari',     wife: 'Sunaphool',    fatherKey: 'Fakir',       isDeceased: true, honorific: 'Late' },
  { husband: 'Kanhai',       wife: null,           fatherKey: 'Fakir' },

  // ── Gen 3 ───────────────────────────────────────────────────────────────
  { husband: 'Krishna',      wife: null,           fatherKey: 'Sobhnath' },
  { husband: 'Shankarshan',  wife: null,           fatherKey: 'Fakir' },   // son of Fakir (sheet says Gen 3 grandson via Kanhai? — sheet Gen=3)
  { husband: 'Trilochan',    wife: 'Mukta',        fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Lachhindra',   wife: 'Yashoda',      fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Jageshwar',    wife: 'Sita',         fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Ghanshyam',    wife: null,           fatherKey: 'Kanhai' },
  { husband: 'Gangadhar',    wife: null,           fatherKey: 'Shankarshan' },

  // ── Gen 4 ───────────────────────────────────────────────────────────────
  { husband: 'Vanmali',      wife: 'Satyawati',    fatherKey: 'Trilochan',   isDeceased: true, honorific: 'Late' },
  { husband: 'Kripasindhu',  wife: 'Rahilaxmi',    fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Bhuvneshwar',  wife: 'Rahi',         fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Narayan',      wife: 'Hemwati',      fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Arjun',        wife: 'Tripura',      fatherKey: 'Lachhindra' },
  { husband: 'Sudarshan',    wife: null,           fatherKey: 'Lachhindra' },  // single Sudarshan (Gen 4)
  { husband: 'Manbodh',      wife: null,           fatherKey: 'Gangadhar' },

  // ── Gen 5 ───────────────────────────────────────────────────────────────
  { husband: 'Kritiwas',     wife: null,           fatherKey: 'Vanmali' },
  { husband: 'Sudarshan2',   wife: 'Satyabhama',   fatherKey: 'Vanmali',     isDeceased: true, honorific: 'Late',
    displayName: 'Sudarshan' },  // different Sudarshan (Gen 5)
  { husband: 'Satrughan',    wife: null,           fatherKey: 'Vanmali' },
  { husband: 'Siddheswar',   wife: 'Harawati',     fatherKey: 'Kripasindhu', isDeceased: true, honorific: 'Late' },
  { husband: 'Sripati',      wife: 'Subhadra',     fatherKey: 'Bhuvneshwar' },
  { husband: 'Lingraj',      wife: 'Gauri',        fatherKey: 'Narayan',     isDeceased: true, honorific: 'Late' },
  { husband: 'Upendra',      wife: 'Parvati',      fatherKey: 'Arjun' },

  // ── Gen 6 ───────────────────────────────────────────────────────────────
  { husband: 'Dhanurjaya',   wife: null,           fatherKey: 'Sudarshan2' },
  { husband: 'Sahadev',      wife: 'Urvashi',      fatherKey: 'Sudarshan2' },
  { husband: 'Vrindavan',    wife: null,           fatherKey: 'Sudarshan2' },
  { husband: 'Sanatan',      wife: 'Praksya Sewti', fatherKey: 'Lingraj' },
  { husband: 'Sankarsan',    wife: 'Sankara',      fatherKey: 'Lingraj' },
  { husband: 'Gowardhan',    wife: 'Mogra',        fatherKey: 'Lingraj' },
  { husband: 'Janardan',     wife: 'Maya',         fatherKey: 'Lingraj' },
  { husband: 'Minketan',     wife: 'Bhagmati',     fatherKey: 'Lingraj' },
  { husband: 'Gajanand',     wife: 'Khirodhari',   fatherKey: 'Lingraj' },
  { husband: 'Madusudan',    wife: null,           fatherKey: 'Lingraj' },

  // ── Gen 7 ───────────────────────────────────────────────────────────────
  { husband: 'Shiv Prashad', wife: null,           fatherKey: 'Dhanurjaya' },
  { husband: 'Brajabandhu',  wife: 'Priyowati',    fatherKey: 'Siddheswar',  isDeceased: true, honorific: 'Late' },
  { husband: 'Kanhya',       wife: null,           fatherKey: 'Sanatan' },
  { husband: 'Yudhistir',    wife: null,           fatherKey: 'Sanatan' },
  { husband: 'Sushil',       wife: 'Shailendri',   fatherKey: 'Sanatan',     isDeceased: true, honorific: 'Late' },
  { husband: 'Surendra',     wife: null,           fatherKey: 'Sanatan' },
  { husband: 'Ganesh',       wife: null,           fatherKey: 'Sanatan' },
  { husband: 'Durgacharan',  wife: null,           fatherKey: 'Sanatan' },
  { husband: 'Pitambar',     wife: 'Uma',          fatherKey: 'Sankarsan' },
  { husband: 'Suklambar',    wife: 'Urkuli',       fatherKey: 'Janardan',    isDeceased: true, honorific: 'Late' },
  { husband: 'Maheshwar',    wife: 'Safed',        fatherKey: 'Janardan',    isDeceased: true, honorific: 'Late' },
  { husband: 'Shradhakar',   wife: 'Shailendri2',  fatherKey: 'Janardan',    isDeceased: true, honorific: 'Late',
    wifeName: 'Shailendri' },  // different Shailendri from Sushil's wife
  { husband: 'Chandrashekhar', wife: null,         fatherKey: 'Minketan' },

  // ── Gen 8 ───────────────────────────────────────────────────────────────
  { husband: 'Karunakar',    wife: 'Gandharvi',    fatherKey: 'Brajabandhu' },
  { husband: 'Murlidhar',    wife: null,           fatherKey: 'Brajabandhu' },
  { husband: 'Dheeraj',      wife: null,           fatherKey: 'Sushil' },       // was "DOBERRAJ" in old data
  { husband: 'Omprakash',    wife: 'Savitri',      fatherKey: 'Pitambar' },
  { husband: 'Anil',         wife: 'Poornima',     fatherKey: 'Sankarsan' },
  { husband: 'Anup',         wife: null,           fatherKey: 'Suklambar' },
  { husband: 'Dinesh',       wife: null,           fatherKey: 'Suklambar' },
  { husband: 'Ramesh',       wife: 'Sikha',        fatherKey: 'Maheshwar' },
  { husband: 'Raju',         wife: null,           fatherKey: 'Maheshwar' },
  { husband: 'Sudhir',       wife: null,           fatherKey: 'Shradhakar' },
  { husband: 'Sanjay',       wife: null,           fatherKey: 'Shradhakar' },

  // ── Gen 9 ───────────────────────────────────────────────────────────────
  { husband: 'Subhash',      wife: 'Manorama',     fatherKey: 'Karunakar',   isDeceased: true, honorific: 'Late' },
  { husband: 'Gokul',        wife: 'Gandharvi2',   fatherKey: 'Karunakar',
    wifeName: 'Gandharvi' },  // different Gandharvi from Karunakar's wife
  { husband: 'Hrishikesh',   wife: null,           fatherKey: 'Murlidhar' },
  { husband: 'Subham',       wife: null,           fatherKey: 'Omprakash' },

  // ── Gen 10 ──────────────────────────────────────────────────────────────
  { husband: 'Gajendra',     wife: null,           fatherKey: 'Subhash' },
  { husband: 'Harshwardhan', wife: 'Jyoti',        fatherKey: 'Subhash' },
  { husband: 'Mahendra',     wife: 'Gyaneshwari',  fatherKey: 'Subhash' },
  { husband: 'Pratap',       wife: null,           fatherKey: 'Gokul' },
  { husband: 'Pranav',       wife: null,           fatherKey: 'Gokul' },

  // ── Gen 11 ──────────────────────────────────────────────────────────────
  { husband: 'Prajwal',      wife: null,           fatherKey: 'Gajendra' },
  { husband: 'Parth',        wife: null,           fatherKey: 'Mahendra' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findOrCreateMember(name, extra = {}) {
  const regex  = new RegExp('^' + escapeRegex(name) + '$', 'i');
  let member   = await Member.findOne({ name: regex });
  if (!member) {
    member = new Member({
      name,
      surname          : FAMILY_SURNAME,
      gotra            : FAMILY_GOTRA,
      isFamilyTreeOnly : true,
      isApproved       : true,
      ...extra,
    });
    await member.save();
    return { member, isNew: true };
  }
  // Patch missing fields
  let dirty = false;
  if (!member.surname)          { member.surname = FAMILY_SURNAME; dirty = true; }
  if (!member.gotra)            { member.gotra   = FAMILY_GOTRA;   dirty = true; }
  if (!member.isFamilyTreeOnly) { member.isFamilyTreeOnly = true;   dirty = true; }
  if (extra.isDeceased && !member.isDeceased) {
    member.isDeceased = true;
    member.honorific  = extra.honorific || 'Late';
    dirty = true;
  }
  if (dirty) await member.save();
  return { member, isNew: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main import
// ─────────────────────────────────────────────────────────────────────────────
async function runImport() {
  console.log('🔌 Connecting to MongoDB Atlas...');
  console.log('   URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS : 30000,
    socketTimeoutMS          : 45000,
    connectTimeoutMS         : 30000,
  });
  console.log('✅ Connected!\n');

  // husbandKeyToId: internal key (e.g., "Sudarshan2") → _id of the husband member
  const husbandKeyToId = {};
  let created = 0, skipped = 0;

  // ── Pass 1: Create all members ───────────────────────────────────────────
  console.log('👤 Pass 1 — Creating members...\n');
  for (const entry of familyData) {
    const husbandDisplayName = entry.displayName || entry.husband;

    // Create husband
    const { member: h, isNew: hNew } = await findOrCreateMember(husbandDisplayName, {
      isDeceased: entry.isDeceased || false,
      honorific : entry.honorific  || '',
    });
    if (hNew) { console.log(`  ➕ [H] ${husbandDisplayName}`); created++; }
    else       { console.log(`  ℹ️  [H] ${husbandDisplayName}`); skipped++; }

    husbandKeyToId[entry.husband] = h._id;  // key may differ from displayName

    // Create wife
    if (entry.wife) {
      const wifeName = entry.wifeName || entry.wife;
      const { member: w, isNew: wNew } = await findOrCreateMember(wifeName, {
        isDeceased: false,
        honorific : '',
      });
      if (wNew) { console.log(`  ➕ [W] ${wifeName}`); created++; }
      else       { console.log(`  ℹ️  [W] ${wifeName}`); skipped++; }

      // Link spouses if not already linked
      if (!h.spouse) {
        await Member.findByIdAndUpdate(h._id, { spouse: w._id, spouseName: wifeName });
        await Member.findByIdAndUpdate(w._id, { spouse: h._id, spouseName: husbandDisplayName });
        console.log(`  💍 Linked: ${husbandDisplayName} ↔ ${wifeName}`);
      }
    }
  }

  // ── Pass 2: Link parent → child ──────────────────────────────────────────
  console.log('\n🔗 Pass 2 — Linking relationships...\n');
  let linked = 0, missing = 0;

  for (const entry of familyData) {
    if (!entry.fatherKey) continue;

    const husbandDisplayName = entry.displayName || entry.husband;
    const childId  = husbandKeyToId[entry.husband];
    const fatherId = husbandKeyToId[entry.fatherKey];

    if (childId && fatherId) {
      await Member.findByIdAndUpdate(childId,  { father: fatherId });
      await Member.findByIdAndUpdate(fatherId, { $addToSet: { children: childId } });
      const fatherDisplay = familyData.find(e => e.husband === entry.fatherKey)?.displayName || entry.fatherKey;
      console.log(`  🔗 ${fatherDisplay}  →  ${husbandDisplayName}`);
      linked++;
    } else {
      console.warn(`  ⚠️  Cannot link "${husbandDisplayName}" — parent key "${entry.fatherKey}" not found`);
      missing++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const coupleCount  = familyData.filter(e => e.wife).length;
  const singleCount  = familyData.length - coupleCount;
  const totalExpected = familyData.length + coupleCount; // husbands + wives

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅  Import Complete!');
  console.log(`    Entries  : ${familyData.length}  (${coupleCount} couples + ${singleCount} singles)`);
  console.log(`    Members expected : ~${totalExpected}  (incl. wives)`);
  console.log(`    Created  : ${created}`);
  console.log(`    Skipped  : ${skipped}  (already in DB)`);
  console.log(`    Links    : ${linked}`);
  if (missing) console.log(`    ⚠️  Missing parent refs : ${missing}`);
  console.log('══════════════════════════════════════════════════════');
  console.log('🎉  Family tree is ready!');

  await mongoose.disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
runImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Import failed:', err.message);
    if (err.name === 'MongoServerSelectionError') {
      console.error('\n💡 Cannot reach MongoDB Atlas.');
      console.error('   → Check internet connection');
      console.error('   → Whitelist your IP: https://cloud.mongodb.com → Network Access → Add IP');
    }
    process.exit(1);
  });
