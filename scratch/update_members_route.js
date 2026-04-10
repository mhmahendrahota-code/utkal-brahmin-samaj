const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../routes/members.js');
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const startIdx = 97; // Line 98
const endIdx = 105;   // Line 106

const newContentLines = [
'      matrimonialProfile: {',
'        isEligible: true,',
'        isApproved: false,',
'        isMatrimonialRequest: true,',
'        dateOfBirth: req.body.dateOfBirth,',
'        educationLevel: req.body.educationLevel,',
'        education: req.body.education || \'\',',
'        height: req.body.height || \'\',',
'        annualIncome: req.body.annualIncome || \'\',',
'        expectations: req.body.expectations || \'\',',
'        fatherOccupation: req.body.fatherOccupation || \'\',',
'        brothers: parseInt(req.body.brothers) || 0,',
'        sisters: parseInt(req.body.sisters) || 0,',
'        bio: req.body.bio || \'\'',
'      }'
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newContentLines);

fs.writeFileSync(file, lines.join('\n'));
console.log('Successfully updated routes/members.js using line indexes');
