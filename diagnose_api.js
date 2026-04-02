const mongoose = require('mongoose');
const Member = require('./models/Member');
require('dotenv').config();

async function testApi() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj');
        console.log('Connected.');

        const allMembers = await Member.find({}).lean();
        console.log(`Found ${allMembers.length} members.`);

        const treeNodes = allMembers.map(m => {
            try {
                const node = {
                    id: m._id.toString(),
                    name: m.name,
                    title: (m.honorific ? m.honorific + ' ' : '') + (m.occupation || 'Member'),
                    village: m.village || '',
                    image: m.profileImage || '/images/default-avatar.png',
                    contactNumber: m.contactNumber || '',
                    email: m.email || '',
                    address: m.address || '',
                    gotra: m.gotra || '',
                    deathDate: (m.deathDate && m.deathDate.toISOString) ? m.deathDate.toISOString().split('T')[0] : (m.deathDate || ''),
                    tags: []
                };
                if (m.isDeceased) node.tags.push('deceased');
                if (m.father) { node.fatherId = m.father.toString(); node.pid = m.father.toString(); }
                if (m.mother) { node.motherId = m.mother.toString(); if (!node.pid) node.pid = m.mother.toString(); }
                if (m.spouse) node.stpid = m.spouse.toString();
                return node;
            } catch (err) {
                console.error(`Error mapping member ${m._id}:`, err);
                throw err;
            }
        });

        console.log('JSON conversion test...');
        JSON.stringify(treeNodes);
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Diagnostic failed:', err);
        process.exit(1);
    }
}

testApi();
