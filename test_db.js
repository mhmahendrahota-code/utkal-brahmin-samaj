const Member = require('./models/Member');

async function test() {
  try {
    console.log("Fetching members...");
    const members = await Member.find().sort({ name: 1 });
    console.log("Output Length:", members.length);
    if(members.length > 0) {
      console.log("First element:", members[0].name);
    }
  } catch(err) {
    console.error("Crash during find:", err);
  }
}

test();
