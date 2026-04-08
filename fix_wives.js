const mongoose = require('mongoose');
const Member = require('./models/Member');

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pusaur-utkal-brahmin-samaj');
  try {
    const karunakar = await Member.findOne({ name: /karunakar/i });
    const gokul = await Member.findOne({ name: /gokul/i });
    
    console.log('Karunakar:', karunakar ? karunakar.name : 'Not found');
    console.log('Gokul:', gokul ? gokul.name : 'Not found');
    
    if (karunakar && karunakar.spouse) {
        const spouse = await Member.findById(karunakar.spouse);
        console.log('Karunakar Spouse:', spouse ? spouse.name : 'Not found', spouse ? spouse._id : '');
    }
    if (gokul && gokul.spouse) {
        const spouse = await Member.findById(gokul.spouse);
        console.log('Gokul Spouse:', spouse ? spouse.name : 'Not found', spouse ? spouse._id : '');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fix();
