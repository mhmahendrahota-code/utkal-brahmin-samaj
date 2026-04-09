require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Member = require('../models/Member');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';

// Extract data from run_import to know exactly who is wife and who is husband
const familyData = [
  { husband: 'Fakir',        wife: 'Malti',       isDeceased: true, honorific: 'Late' },
  { husband: 'Sobhnath',     wife: null,           fatherKey: 'Fakir',       isDeceased: true, honorific: 'Late' },
  { husband: 'Bhikhari',     wife: 'Sunaphool',    fatherKey: 'Fakir',       isDeceased: true, honorific: 'Late' },
  { husband: 'Kanhai',       wife: null,           fatherKey: 'Fakir' },
  { husband: 'Krishna',      wife: null,           fatherKey: 'Sobhnath' },
  { husband: 'Shankarshan',  wife: null,           fatherKey: 'Fakir' },
  { husband: 'Trilochan',    wife: 'Mukta',        fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Lachhindra',   wife: 'Yashoda',      fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Jageshwar',    wife: 'Sita',         fatherKey: 'Bhikhari',    isDeceased: true, honorific: 'Late' },
  { husband: 'Ghanshyam',    wife: null,           fatherKey: 'Kanhai' },
  { husband: 'Gangadhar',    wife: null,           fatherKey: 'Shankarshan' },
  { husband: 'Vanmali',      wife: 'Satyawati',    fatherKey: 'Trilochan',   isDeceased: true, honorific: 'Late' },
  { husband: 'Kripasindhu',  wife: 'Rahilaxmi',    fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Bhuvneshwar',  wife: 'Rahi',         fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Narayan',      wife: 'Hemwati',      fatherKey: 'Lachhindra',  isDeceased: true, honorific: 'Late' },
  { husband: 'Arjun',        wife: 'Tripura',      fatherKey: 'Lachhindra' },
  { husband: 'Sudarshan',    wife: null,           fatherKey: 'Lachhindra' }, 
  { husband: 'Manbodh',      wife: null,           fatherKey: 'Gangadhar' },
  { husband: 'Kritiwas',     wife: null,           fatherKey: 'Vanmali' },
  { husband: 'Sudarshan2',   wife: 'Satyabhama',   fatherKey: 'Vanmali',     isDeceased: true, honorific: 'Late', displayName: 'Sudarshan' },  
  { husband: 'Satrughan',    wife: null,           fatherKey: 'Vanmali' },
  { husband: 'Siddheswar',   wife: 'Harawati',     fatherKey: 'Kripasindhu', isDeceased: true, honorific: 'Late' },
  { husband: 'Sripati',      wife: 'Subhadra',     fatherKey: 'Bhuvneshwar' },
  { husband: 'Lingraj',      wife: 'Gauri',        fatherKey: 'Narayan',     isDeceased: true, honorific: 'Late' },
  { husband: 'Upendra',      wife: 'Parvati',      fatherKey: 'Arjun' },
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
  { husband: 'Shradhakar',   wife: 'Shailendri2',  fatherKey: 'Janardan',    isDeceased: true, honorific: 'Late', wifeName: 'Shailendri' },  
  { husband: 'Chandrashekhar', wife: null,         fatherKey: 'Minketan' },
  { husband: 'Karunakar',    wife: 'Gandharvi',    fatherKey: 'Brajabandhu' },
  { husband: 'Murlidhar',    wife: null,           fatherKey: 'Brajabandhu' },
  { husband: 'Dheeraj',      wife: null,           fatherKey: 'Sushil' },       
  { husband: 'Omprakash',    wife: 'Savitri',      fatherKey: 'Pitambar' },
  { husband: 'Anil',         wife: 'Poornima',     fatherKey: 'Sankarsan' },
  { husband: 'Anup',         wife: null,           fatherKey: 'Suklambar' },
  { husband: 'Dinesh',       wife: null,           fatherKey: 'Suklambar' },
  { husband: 'Ramesh',       wife: 'Sikha',        fatherKey: 'Maheshwar' },
  { husband: 'Raju',         wife: null,           fatherKey: 'Maheshwar' },
  { husband: 'Sudhir',       wife: null,           fatherKey: 'Shradhakar' },
  { husband: 'Sanjay',       wife: null,           fatherKey: 'Shradhakar' },
  { husband: 'Subhash',      wife: 'Manorama',     fatherKey: 'Karunakar',   isDeceased: true, honorific: 'Late' },
  { husband: 'Gokul',        wife: 'Gandharvi2',   fatherKey: 'Karunakar', wifeName: 'Gandharvi' },  
  { husband: 'Hrishikesh',   wife: null,           fatherKey: 'Murlidhar' },
  { husband: 'Subham',       wife: null,           fatherKey: 'Omprakash' },
  { husband: 'Gajendra',     wife: null,           fatherKey: 'Subhash' },
  { husband: 'Harshwardhan', wife: 'Jyoti',        fatherKey: 'Subhash' },
  { husband: 'Mahendra',     wife: 'Gyaneshwari',  fatherKey: 'Subhash' },
  { husband: 'Pratap',       wife: null,           fatherKey: 'Gokul' },
  { husband: 'Pranav',       wife: null,           fatherKey: 'Gokul' },
  { husband: 'Prajwal',      wife: null,           fatherKey: 'Gajendra' },
  { husband: 'Parth',        wife: null,           fatherKey: 'Mahendra' },
];

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  
  let wCount = 0;
  let hCount = 0;

  for (const entry of familyData) {
    // 1. Process Husband (Male)
    const husbandName = entry.displayName || entry.husband;
    const hDocs = await Member.find({ name: new RegExp('^' + husbandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
    for (const doc of hDocs) {
      if (!doc.gender || !doc.honorific) {
        doc.gender = 'Male';
        if (!doc.honorific) doc.honorific = doc.isDeceased ? 'Late' : 'Shri';
        // Auto-fix Shri/Late if not matching
        if (doc.honorific !== 'Late' && doc.honorific !== 'Shri') {
            doc.honorific = 'Shri';
        }
        await doc.save();
        hCount++;
      }
    }

    // 2. Process Wife (Female)
    if (entry.wife) {
      const wifeName = entry.wifeName || entry.wife;
      const wDocs = await Member.find({ name: new RegExp('^' + wifeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
      for (const doc of wDocs) {
        if (!doc.gender || doc.gender !== 'Female' || !doc.honorific || (doc.honorific !== 'Smt.' && doc.honorific !== 'Late')) {
          doc.gender = 'Female';
          if (!doc.honorific) doc.honorific = doc.isDeceased ? 'Late' : 'Smt.';
          if (doc.honorific !== 'Late' && doc.honorific !== 'Smt.') {
            doc.honorific = 'Smt.';
          }
          await doc.save();
          wCount++;
        }
      }
    }
  }

  // Also catch anyone we missed who is listed as 'mother' of someone
  const allMembers = await Member.find({});
  for (const m of allMembers) {
    if (m.mother) {
        await Member.findByIdAndUpdate(m.mother, { gender: 'Female' });
    }
    if (m.father) {
        await Member.findByIdAndUpdate(m.father, { gender: 'Male' });
    }
  }

  console.log(`✅ Updated ${wCount} wives to Female/Smt.`);
  console.log(`✅ Updated ${hCount} husbands to Male/Shri.`);

  process.exit();
}

run().catch(console.error);
