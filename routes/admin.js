const express = require('express');
const router = express.Router();

const Member = require('../models/Member');
const Event = require('../models/Event');
const Donation = require('../models/Donation');
const MeetRegistration = require('../models/MeetRegistration');
const StudentApplication = require('../models/StudentApplication');
const AdminUser = require('../models/AdminUser');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    res.locals.adminRole = req.session.adminRole;
    res.locals.adminName = req.session.adminName;
    res.locals.currentAdminId = req.session.adminId;
    return next();
  }
  res.redirect('/admin/login');
};

const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin && req.session.adminRole === 'Super Admin') {
    return next();
  }
  res.status(403).send('Forbidden: Super Admin rights required. Please log in with a Super Admin account.');
};

router.get('/', isAdmin, async (req, res) => {
    try {
    const memberCount = await Member.countDocuments();
    const matrimonialCount = await Member.countDocuments({ 'matrimonialProfile.isEligible': true });
    const eventCount = await Event.countDocuments({ isActive: true });
    const donations = await Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalDonations = donations.length > 0 ? donations[0].total : 0;

    res.render('admin/dashboard', { 
      title: 'Admin Dashboard',
      stats: { members: memberCount, matrimonial: matrimonialCount, events: eventCount, donations: totalDonations }
    });
  } catch (err) {
    res.render('admin/dashboard', { title: 'Admin Dashboard', stats: { members: 0, matrimonial: 0, events: 0, donations: 0 } });
  }
});

// Admin Login Page
router.get('/login', async (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin');
  }

  // Self-healing: if no admins exist, create a default Super Admin from .env
  const admins = await AdminUser.find();
  if (admins.length === 0) {
    const defaultAdmin = new AdminUser({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'password123',
      role: 'Super Admin',
      name: 'Default Admin'
    });
    await defaultAdmin.save();
    console.log('[Setup] Created default Super Admin from .env credentials.');
  }

  res.render('admin/login', { title: 'Admin Login', error: null });
});

// Admin Login Process
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const admins = await AdminUser.find();
  const user = admins.find(a => a.username === username && a.password === password);

  // Fallback to .env if db lookup fails (safety net for development)
  const isEnvAdmin = (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD);

  if (user) {
    req.session.isAdmin = true;
    req.session.adminRole = user.role;
    req.session.adminName = user.name;
    req.session.adminId = user._id;
    res.redirect('/admin');
  } else if (isEnvAdmin) {
    req.session.isAdmin = true;
    req.session.adminRole = 'Super Admin';
    req.session.adminName = 'Root Admin';
    res.redirect('/admin');
  } else {
    res.render('admin/login', { title: 'Admin Login', error: 'Invalid username or password' });
  }
});

router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) console.error('Session destruction error:', err);
      res.redirect('/admin/login');
    });
  } else {
    res.redirect('/admin/login');
  }
});

// Admin Member Management (Directory)
router.get('/members', isAdmin, async (req, res) => {
    try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.render('admin/members', { title: 'Manage Members', members });
  } catch (err) {
    res.render('admin/members', { title: 'Manage Members', members: [] });
  }
});

// ─── Database Explorer ──────────────────────────────────────────────
router.get('/db', isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Announcement = require('../models/Announcement');
    const Committee    = require('../models/Committee');
    const Document     = require('../models/Document');
    const Gallery      = require('../models/Gallery');
    const Message      = require('../models/Message');
    const Settings     = require('../models/Settings');

    const COLLECTIONS = [
      { name: 'members',       label: 'Members',        model: Member },
      { name: 'events',        label: 'Events',         model: Event },
      { name: 'donations',     label: 'Donations',      model: Donation },
      { name: 'announcements', label: 'Announcements',  model: Announcement },
      { name: 'committee',     label: 'Committee',      model: Committee },
      { name: 'documents',     label: 'Documents',      model: Document },
      { name: 'gallery',       label: 'Gallery',        model: Gallery },
      { name: 'messages',      label: 'Messages/Inbox', model: Message },
      { name: 'adminusers',    label: 'Admin Users',    model: AdminUser },
      { name: 'meetregs',      label: 'Meet Registrations', model: MeetRegistration },
      { name: 'studentapps',   label: 'Student Applications', model: StudentApplication },
    ];

    const collections = await Promise.all(
      COLLECTIONS.map(async col => {
        try {
          const [docs, count] = await Promise.all([
            col.model.find({}).lean().limit(200),
            col.model.countDocuments()
          ]);
          // Redact sensitive fields
          const safeDocs = docs.map(d => {
            const obj = { ...d };
            if (obj.password) obj.password = '***';
            if (obj.passwordHash) obj.passwordHash = '***';
            return obj;
          });
          return { name: col.name, label: col.label, docs: safeDocs, count };
        } catch (e) {
          return { name: col.name, label: col.label, docs: [], count: 0 };
        }
      })
    );

    res.render('admin/db-viewer', { title: 'Database Explorer', collections });
  } catch (err) {
    console.error(err);
    res.status(500).send('DB Explorer error: ' + err.message);
  }
});

// ── DB Helper: resolve collection name → Mongoose Model ──────────────
const DB_MODEL_MAP = {
  members:      'Member',
  events:       'Event',
  donations:    'Donation',
  announcements:'Announcement',
  committee:    'Committee',
  documents:    'Document',
  gallery:      'Gallery',
  messages:     'Message',
  adminusers:   'AdminUser',
  meetregs:     'MeetRegistration',
  studentapps:  'StudentApplication',
};
function resolveModel(collection) {
  const mongoose = require('mongoose');
  const modelName = DB_MODEL_MAP[collection];
  if (!modelName) throw new Error(`Unknown collection: ${collection}`);
  return mongoose.model(modelName);
}

// DB Explorer – Update a single document
router.post('/db/update', isAdmin, async (req, res) => {
  try {
    const { collection, id, data } = req.body;
    const parsed = JSON.parse(data);
    delete parsed._id; delete parsed.__v; delete parsed.password; delete parsed.passwordHash;
    const Model = resolveModel(collection);
    await Model.findByIdAndUpdate(id, { $set: parsed }, { new: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('DB Update error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DB Explorer – Delete a single document
router.post('/db/delete', isAdmin, async (req, res) => {
  try {
    const { collection, id } = req.body;
    const Model = resolveModel(collection);
    await Model.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DB Delete error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DB Explorer – Bulk update: set field=value on selected docs
router.post('/db/bulk-update', isAdmin, async (req, res) => {
  try {
    const { collection, ids, field, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: 'No IDs provided' });
    if (!field || ['_id','__v','password','passwordHash'].includes(field))
      return res.status(400).json({ ok: false, error: 'Cannot update protected field: ' + field });
    let parsedValue;
    try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
    const Model = resolveModel(collection);
    const result = await Model.updateMany({ _id: { $in: ids } }, { $set: { [field]: parsedValue } });
    res.json({ ok: true, modified: result.modifiedCount });
  } catch (err) {
    console.error('DB Bulk Update error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DB Explorer – Bulk delete selected docs
router.post('/db/bulk-delete', isAdmin, async (req, res) => {
  try {
    const { collection, ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: 'No IDs provided' });
    const Model = resolveModel(collection);
    const result = await Model.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    console.error('DB Bulk Delete error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});





// ═══════════════════════════════════════════════════════════
// MASTER DATA MANAGEMENT SYSTEM (MDMS)
// ═══════════════════════════════════════════════════════════
const Gotra      = require('../models/Gotra');
const Village    = require('../models/Village');
const Honorific  = require('../models/Honorific');
const Occupation = require('../models/Occupation');
// Note: Surname model is already required later in this file (line ~864)


// Map type slug → model + display label + fields schema
const MDMS_CONFIG = {
  gotra: {
    model: Gotra, label: 'Gotras', icon: 'fa-om',
    fields: [
      { key: 'name',        label: 'Gotra Name (English)',  required: true },
      { key: 'hindiName',   label: 'Gotra Name (Hindi)',    required: false },
      { key: 'description', label: 'Description',           required: false },
    ],
    display: d => d.name,
    sub:    d => d.hindiName || '',
  },
  village: {
    model: Village, label: 'Villages', icon: 'fa-map-marker-alt',
    fields: [
      { key: 'name',      label: 'Village Name (English)', required: true },
      { key: 'hindiName', label: 'Village Name (Hindi)',   required: false },
      { key: 'district',  label: 'District',               required: false },
      { key: 'state',     label: 'State',                  required: false },
    ],
    display: d => d.name,
    sub:    d => [d.hindiName, d.district, d.state].filter(Boolean).join(' · '),
  },
  honorific: {
    model: Honorific, label: 'Honorifics / Titles', icon: 'fa-id-badge',
    fields: [
      { key: 'code',       label: 'Code (e.g. Shri)', required: true },
      { key: 'label',      label: 'Full Label',        required: true },
      { key: 'hindiLabel', label: 'Hindi Label',       required: false },
      { key: 'gender',     label: 'Gender (M/F/Both)', required: false },
    ],
    display: d => `${d.code} — ${d.label}`,
    sub:    d => d.hindiLabel || '',
  },
  occupation: {
    model: Occupation, label: 'Occupations', icon: 'fa-briefcase',
    fields: [
      { key: 'name',      label: 'Occupation Name', required: true },
      { key: 'hindiName', label: 'Hindi Name',       required: false },
      { key: 'category',  label: 'Category',         required: false },
    ],
    display: d => d.name,
    sub:    d => d.category || '',
  },
};

// GET /admin/mdms — Hub page
router.get('/mdms', isAdmin, async (req, res) => {
  try {
    const [gotras, villages, honorifics, occupations, surnames] = await Promise.all([
      Gotra.find().sort({ name: 1 }).lean(),
      Village.find().sort({ name: 1 }).lean(),
      Honorific.find().sort({ code: 1 }).lean(),
      Occupation.find().sort({ name: 1 }).lean(),
      Surname.find().sort({ surname: 1 }).lean(),
    ]);
    res.render('admin/mdms', {
      title: 'Master Data Management',
      gotras, villages, honorifics, occupations, surnames,
      MDMS_CONFIG,
      activeTab: req.query.tab || 'gotra',
      flash: req.query.flash || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('MDMS error: ' + err.message);
  }
});

// POST /admin/mdms/:type/add
router.post('/mdms/:type/add', isAdmin, async (req, res) => {
  const cfg = MDMS_CONFIG[req.params.type];
  if (!cfg) return res.redirect('/admin/mdms');
  try {
    const data = {};
    cfg.fields.forEach(f => { if (req.body[f.key] !== undefined) data[f.key] = req.body[f.key]; });
    await cfg.model.create(data);
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=added`);
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
  }
});

// POST /admin/mdms/:type/:id/edit
router.post('/mdms/:type/:id/edit', isAdmin, async (req, res) => {
  const cfg = MDMS_CONFIG[req.params.type];
  if (!cfg) return res.redirect('/admin/mdms');
  try {
    const data = {};
    cfg.fields.forEach(f => { if (req.body[f.key] !== undefined) data[f.key] = req.body[f.key]; });
    await cfg.model.findByIdAndUpdate(req.params.id, data);
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=updated`);
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
  }
});

// POST /admin/mdms/:type/:id/delete
router.post('/mdms/:type/:id/delete', isAdmin, async (req, res) => {
  const cfg = MDMS_CONFIG[req.params.type];
  if (!cfg) return res.redirect('/admin/mdms');
  try {
    await cfg.model.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=deleted`);
  } catch (err) {
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
  }
});

// POST /admin/mdms/:type/:id/toggle — Toggle isActive
router.post('/mdms/:type/:id/toggle', isAdmin, async (req, res) => {
  const cfg = MDMS_CONFIG[req.params.type];
  if (!cfg) return res.redirect('/admin/mdms');
  try {
    const doc = await cfg.model.findById(req.params.id);
    if (doc) { doc.isActive = !doc.isActive; await doc.save(); }
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=updated`);
  } catch (err) {
    res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
  }
});

// ───────────────────────────────────────────────────────────

router.get('/members/export', isAdmin, async (req, res) => {

    try {
    const members = await Member.find().sort({ createdAt: -1 });
    let csv = 'Name,Gotra,Village,Phone,Email,Occupation,Role,Date Added\n';
    members.forEach(m => {
      const name = `"${(m.name || '').replace(/"/g, '""')}"`;
      const gotra = `"${(m.gotra || '').replace(/"/g, '""')}"`;
      const village = `"${(m.village || '').replace(/"/g, '""')}"`;
      const phone = `"${(m.contactNumber || '').replace(/"/g, '""')}"`;
      const email = `"${(m.email || '').replace(/"/g, '""')}"`;
      const occupation = `"${(m.occupation || '').replace(/"/g, '""')}"`;
      const role = m.isCommitteeMember ? 'Committee' : 'Member';
      const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '';
      csv += `${name},${gotra},${village},${phone},${email},${occupation},${role},${date}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="UtkalBrahmin_Members.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.redirect('/admin/members');
  }
});

router.get('/members/add', isAdmin, async (req, res) => {
    try {
    const allMembers = await Member.find().sort({ name: 1 });
    res.render('admin/member-form', { title: 'Add New Member', allMembers });
  } catch (err) {
    res.render('admin/member-form', { title: 'Add New Member', allMembers: [] });
  }
});

router.post('/members/add', isAdmin, async (req, res) => {
    try {
    const gotra = req.body.gotra_select === 'Others' ? req.body.gotra_other : req.body.gotra_select;
    const newMember = new Member({
      honorific: req.body.honorific || '',
      name: req.body.name,
      gotra: gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      isCommitteeMember: req.body.isCommitteeMember === 'on',
      isDeceased: req.body.isDeceased === 'on',
      isFamilyTreeOnly: req.body.isFamilyTreeOnly === 'on',
      deathDate: req.body.deathDate || null,
      father: req.body.father || null,
      mother: req.body.mother || null,
      spouse: req.body.spouse || null,
      isApproved: true // Admin added members are auto-approved
    });

    if (!newMember.father) delete newMember.father;
    if (!newMember.mother) delete newMember.mother;
    if (!newMember.spouse) delete newMember.spouse;

    const savedMember = await newMember.save();

    // Reciprocal Updates
    if (savedMember.father) await Member.findByIdAndUpdate(savedMember.father, { $addToSet: { children: savedMember._id } });
    if (savedMember.mother) await Member.findByIdAndUpdate(savedMember.mother, { $addToSet: { children: savedMember._id } });
    if (savedMember.spouse) await Member.findByIdAndUpdate(savedMember.spouse, { spouse: savedMember._id });

    res.redirect('/admin/members');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/members/add');
  }
});

router.post('/members/:id/delete', isAdmin, async (req, res) => {
  try {
    const memberId = req.params.id;

    // Reciprocal Cleanup: Remove this person from being anyone's father, mother, spouse, or child
    await Member.updateMany({ father: memberId }, { $unset: { father: 1 } });
    await Member.updateMany({ mother: memberId }, { $unset: { mother: 1 } });
    await Member.updateMany({ spouse: memberId }, { $unset: { spouse: 1 } });
    await Member.updateMany({ children: memberId }, { $pull: { children: memberId } });

    await Member.findByIdAndDelete(memberId);
  } catch (err) { console.error(err); }
  res.redirect('/admin/members');
});

router.get('/members/:id/edit', isAdmin, async (req, res) => {
    try {
    const [member, allMembers] = await Promise.all([
      Member.findById(req.params.id),
      Member.find({ _id: { $ne: req.params.id } }).sort({ name: 1 })
    ]);
    res.render('admin/member-form', { title: 'Edit Member', member, allMembers });
  } catch (err) {
    res.redirect('/admin/members');
  }
});

router.post('/members/:id/edit', isAdmin, async (req, res) => {
    try {
    const gotra = req.body.gotra_select === 'Others' ? req.body.gotra_other : req.body.gotra_select;
    const updateData = {
      honorific: req.body.honorific || '',
      name: req.body.name,
      gotra: gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      isCommitteeMember: req.body.isCommitteeMember === 'on',
      isDeceased: req.body.isDeceased === 'on',
      isFamilyTreeOnly: req.body.isFamilyTreeOnly === 'on',
      deathDate: req.body.deathDate || null,
      father: req.body.father || null,
      mother: req.body.mother || null,
      spouse: req.body.spouse || null
    };

    if (!updateData.father) updateData.father = null;
    if (!updateData.mother) updateData.mother = null;
    if (!updateData.spouse) updateData.spouse = null;

    const oldMember = await Member.findById(req.params.id);
    const updatedMember = await Member.findByIdAndUpdate(req.params.id, updateData, { new: true });

    // Handle Reciprocal Disconnects (if relationship changed)
    if (oldMember.father && oldMember.father.toString() !== (updatedMember.father && updatedMember.father.toString())) {
      await Member.findByIdAndUpdate(oldMember.father, { $pull: { children: updatedMember._id } });
    }
    if (oldMember.mother && oldMember.mother.toString() !== (updatedMember.mother && updatedMember.mother.toString())) {
      await Member.findByIdAndUpdate(oldMember.mother, { $pull: { children: updatedMember._id } });
    }
    if (oldMember.spouse && oldMember.spouse.toString() !== (updatedMember.spouse && updatedMember.spouse.toString())) {
      await Member.findByIdAndUpdate(oldMember.spouse, { $unset: { spouse: 1 } });
    }

    // Handle Reciprocal Updates for the new relations
    if (updatedMember.father) await Member.findByIdAndUpdate(updatedMember.father, { $addToSet: { children: updatedMember._id } });
    if (updatedMember.mother) await Member.findByIdAndUpdate(updatedMember.mother, { $addToSet: { children: updatedMember._id } });
    if (updatedMember.spouse) await Member.findByIdAndUpdate(updatedMember.spouse, { spouse: updatedMember._id });

    res.redirect('/admin/members');
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/members/${req.params.id}/edit`);
  }
});

// Quick Connect Relative
router.post('/members/:id/connect', isAdmin, async (req, res) => {
    try {
    const { type, targetId } = req.body;
    const memberId = req.params.id;

    if (!targetId) return res.redirect(`/members/${memberId}`);

    const updateData = {};
    if (type === 'father') {
      updateData.father = targetId;
      // Reciprocal: Add this member to father's children list
      await Member.findByIdAndUpdate(targetId, { $addToSet: { children: memberId } });
    } else if (type === 'mother') {
      updateData.mother = targetId;
      // Reciprocal: Add this member to mother's children list
      await Member.findByIdAndUpdate(targetId, { $addToSet: { children: memberId } });
    } else if (type === 'spouse') {
      updateData.spouse = targetId;
      // Reciprocal: Set this member as spouse for the target too
      await Member.findByIdAndUpdate(targetId, { spouse: memberId });
    } else if (type === 'child') {
      // Add target to this member's children list
      await Member.findByIdAndUpdate(memberId, { $addToSet: { children: targetId } });
      // Reciprocal: Set this member as father/mother for the child (defaulting to father if not specified, but usually better to just link one way and let reciprocal happen)
      // For simplicity, we'll just do the children list here.
    }

    if (Object.keys(updateData).length > 0) {
      await Member.findByIdAndUpdate(memberId, { $set: updateData });
    }

    res.redirect(`/members/${memberId}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/members/${req.params.id}`);
  }
});

// Admin Matrimonial Management
router.get('/matrimonial', isAdmin, async (req, res) => {
    try {
    const { search, status } = req.query;
    let query = { 'matrimonialProfile.isEligible': true };
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { village: new RegExp(search, 'i') },
        { gotra: new RegExp(search, 'i') }
      ];
    }
    
    if (status === 'approved') {
      query['matrimonialProfile.isApproved'] = true;
    } else if (status === 'pending') {
      query['matrimonialProfile.isApproved'] = false;
    }
    
    const profiles = await Member.find(query).sort({ createdAt: -1 });
    res.render('admin/matrimonial', { 
      title: 'Manage Matrimonial', 
      profiles,
      searchQuery: search || '',
      statusQuery: status || ''
    });
  } catch (err) {
    res.render('admin/matrimonial', { title: 'Manage Matrimonial', profiles: [], searchQuery: '', statusQuery: '' });
  }
});

router.get('/matrimonial/export', isAdmin, async (req, res) => {
    try {
    const profiles = await Member.find({ 'matrimonialProfile.isEligible': true }).sort({ createdAt: -1 });
    let csv = 'Name,Gotra,Village,DOB,Height,Education,Occupation,Phone,Address,Status,Submitted At\n';
    profiles.forEach(p => {
      const name = `"${(p.name || '').replace(/"/g, '""')}"`;
      const gotra = `"${(p.gotra || '').replace(/"/g, '""')}"`;
      const village = `"${(p.village || '').replace(/"/g, '""')}"`;
      const dob = p.matrimonialProfile && p.matrimonialProfile.dateOfBirth ? `"${new Date(p.matrimonialProfile.dateOfBirth).toLocaleDateString()}"` : '""';
      const height = `"${((p.matrimonialProfile && p.matrimonialProfile.height) || '').replace(/"/g, '""')}"`;
      const education = `"${((p.matrimonialProfile && p.matrimonialProfile.education) || '').replace(/"/g, '""')}"`;
      const occupation = `"${(p.occupation || '').replace(/"/g, '""')}"`;
      const phone = `"${(p.contactNumber || '').replace(/"/g, '""')}"`;
      const address = `"${(p.address || '').replace(/"/g, '""')}"`;
      const status = p.matrimonialProfile && p.matrimonialProfile.isApproved ? '"Approved"' : '"Pending"';
      const submitted = p.createdAt ? `"${new Date(p.createdAt).toLocaleDateString()}"` : '""';
      
      csv += `${name},${gotra},${village},${dob},${height},${education},${occupation},${phone},${address},${status},${submitted}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Matrimonial_Profiles.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.redirect('/admin/matrimonial');
  }
});

router.post('/matrimonial/:id/approve', isAdmin, async (req, res) => {
    try {
    await Member.findByIdAndUpdate(req.params.id, { 'matrimonialProfile.isApproved': true });
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

router.post('/matrimonial/:id/revoke', isAdmin, async (req, res) => {
    try {
    await Member.findByIdAndUpdate(req.params.id, { 'matrimonialProfile.isApproved': false });
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

router.post('/matrimonial/:id/reject', isAdmin, async (req, res) => {
    try {
    // Mark as not eligible to remove from matrimonial without deleting member data
    await Member.findByIdAndUpdate(req.params.id, { 'matrimonialProfile.isEligible': false });
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

router.get('/matrimonial/:id/edit', isAdmin, async (req, res) => {
    try {
    const profile = await Member.findById(req.params.id);
    if (!profile) return res.redirect('/admin/matrimonial');
    res.render('admin/matrimonial-form', { title: 'Edit Matrimonial Profile', profile });
  } catch (err) {
    res.redirect('/admin/matrimonial');
  }
});

router.post('/matrimonial/:id/edit', isAdmin, async (req, res) => {
    try {
    const updateData = {
      name: req.body.name,
      gotra: req.body.gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      address: req.body.address,
      'matrimonialProfile.dateOfBirth': req.body.dateOfBirth,
      'matrimonialProfile.education': req.body.education,
      'matrimonialProfile.height': req.body.height
    };
    await Member.findByIdAndUpdate(req.params.id, { $set: updateData });
    res.redirect('/admin/matrimonial');
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/matrimonial/${req.params.id}/edit`);
  }
});

// Admin Event Management
router.get('/events', isAdmin, async (req, res) => {
    try {
    const events = await Event.find().sort({ date: -1 });
    res.render('admin/events', { title: 'Manage Events', events });
  } catch (err) {
    res.render('admin/events', { title: 'Manage Events', events: [] });
  }
});

router.get('/events/add', isAdmin, (req, res) => {
  res.render('admin/event-form', { title: 'Add New Event' });
});

router.post('/events/add', isAdmin, async (req, res) => {
    try {
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.redirect('/admin/events');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/events/add');
  }
});

router.post('/events/:id/delete', isAdmin, async (req, res) => {
    try {
    await Event.findByIdAndDelete(req.params.id);
  } catch (err) {}
  res.redirect('/admin/events');
});

// Admin Donations Management
router.get('/donations', isAdmin, async (req, res) => {
    try {
    const donations = await Donation.find().sort({ date: -1 });
    res.render('admin/donations', { title: 'Manage Donations', donations });
  } catch (err) {
    res.render('admin/donations', { title: 'Manage Donations', donations: [] });
  }
});

router.get('/donations/export', isAdmin, async (req, res) => {
    try {
    const donations = await Donation.find().sort({ date: -1 });
    let csv = 'Donor Name,Amount (INR),Purpose,Method,Transaction ID,Date\n';
    donations.forEach(d => {
      const name = `"${(d.donorName || '').replace(/"/g, '""')}"`;
      const amt = d.amount || 0;
      const purpose = `"${(d.purpose || '').replace(/"/g, '""')}"`;
      const method = `"${(d.paymentMethod || '').replace(/"/g, '""')}"`;
      const txid = `"${(d.transactionId || '').replace(/"/g, '""')}"`;
      const date = d.date ? new Date(d.date).toLocaleDateString() : '';
      csv += `${name},${amt},${purpose},${method},${txid},${date}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="UtkalBrahmin_Donations.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.redirect('/admin/donations');
  }
});

router.get('/donations/add', isAdmin, (req, res) => {
  res.render('admin/donation-form', { title: 'Add Offline Donation' });
});

router.post('/donations/add', isAdmin, async (req, res) => {
    try {
    const newDonation = new Donation({ ...req.body, isVerified: true });
    await newDonation.save();
    res.redirect('/admin/donations');
  } catch (err) {
    res.redirect('/admin/donations/add');
  }
});

// Admin Announcement Management
const Announcement = require('../models/Announcement');

router.get('/announcements', isAdmin, async (req, res) => {
    try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.render('admin/announcements', { title: 'Manage Announcements', announcements });
  } catch (err) {
    res.render('admin/announcements', { title: 'Manage Announcements', announcements: [] });
  }
});

router.get('/announcements/add', isAdmin, (req, res) => {
  res.render('admin/announcement-form', { title: 'Post Announcement' });
});

router.post('/announcements/add', isAdmin, async (req, res) => {
    try {
    const newAnnouncement = new Announcement({
      message: req.body.message,
      icon: req.body.icon || 'fas fa-bullhorn',
      isActive: req.body.isActive === 'on'
    });
    // Handle expiry
    if(req.body.expiryDate) {
      newAnnouncement.expiryDate = new Date(req.body.expiryDate);
    }
    await newAnnouncement.save();
    res.redirect('/admin/announcements');
  } catch (err) {
    res.redirect('/admin/announcements/add');
  }
});

router.get('/announcements/:id/edit', isAdmin, async (req, res) => {
    try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.redirect('/admin/announcements');
    res.render('admin/announcement-form', { title: 'Edit Announcement', announcement });
  } catch (err) {
    res.redirect('/admin/announcements');
  }
});

router.post('/announcements/:id/edit', isAdmin, async (req, res) => {
    try {
    const updateData = {
      message: req.body.message,
      icon: req.body.icon || 'fas fa-bullhorn',
      isActive: req.body.isActive === 'on'
    };
    if(req.body.expiryDate) {
      updateData.expiryDate = new Date(req.body.expiryDate);
    } else {
      updateData.$unset = { expiryDate: 1 };
    }
    
    await Announcement.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin/announcements');
  } catch (err) {
    res.redirect(`/admin/announcements/${req.params.id}/edit`);
  }
});

router.post('/announcements/:id/delete', isAdmin, async (req, res) => {
    try {
    await Announcement.findByIdAndDelete(req.params.id);
  } catch (err) {}
  res.redirect('/admin/announcements');
});

// Event Submissions & Registrations
router.get('/meet-registrations', isAdmin, async (req, res) => {
    try {
    const registrations = await MeetRegistration.find().sort({ createdAt: -1 });
    res.render('admin/meet-registrations', { title: 'Meet Registrations', registrations });
  } catch(err) {
    res.render('admin/meet-registrations', { title: 'Meet Registrations', registrations: [] });
  }
});

router.get('/student-applications', isAdmin, async (req, res) => {
    try {
    const applications = await StudentApplication.find().sort({ createdAt: -1 });
    res.render('admin/student-applications', { title: 'Student Applications', applications });
  } catch(err) {
    res.render('admin/student-applications', { title: 'Student Applications', applications: [] });
  }
});

// ── Surname Management (Admin CMS) ──────────────────────────────
const Surname = require('../models/Surname');

router.get('/surnames', isAdmin, async (req, res) => {
    try {
    const surnames = await Surname.find();
    surnames.sort((a, b) => a.surname.localeCompare(b.surname));
    res.render('admin/surnames', { title: 'Manage Surnames', surnames });
  } catch (err) {
    res.render('admin/surnames', { title: 'Manage Surnames', surnames: [] });
  }
});

router.get('/surnames/add', isAdmin, (req, res) => {
  res.render('admin/surname-form', { title: 'Add New Surname', surname: null });
});

router.post('/surnames/add', isAdmin, async (req, res) => {
    try {
    const newSurname = new Surname(req.body);
    await newSurname.save();
    res.redirect('/admin/surnames');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/surnames/add');
  }
});

router.get('/surnames/:id/edit', isAdmin, async (req, res) => {
    try {
    const surnameItem = await Surname.findById(req.params.id);
    if (!surnameItem) return res.redirect('/admin/surnames');
    res.render('admin/surname-form', { title: 'Edit Surname', surname: surnameItem });
  } catch (err) {
    res.redirect('/admin/surnames');
  }
});

router.post('/surnames/:id/edit', isAdmin, async (req, res) => {
    try {
    const updateData = {
      surname: req.body.surname,
      hindiName: req.body.hindiName,
      meaning: req.body.meaning,
      meaningHindi: req.body.meaningHindi,
      gotra: req.body.gotra,
      letter: req.body.surname.charAt(0).toUpperCase()
    };
    await Surname.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin/surnames');
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/surnames/${req.params.id}/edit`);
  }
});

router.post('/surnames/:id/delete', isAdmin, async (req, res) => {
    try {
    await Surname.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/surnames');
});

// ── Surname Error Reports ──────────────────────────────────────
const SurnameReport = require('../models/SurnameReport');

// Public API — anyone can submit
router.post('/api/surname-report', async (req, res) => {
    try {
    const report = new SurnameReport({
      surname:      req.body.surname,
      reporterName: req.body.reporterName || 'Anonymous',
      errorType:    req.body.errorType || 'general',
      description:  req.body.description
    });
    await report.save();
    res.json({ success: true, message: 'Report submitted successfully.' });
  } catch (err) {
    console.error('Surname report error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to submit report.' });
  }
});

// Admin — view all reports
router.get('/surname-reports', isAdmin, async (req, res) => {
    try {
    const reports = await SurnameReport.find().sort({ createdAt: -1 });
    res.render('admin/surname-reports', { title: 'Surname Error Reports', reports });
  } catch (err) {
    res.render('admin/surname-reports', { title: 'Surname Error Reports', reports: [] });
  }
});

// Admin — mark report as resolved
router.post('/surname-reports/:id/resolve', isAdmin, async (req, res) => {
    try {
    await SurnameReport.findByIdAndUpdate(req.params.id, { status: 'resolved' });
  } catch (err) { console.error(err); }
  res.redirect('/admin/surname-reports');
});

// Admin — delete report
router.post('/surname-reports/:id/delete', isAdmin, async (req, res) => {
    try {
    await SurnameReport.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/surname-reports');
});

// ── Gallery Management ─────────────────────────────────────────
const Gallery = require('../models/Gallery');

router.get('/gallery', isAdmin, async (req, res) => {
    try {
    const images = await Gallery.find().sort({ dateUploaded: -1 });
    res.render('admin/gallery', { title: 'Manage Gallery', images });
  } catch (err) {
    res.render('admin/gallery', { title: 'Manage Gallery', images: [] });
  }
});

router.post('/gallery/add', isAdmin, async (req, res) => {
    try {
    // The imageUrl field could now contain multiple URLs separated by commas or newlines
    const rawUrls = req.body.imageUrl || '';
    const urlArray = rawUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== '');

    for (let i = 0; i < urlArray.length; i++) {
      const url = urlArray[i];
      // Append a counter to the title if there's more than one image
      const titleSuffix = urlArray.length > 1 ? ` (${i + 1})` : '';
      
      const newImage = new Gallery({
        title: req.body.title + titleSuffix,
        imageUrl: url,
        description: req.body.description,
        category: req.body.category
      });
      await newImage.save();
    }
    
    res.redirect('/admin/gallery');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/gallery');
  }
});

router.post('/gallery/:id/delete', isAdmin, async (req, res) => {
    try {
    await Gallery.findByIdAndDelete(req.params.id);
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/gallery');
});

// ── Settings Management ─────────────────────────────────────────
const Settings = require('../models/Settings');

router.get('/settings', isAdmin, async (req, res) => {
    try {
    let siteSettings = await Settings.findById('1');
    if (!siteSettings) {
      siteSettings = new Settings({ _id: '1' });
      await siteSettings.save();
    }
    res.render('admin/settings', { title: 'Global Settings', siteSettings });
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

router.post('/settings', isAdmin, async (req, res) => {
    try {
    let siteSettings = await Settings.findById('1');
    if (!siteSettings) {
      siteSettings = new Settings({ _id: '1' });
    } else {
      siteSettings = new Settings(siteSettings);
    }
    
    siteSettings.siteTitle = req.body.siteTitle;
    siteSettings.donationTarget = req.body.donationTarget;
    siteSettings.upiId = req.body.upiId;
    siteSettings.qrCodeUrl = req.body.qrCodeUrl;
    siteSettings.contactEmail = req.body.contactEmail;
    siteSettings.contactPhone = req.body.contactPhone;
    siteSettings.facebookUrl = req.body.facebookUrl;
    siteSettings.whatsappGroupUrl = req.body.whatsappGroupUrl;
    siteSettings.lastUpdated = new Date();
    
    await siteSettings.save();
    
    // Inject into app context so public routes reflect changes immediately
    if (req.app) {
      req.app.locals.siteSettings = siteSettings;
    }
    res.redirect('/admin/settings');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/settings');
  }
});

// ── Inbox Management ──────────────────────────────────────────────
const Message = require('../models/Message');

router.get('/inbox', isAdmin, async (req, res) => {
    try {
    const messages = await Message.find().sort({ dateReceived: -1 });
    res.render('admin/inbox', { title: 'Enquiry Inbox', messages });
  } catch (err) {
    console.error(err);
    res.render('admin/inbox', { title: 'Enquiry Inbox', messages: [] });
  }
});

router.post('/inbox/:id/read', isAdmin, async (req, res) => {
    try {
    await Message.findByIdAndUpdate(req.params.id, { isRead: true });
    res.redirect('/admin/inbox');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/inbox');
  }
});

router.post('/inbox/:id/delete', isAdmin, async (req, res) => {
    try {
    await Message.findByIdAndDelete(req.params.id);
    res.redirect('/admin/inbox');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/inbox');
  }
});

// ── Committee Management ──────────────────────────────────────────
const Committee = require('../models/Committee');

router.get('/committee', isAdmin, async (req, res) => {
    try {
    const committeeMembers = await Committee.find().sort({ priority: 1, name: 1 });
    res.render('admin/committee', { title: 'Manage Committee', committee: committeeMembers });
  } catch (err) {
    console.error(err);
    res.render('admin/committee', { title: 'Manage Committee', committee: [] });
  }
});

router.get('/committee/add', isAdmin, (req, res) => {
  res.render('admin/committee-form', { title: 'Add Committee Member' });
});

router.post('/committee/add', isAdmin, async (req, res) => {
    try {
    const newMember = new Committee({
      name: req.body.name,
      role: req.body.role,
      phone: req.body.phone,
      photoUrl: req.body.photoUrl,
      priority: parseInt(req.body.priority) || 5
    });
    await newMember.save();
    res.redirect('/admin/committee');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/committee/add');
  }
});

router.post('/committee/:id/delete', isAdmin, async (req, res) => {
    try {
    await Committee.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/committee');
});

// ── Document Library ─────────────────────────────────────────────
const Document = require('../models/Document');

router.get('/documents', isAdmin, async (req, res) => {
    try {
    const documents = await Document.find().sort({ dateUploaded: -1 });
    res.render('admin/documents', { title: 'Manage Documents', documents });
  } catch (err) {
    console.error(err);
    res.render('admin/documents', { title: 'Manage Documents', documents: [] });
  }
});

router.get('/documents/add', isAdmin, (req, res) => {
  res.render('admin/document-form', { title: 'Upload Document' });
});

router.post('/documents/add', isAdmin, async (req, res) => {
    try {
    const newDoc = new Document({
      title: req.body.title,
      category: req.body.category,
      fileUrl: req.body.fileUrl,
      description: req.body.description
    });
    await newDoc.save();
    res.redirect('/admin/documents');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/documents/add');
  }
});

router.post('/documents/:id/delete', isAdmin, async (req, res) => {
    try {
    await Document.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/documents');
});

// ── Manage Admins (RBAC) ─────────────────────────────────────────
router.get('/manage-admins', requireSuperAdmin, async (req, res) => {
    try {
    const admins = await AdminUser.find().sort({ role: 1, name: 1 });
    res.render('admin/manage-admins', { title: 'Manage Admins', admins, currentAdminId: req.session.adminId });
  } catch (err) {
    console.error(err);
    res.render('admin/manage-admins', { title: 'Manage Admins', admins: [], currentAdminId: req.session.adminId });
  }
});

router.get('/manage-admins/add', requireSuperAdmin, (req, res) => {
  res.render('admin/admin-form', { title: 'Add Administrator', error: null });
});

router.post('/manage-admins/add', requireSuperAdmin, async (req, res) => {
    try {
    // Check if username already exists
    const existingAdmins = await AdminUser.find();
    if (existingAdmins.some(a => a.username === req.body.username)) {
      return res.render('admin/admin-form', { title: 'Add Administrator', error: 'Username already taken' });
    }

    const newAdmin = new AdminUser({
      username: req.body.username,
      password: req.body.password,
      role: req.body.role,
      name: req.body.name
    });
    await newAdmin.save();
    res.redirect('/admin/manage-admins');
  } catch (err) {
    console.error(err);
    res.render('admin/admin-form', { title: 'Add Administrator', error: 'Failed to create admin' });
  }
});

router.post('/manage-admins/:id/delete', requireSuperAdmin, async (req, res) => {
    try {
    // Don't let an admin delete themselves
    if (req.params.id !== req.session.adminId) {
      await AdminUser.findByIdAndDelete(req.params.id);
    }
  } catch (err) { console.error(err); }
  res.redirect('/admin/manage-admins');
});

module.exports = router;
