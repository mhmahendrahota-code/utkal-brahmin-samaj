const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Surname = require('../models/Surname');

// GET all members (Directory)
router.get('/', async (req, res) => {
  try {
    const { search, village } = req.query;
    let query = { isDeceased: { $ne: true }, isFamilyTreeOnly: { $ne: true } }; // ONLY active members in directory
    
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
router.get('/matrimonial/submit', async (req, res) => {
  try {
    const surnames = await Surname.find().sort({ surname: 1 });
    res.render('members/matrimonial-submit', { title: 'Submit Profile', surnames });
  } catch (err) {
    res.render('members/matrimonial-submit', { title: 'Submit Profile', surnames: [] });
  }
});

router.post('/matrimonial/submit', async (req, res) => {
  try {
    const newMember = new Member({
      name: req.body.name,
      surname: req.body.surname_select === 'Others' ? req.body.surname_other : req.body.surname_select,
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
router.get('/add', async (req, res) => {
  try {
    const surnames = await Surname.find().sort({ surname: 1 });
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: false, error: null, surnames });
  } catch (err) {
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: false, error: null, surnames: [] });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { 
      honorific, name, surname_select, surname_other, gotra_select, gotra_custom,
      gender, dob, bloodGroup, village, fatherName, motherName, spouseName,
      education, occupation, contactNumber, email, address 
    } = req.body;

    const finalSurname = surname_select === 'Others' ? surname_other : surname_select;
    const finalGotra = gotra_select === 'Others' ? gotra_custom : gotra_select;

    const newMember = new Member({
      honorific: honorific || '',
      name: name,
      gender: gender,
      surname: finalSurname,
      gotra: finalGotra,
      village: village,
      fatherName: fatherName,
      motherName: motherName,
      spouseName: spouseName,
      occupation: occupation,
      contactNumber: contactNumber,
      email: email,
      address: address,
      bloodGroup: bloodGroup || '',
      matrimonialProfile: {
        dateOfBirth: dob ? new Date(dob) : null,
        education: education || ''
      },
      isApproved: false // Pending admin review
    });

    await newMember.save();
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: true, error: null });
  } catch (err) {
    console.error('Member registration error:', err.message);
    res.render('members/register', { title: 'समाज में जुड़ें - Join the Samaj', success: false, error: 'Something went wrong. Please try again.' });
  }
});



// Community Full Family Tree
router.get('/community-tree', async (req, res) => {
  try {
    // Fetch EVERYTHING in one query - avoids a second round-trip from the browser
    const allMembers = await Member.find({}).lean();
    
    const availableGotras = [...new Set(allMembers.map(m => m.gotra).filter(Boolean))].sort();

    // Pre-build the node JSON server-side so the browser can render immediately
    const treeNodes = allMembers.map(m => {
      const node = {
        id: m._id.toString(),
        name: m.name + (m.surname ? ' ' + m.surname : ''),
        title: (m.honorific ? m.honorific + ' ' : '') + (m.occupation || 'Member'),
        village: m.village || '',
        image: m.profileImage || '/images/default-avatar.png',
        contactNumber: m.contactNumber || '',
        email: m.email || '',
        address: m.address || '',
        gotra: m.gotra || '',
        surname: m.surname || '',
        gender: m.gender || 'Male',
        deathDate: (m.deathDate && m.deathDate.toISOString) ? m.deathDate.toISOString().split('T')[0] : (m.deathDate || ''),
        generation: 0, // In community view, D3 hierarchy depth is used
        generationLevel: m.generationLevel, 
        tags: []
      };
      if (m.isDeceased) node.tags.push('deceased');
      if (m.father) { node.fatherId = m.father.toString(); node.pid = m.father.toString(); }
      if (m.mother) { node.motherId = m.mother.toString(); if (!node.pid) node.pid = m.mother.toString(); }
      if (m.spouse) node.stpid = m.spouse.toString();
      return node;
    });

    res.render('members/family-tree', { 
      title: 'सम्पूर्ण समाज वंशावली (Community Family Tree)', 
      memberId: 'all',
      availableGotras,
      // Embed tree data directly — browser uses this instead of fetching API
      inlineTreeData: JSON.stringify(treeNodes)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// Family Tree Page
router.get('/family-tree/:id', async (req, res) => {
  if (req.params.id === 'all') {
    return res.redirect('/members/community-tree');
  }
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Invalid Member ID');
    }
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).send('Member not found');
    
    // Fetch gotras for the filter dropdown
    const availableGotras = await Member.distinct('gotra', { gotra: { $ne: null, $ne: '' } });
    
    res.render('members/family-tree', { 
      title: `Family Tree - ${member.name}`, 
      memberId: req.params.id,
      availableGotras: availableGotras.sort()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Family Tree Data API
router.get('/api/family-tree/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    const isFullTree = req.query.mode === 'full';
    const nodes = [];
    const processedIds = new Set();
    const generationMap = new Map(); // Track generation for each member

    // Helper function to calculate generation for a member
    // Walks up/down the family tree to determine generation level
    async function calculateGeneration(memberId, knownGeneration = null) {
      if (generationMap.has(memberId.toString())) {
        return generationMap.get(memberId.toString());
      }

      if (knownGeneration !== null) {
        generationMap.set(memberId.toString(), knownGeneration);
        return knownGeneration;
      }

      // Default: attempt to calculate by walking ancestors
      let generation = 0;
      let currentId = memberId;
      let steps = 0;
      const maxSteps = 20; // Prevent infinite loops

      while (steps < maxSteps) {
        if (currentId.toString() === targetId) {
          generation = -steps; // Found target, calculate distance
          break;
        }

        const member = await Member.findById(currentId).select('father mother').lean();
        if (!member || (!member.father && !member.mother)) break;

        currentId = member.father || member.mother;
        steps++;
      }

      generationMap.set(memberId.toString(), generation);
      return generation;
    }

    // Helper to add a member to the nodes list
    async function addMemberNode(id, explicitGeneration = null) {
      if (!id || processedIds.has(id.toString())) return null;
      processedIds.add(id.toString());

      const member = await Member.findById(id)
        .populate('father')
        .populate('mother')
        .populate('spouse')
        .populate('children')
        .lean();

      if (!member) return null;

      let generation = explicitGeneration;
      if (generation === null) {
        generation = await calculateGeneration(id);
      }

      const node = {
        id: member._id.toString(),
        name: member.name + (member.surname ? ' ' + member.surname : ''),
        gender: member.gender || '',
        title: (member.honorific ? member.honorific + ' ' : '') + (member.occupation || 'Member'),
        village: member.village || '',
        image: member.profileImage || '/images/default-avatar.png',
        contactNumber: member.contactNumber || '',
        email: member.email || '',
        address: member.address || '',
        gotra: member.gotra || '',
        surname: member.surname || '',
        deathDate: (member.deathDate && member.deathDate.toISOString) ? member.deathDate.toISOString().split('T')[0] : (member.deathDate || ''),
        generation: generation, // Relative level for tree layout
        generationLevel: member.generationLevel, // Absolute level from DB
        tags: []
      };

      if (member.isDeceased) node.tags.push('deceased');
      if (id.toString() === targetId) {
        node.tags.push('current');
        generationMap.set(id.toString(), 0); // Target is always gen 0
        node.generation = 0;
      }
      
      // Hierarchy
      if (member.father) {
        node.pid = member.father._id.toString();
        node.fatherId = member.father._id.toString();
      } else if (member.mother) {
        node.pid = member.mother._id.toString();
      }
      
      if (member.mother) {
        node.motherId = member.mother._id.toString();
      }

      // Partner/Spouse - same generation as current member
      if (member.spouse) {
        node.stpid = member.spouse._id.toString();
        generationMap.set(member.spouse._id.toString(), generation);
      }

      nodes.push(node);
      return member;
    }

    if (isFullTree) {
      // FULL TREE MODE: Fetch members matching criteria
      const gotraFilter = req.query.gotra;
      let allMembers = [];
      
      if (gotraFilter && gotraFilter.trim() !== '') {
        // Fetch specific Lineage
        allMembers = await Member.find({ gotra: gotraFilter }).lean();
        // Include spouses who might belong to different gotras
        const spouseIds = allMembers.filter(m => m.spouse).map(m => m.spouse);
        if (spouseIds.length > 0) {
          const spouses = await Member.find({ _id: { $in: spouseIds }, gotra: { $ne: gotraFilter } }).lean();
          allMembers = allMembers.concat(spouses);
        }
      } else {
        // Fetch entire Community
        allMembers = await Member.find({}).lean();
      }

      // Deduplicate members to prevent duplicate nodes (D3 stratify requirement)
      const uniqueMembersMap = new Map();
      allMembers.forEach(m => {
        if (m && m._id) uniqueMembersMap.set(m._id.toString(), m);
      });

      for (const m of uniqueMembersMap.values()) {
        const node = {
          id: m._id.toString(),
          name: m.name + (m.surname ? ' ' + m.surname : ''),
          title: (m.honorific ? m.honorific + ' ' : '') + (m.occupation || 'Member'),
          village: m.village || '',
          image: m.profileImage || '/images/default-avatar.png',
          contactNumber: m.contactNumber || '',
          email: m.email || '',
          address: m.address || '',
          gotra: m.gotra || '',
          surname: m.surname || '',
          deathDate: (m.deathDate && m.deathDate.toISOString) ? m.deathDate.toISOString().split('T')[0] : (m.deathDate || ''),
          generation: 0, // In full tree mode, D3 hierarchy depth is used instead
          tags: []
        };
        if (m.isDeceased) node.tags.push('deceased');
        if (m._id.toString() === targetId) node.tags.push('current');
        
        if (m.father) {
          node.pid = m.father.toString();
          node.fatherId = m.father.toString();
        } else if (m.mother) {
          node.pid = m.mother.toString();
        }
        
        if (m.mother) {
          node.motherId = m.mother.toString();
        }

        if (m.spouse) {
          node.stpid = m.spouse.toString();
        }
        
        nodes.push(node);
      }
    } else {
      // 1. Fetch Target (generation 0)
      const target = await addMemberNode(targetId, 0);
      if (!target) return res.status(404).json({ error: 'Member not found' });

      // 2. Fetch Immediate Ancestors (generation 1)
      const immediatePromises = [];
      if (target.father) immediatePromises.push(addMemberNode(target.father._id, 1));
      if (target.mother) immediatePromises.push(addMemberNode(target.mother._id, 1));
      
      // 3. Fetch Spouse (generation 0)
      if (target.spouse) immediatePromises.push(addMemberNode(target.spouse._id, 0));
      
      // 4. Fetch Children (generation -1)
      if (target.children && target.children.length > 0) {
        target.children.forEach(childId => immediatePromises.push(addMemberNode(childId, -1)));
      }

      const relatives = await Promise.all(immediatePromises);

      // 5. Fetch Siblings (generation 0)
      if (target.father || target.mother) {
        const siblingQuery = { _id: { $ne: targetId } };
        if (target.father && target.mother) {
          siblingQuery.$or = [{ father: target.father._id }, { mother: target.mother._id }];
        } else if (target.father) {
          siblingQuery.father = target.father._id;
        } else {
          siblingQuery.mother = target.mother._id;
        }
        
        const siblings = await Member.find(siblingQuery);
        for (const sib of siblings) {
          await addMemberNode(sib._id, 0);
        }
      }

      // 6. Fetch Grandparents (generation 2)
      for (const rel of relatives) {
        if (rel && (rel._id.toString() === (target.father && target.father._id.toString()) || 
                    rel._id.toString() === (target.mother && target.mother._id.toString()))) {
          if (rel.father) await addMemberNode(rel.father._id, 2);
          if (rel.mother) await addMemberNode(rel.mother._id, 2);
        }
      }

      // 7. Fetch Siblings' Children (generation -1) - nieces/nephews
      const siblingIds = nodes.filter(n => n.generation === 0 && n.id !== targetId).map(n => n.id);
      if (siblingIds.length > 0) {
        const niblingQuery = { father: { $in: siblingIds } };
        const niblingMembers = await Member.find(niblingQuery);
        for (const nm of niblingMembers) {
          // Check if not already added
          if (!processedIds.has(nm._id.toString())) {
            await addMemberNode(nm._id, -1);
          }
        }
      }
    }

    // Deduplicate any final duplicates from nodes (just in case)
    const finalNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
    res.json(finalNodes);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid Member ID' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Individual Member Profile Page
router.get('/:id', async (req, res, next) => {
  // Prevent catching hardcoded routes
  if(['matrimonial', 'matrimonial/login', 'matrimonial/submit', 'add', 'community-tree'].includes(req.params.id)) {
    return next();
  }
  try {
    const member = await Member.findById(req.params.id)
      .populate('father')
      .populate('mother')
      .populate('spouse');
      
    if (!member) return res.status(404).send('Member not found');

    // If admin is logged in, fetch all members for the 'Quick Connect' dropdown
    let allMembers = [];
    if (req.session && req.session.isAdmin) {
      allMembers = await Member.find({ _id: { $ne: req.params.id } }).sort({ name: 1 });
    }

    res.render('members/profile', { 
      title: `${member.name}'s Profile`, 
      member,
      allMembers 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
