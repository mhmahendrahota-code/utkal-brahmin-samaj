const express = require('express');
const router = express.Router();
const Member = require('../models/Member');

// GET all members (Directory)
router.get('/', async (req, res) => {
  try {
    const { search, village } = req.query;
    let query = {};
    
    if (search) {
      query.name = new RegExp(search, 'i');
    }
    if (village) {
      query.village = new RegExp(village, 'i');
    }
    
    const members = await Member.find(query).sort({ name: 1 });
    res.render('members/directory', { 
      title: 'Member Directory',
      members,
      searchQuery: search || '',
      villageQuery: village || ''
    });
  } catch (err) {
    console.error('Database connection issue:', err.message);
    res.render('members/directory', { 
      title: 'Member Directory',
      members: [],
      searchQuery: req.query.search || '',
      villageQuery: req.query.village || ''
    });
  }
});

// Middleware to check if user has community access
const checkCommunityAccess = (req, res, next) => {
  if (req.session && req.session.isCommunityMember) {
    return next();
  }
  res.redirect('/members/matrimonial/login');
};

// Matrimonial Login (Privacy Wall)
router.get('/matrimonial/login', (req, res) => {
  res.render('members/matrimonial-login', { title: 'Community Access Required', error: null });
});

router.post('/matrimonial/login', (req, res) => {
  // Simple mock PIN for community members
  if (req.body.pin === 'OM108') {
    req.session.isCommunityMember = true;
    res.redirect('/members/matrimonial');
  } else {
    res.render('members/matrimonial-login', { title: 'Community Access Required', error: 'Invalid PIN. Please ask a committee member for the correct PIN.' });
  }
});

// Matrimonial listing (Protected)
router.get('/matrimonial', checkCommunityAccess, async (req, res) => {
  try {
    let query = { 'matrimonialProfile.isEligible': true, 'matrimonialProfile.isApproved': true };
    
    // Matchmaking filters
    if (req.query.education) query['matrimonialProfile.education'] = new RegExp(req.query.education, 'i');
    
    // Excluding Gotra (e.g., if looking for non-Kashyap matches)
    if (req.query.excludeGotra) query.gotra = { $ne: req.query.excludeGotra };
    
    const profiles = await Member.find(query).sort({ 'matrimonialProfile.dateOfBirth': -1 });

    // Fetch all unique gotras from ALL eligible profiles (for the filter dropdown)
    const allEligible = await Member.find({ 'matrimonialProfile.isEligible': true, 'matrimonialProfile.isApproved': true });
    const availableGotras = [...new Set(allEligible.map(p => p.gotra).filter(Boolean))].sort();

    res.render('members/matrimonial', { title: 'Matrimonial Candidates', profiles, searchFilters: req.query, availableGotras });
  } catch (err) {
    res.render('members/matrimonial', { title: 'Matrimonial Candidates', profiles: [], searchFilters: req.query, availableGotras: [] });
  }
});

// Profile submission (Form) - Publicly accessible to submit
router.get('/matrimonial/submit', (req, res) => {
  res.render('members/matrimonial-submit', { title: 'Submit Profile' });
});

router.post('/matrimonial/submit', async (req, res) => {
  try {
    const newMember = new Member({
      name: req.body.name,
      gotra: req.body.gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      address: req.body.address,
      matrimonialProfile: {
        isEligible: true,
        isApproved: false, // Must be approved by admin
        dateOfBirth: req.body.dateOfBirth,
        education: req.body.education,
        height: req.body.height
      }
    });
    // In a setup with no DB, this will fail. Route will catch.
    await newMember.save();
    res.redirect('/members/matrimonial');
  } catch (err) {
    console.error('Database connection issue:', err.message);
    res.redirect('/members/matrimonial');
  }
});

// Public Self-Registration
router.get('/add', (req, res) => {
  res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: false, error: null });
});

router.post('/add', async (req, res) => {
  try {
    const newMember = new Member({
      name: req.body.name,
      gotra: req.body.gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      isApproved: false // Pending admin review
    });
    await newMember.save();
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: true, error: null });
  } catch (err) {
    console.error('Member registration error:', err.message);
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: false, error: 'Something went wrong. Please try again.' });
  }
});

// Individual Member Profile Page
router.get('/:id', async (req, res, next) => {
  // Prevent catching hardcoded routes
  if(['matrimonial', 'matrimonial/login', 'matrimonial/submit', 'add'].includes(req.params.id)) {
    return next();
  }
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).send('Member not found');
    res.render('members/profile', { title: `${member.name}'s Profile`, member });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
