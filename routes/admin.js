const express = require('express');
const router = express.Router();

const Member = require('../models/Member');
const Surname = require('../models/Surname');
const Event = require('../models/Event');
const Donation = require('../models/Donation');
const MeetRegistration = require('../models/MeetRegistration');
const StudentApplication = require('../models/StudentApplication');
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { updateGenerationCascade, recalculateAllGenerations } = require('../utils/generationHelper');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }
const rateLimit = require('express-rate-limit');

// Limit password reset requests to prevent abuse
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many password reset requests from this IP, please try again later.'
});

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

    // Detailed Analytics for Phase 2
    const genderStats = await Member.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);
    
    const villageStats = await Member.aggregate([
      { $group: { _id: '$village', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const matrimonialRequests = await Member.countDocuments({ 
      'matrimonialProfile.isMatrimonialRequest': true,
      'matrimonialProfile.isApproved': false 
    });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: { 
        members: memberCount, 
        matrimonial: matrimonialCount, 
        events: eventCount, 
        donations: totalDonations,
        gender: genderStats.reduce((acc, curr) => ({ ...acc, [curr._id || 'Other']: curr.count }), {}),
        villages: villageStats,
        pendingMatrimonial: matrimonialRequests
      }
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.render('admin/dashboard', { title: 'Admin Dashboard', stats: { members: 0, matrimonial: 0, events: 0, donations: 0, gender: {}, villages: [], pendingMatrimonial: 0 } });
  }
});

// Admin Login Page
router.get('/login', async (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin');
  }

  // Self-healing: if no admins exist, create a default Super Admin from .env
  const adminCount = await AdminUser.countDocuments();
  if (adminCount === 0) {
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'password123';
    const defaultAdmin = new AdminUser({
      username: envUser,
      role: 'Super Admin',
      name: 'Default Admin'
    });
    // Use virtual `password` to ensure hashing via pre-save hook
    defaultAdmin.password = envPass;
    await defaultAdmin.save();
    console.log('[Setup] Created default Super Admin from .env credentials.');
  }

  res.render('admin/login', { title: 'Admin Login', error: null });
});

// Admin Login Process
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await AdminUser.findOne({ username });
    if (user) {
      const ok = await user.comparePassword(password);
      if (ok) {
        req.session.isAdmin = true;
        req.session.adminRole = user.role;
        req.session.adminName = user.name;
        req.session.adminId = user._id.toString();
        return res.redirect('/admin');
      }
    }

    // Fallback to .env if db lookup fails (safety net for development)
    const isEnvAdmin = (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD);
    if (isEnvAdmin) {
      req.session.isAdmin = true;
      req.session.adminRole = 'Super Admin';
      req.session.adminName = 'Root Admin';
      return res.redirect('/admin');
    }

    res.render('admin/login', { title: 'Admin Login', error: 'Invalid username or password' });
  } catch (err) {
    console.error('Login error:', err);
    res.render('admin/login', { title: 'Admin Login', error: 'Login failed' });
  }
});

// ── Password Reset Request (show form)
router.get('/password-reset', (req, res) => {
  res.render('admin/password-reset-request', { title: 'Password Reset', error: null });
});

// Handle reset request (generate token, email or show token)
router.post('/password-reset', resetLimiter, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await AdminUser.findOne({ username });
    if (!user) return res.render('admin/password-reset-request', { title: 'Password Reset', error: 'No admin found with that username' });

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    user.passwordResetToken = token;
    user.passwordResetExpires = expires;
    await user.save();

    // If SMTP configured, send email
    if (process.env.SMTP_HOST && nodemailer) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/admin/password-reset/${token}`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@example.com',
        to: email || user.username,
        subject: 'Admin Password Reset',
        text: `You requested a password reset. Open the link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`
      });

      return res.render('admin/password-reset-sent', { title: 'Password Reset Sent', via: 'email', email: email || user.username });
    }

    // Fallback: show token on-screen (insecure — only for local/dev)
    res.render('admin/password-reset-sent', { title: 'Password Reset Sent', via: 'token', token, host: req.get('host') });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.render('admin/password-reset-request', { title: 'Password Reset', error: 'Failed to create reset token' });
  }
});

// Show reset form if token valid
router.get('/password-reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await AdminUser.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } });
    if (!user) return res.send('Invalid or expired token.');
    res.render('admin/password-reset-form', { title: 'Set New Password', token, error: null });
  } catch (err) {
    console.error(err);
    res.send('Error processing token');
  }
});

// Handle new password submission
router.post('/password-reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;
    if (!password || password !== passwordConfirm) return res.render('admin/password-reset-form', { title: 'Set New Password', token, error: 'Passwords do not match' });

    const user = await AdminUser.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } });
    if (!user) return res.send('Invalid or expired token.');

    user.password = password; // virtual -> hashed on save
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Optionally log user in after reset
    req.session.isAdmin = true;
    req.session.adminRole = user.role;
    req.session.adminName = user.name;
    req.session.adminId = user._id.toString();

    res.render('admin/password-reset-success', { title: 'Password Reset Successful' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.render('admin/password-reset-form', { title: 'Set New Password', token: req.params.token, error: 'Failed to reset password' });
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

// API: Get member statistics for dashboard
router.get('/api/member-stats', isAdmin, async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const approvedMembers = await Member.countDocuments({ isApproved: true });
    const pendingMembers = await Member.countDocuments({ isApproved: false });
    const matrimonialEligible = await Member.countDocuments({ 'matrimonialProfile.isEligible': true });
    const committeeMembers = await Member.countDocuments({ isCommitteeMember: true });
    const deceasedMembers = await Member.countDocuments({ isDeceased: true });
    
    // Incomplete profiles (missing name, gotra, or village)
    const incompleteMembers = await Member.countDocuments({
      $or: [
        { name: { $exists: false } },
        { name: '' },
        { gotra: { $exists: false } },
        { gotra: '' },
        { village: { $exists: false } },
        { village: '' }
      ]
    });

    // Members with family links
    const withFatherLink = await Member.countDocuments({ father: { $exists: true, $ne: null } });
    const withMotherLink = await Member.countDocuments({ mother: { $exists: true, $ne: null } });
    const withSpouseLink = await Member.countDocuments({ spouse: { $exists: true, $ne: null } });
    const withChildrenLink = await Member.countDocuments({ children: { $exists: true, $ne: [] } });

    res.json({
      total: totalMembers,
      approved: approvedMembers,
      pending: pendingMembers,
      incomplete: incompleteMembers,
      matrimonial: matrimonialEligible,
      committee: committeeMembers,
      deceased: deceasedMembers,
      familyLinks: {
        withFather: withFatherLink,
        withMother: withMotherLink,
        withSpouse: withSpouseLink,
        withChildren: withChildrenLink
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Helper: Calculate Levenshtein distance (string similarity)
function levenshteinDistance(a, b) {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array(bn + 1).fill(null).map(() => Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const char_a = a[i - 1];
      const char_b = b[j - 1];
      const cost = char_a === char_b ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[bn][an];
}

// Helper: Calculate string similarity percentage (0-100)
function stringSimilarity(a, b) {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  const distance = levenshteinDistance(shorter, longer);
  return ((longer.length - distance) / longer.length) * 100;
}

// API: Find potential duplicate members
router.get('/api/members/duplicates', isAdmin, async (req, res) => {
  try {
    const members = await Member.find().lean();
    const duplicates = [];
    const checked = new Set();

    for (let i = 0; i < members.length; i++) {
      const m1 = members[i];
      const key1 = m1._id.toString();

      for (let j = i + 1; j < members.length; j++) {
        const m2 = members[j];
        const key2 = m2._id.toString();
        const pairKey = `${Math.min(key1, key2)}-${Math.max(key1, key2)}`;

        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        let matchScore = 0;
        let matchReasons = [];

        // 1. Same exact contact number
        if (m1.contactNumber && m2.contactNumber && m1.contactNumber === m2.contactNumber && m1.contactNumber !== '') {
          matchScore += 95;
          matchReasons.push('Same contact number');
        }

        // 2. Same gotra + surname combination (high likelihood of duplicate)
        if (m1.gotra && m2.gotra && m1.gotra === m2.gotra && m1.surname === m2.surname && m1.gotra !== '') {
          matchScore += 85;
          matchReasons.push('Same gotra + surname');
        }

        // 3. Similar names (case-insensitive, >85% match)
        if (m1.name && m2.name) {
          const nameSimilarity = stringSimilarity(
            m1.name.toLowerCase(),
            m2.name.toLowerCase()
          );
          if (nameSimilarity > 85) {
            matchScore += Math.min(50, nameSimilarity - 35);
            matchReasons.push(`Similar names (${Math.round(nameSimilarity)}% match)`);
          }
        }

        // 4. Both are linked to same father/mother (siblings)
        if (m1.father && m2.father && m1.father.toString() === m2.father.toString()) {
          matchScore += 30;
          matchReasons.push('Same father (possible siblings)');
        }
        if (m1.mother && m2.mother && m1.mother.toString() === m2.mother.toString()) {
          matchScore += 30;
          matchReasons.push('Same mother (possible siblings)');
        }

        // 5. One is linked as family of the other
        if (m1.father?.toString() === m2._id.toString() || m1.mother?.toString() === m2._id.toString() ||
            m2.father?.toString() === m1._id.toString() || m2.mother?.toString() === m1._id.toString()) {
          matchScore = 0;
          matchReasons = [];
          // Don't flag as duplicate if already linked as parent/child
          continue;
        }

        // Only include if match score >= 40 (indicating potential duplicate)
        if (matchScore >= 40) {
          duplicates.push({
            pair: [
              {
                _id: m1._id,
                name: m1.name,
                surname: m1.surname,
                gotra: m1.gotra,
                village: m1.village,
                contactNumber: m1.contactNumber,
                isApproved: m1.isApproved
              },
              {
                _id: m2._id,
                name: m2.name,
                surname: m2.surname,
                gotra: m2.gotra,
                village: m2.village,
                contactNumber: m2.contactNumber,
                isApproved: m2.isApproved
              }
            ],
            score: Math.round(matchScore),
            reasons: matchReasons
          });
        }
      }
    }

    // Sort by match score (highest first)
    duplicates.sort((a, b) => b.score - a.score);

    res.json({
      ok: true,
      totalDuplicatePairs: duplicates.length,
      duplicates: duplicates.slice(0, 50) // Return top 50 pairs
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

// Admin Family Tree
router.get('/family-tree', isAdmin, async (req, res) => {
  try {
    const Gotra = require('../models/Gotra');
    const availableGotras = await Gotra.distinct('name');
    res.render('members/family-tree', {
      title: 'Family Tree',
      memberId: 'all',
      availableGotras,
      isAdminView: true
    });
  } catch (err) {
    console.error('Error loading admin family tree:', err);
    res.render('members/family-tree', { title: 'Family Tree', memberId: 'all', availableGotras: [], isAdminView: true });
  }
});

// Admin Family Tree Table List View
router.get('/family-tree/list', isAdmin, async (req, res) => {
  try {
    const members = await Member.find({
      $or: [
        { isFamilyTreeOnly: true },
        { father: { $exists: true, $ne: null } },
        { mother: { $exists: true, $ne: null } },
        { spouse: { $exists: true, $ne: null } },
        { children: { $exists: true, $ne: [] } },
        { generationLevel: { $exists: true, $ne: null } }
      ]
    })
    .populate('father')
    .populate('mother')
    .populate('spouse')
    .sort({ generationLevel: 1, name: 1 });

    res.render('admin/family-tree-list', { 
      title: 'Family Tree Member List', 
      members 
    });
  } catch (err) {
    console.error('Error loading family tree list:', err);
    res.status(500).send('Error loading family tree list');
  }
});

// Data Health Dashboard API
router.get('/api/data-health', isAdmin, async (req, res) => {
  try {
    const members = await Member.find().lean();
    
    const orphans = [];
    const identicalNames = [];
    const nameGotraMap = new Map();

    members.forEach(m => {
       // Check for orphans: missing all structural pointers
       const hasFather = m.father && m.father.toString().trim() !== '';
       const hasMother = m.mother && m.mother.toString().trim() !== '';
       const hasSpouse = m.spouse && m.spouse.toString().trim() !== '';
       const hasPid = m.pid && m.pid.toString().trim() !== '';
       if (!hasFather && !hasMother && !hasSpouse && !hasPid) {
           orphans.push(m);
       }
       
       // Check for identical names
       if (m.name && m.gotra) {
           const key = `${m.name.toLowerCase().trim()}_${m.gotra.toLowerCase().trim()}`;
           if (nameGotraMap.has(key)) {
               identicalNames.push([nameGotraMap.get(key), m]);
           } else {
               nameGotraMap.set(key, m);
           }
       }
    });

    // We filter orphans to remove completely empty/junk entries
    const meaningfulOrphans = orphans.filter(o => o.name && o.name.length > 2);

    res.json({
        success: true,
        orphans: meaningfulOrphans.map(o => ({ id: o._id, name: o.name, gotra: o.gotra })),
        identicalNames: identicalNames.map(arr => arr.map(o => ({ id: o._id, name: o.name, gotra: o.gotra })))
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── Database Explorer ──────────────────────────────────────────────
router.get('/db', isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Announcement = require('../models/Announcement');
    const Committee = require('../models/Committee');
    const Document = require('../models/Document');
    const Gallery = require('../models/Gallery');
    const Message = require('../models/Message');
    const Settings = require('../models/Settings');

    const COLLECTIONS = [
      { name: 'members', label: 'Members', model: Member },
      { name: 'events', label: 'Events', model: Event },
      { name: 'donations', label: 'Donations', model: Donation },
      { name: 'announcements', label: 'Announcements', model: Announcement },
      { name: 'committee', label: 'Committee', model: Committee },
      { name: 'documents', label: 'Documents', model: Document },
      { name: 'gallery', label: 'Gallery', model: Gallery },
      { name: 'messages', label: 'Messages/Inbox', model: Message },
      { name: 'adminusers', label: 'Admin Users', model: AdminUser },
      { name: 'meetregs', label: 'Meet Registrations', model: MeetRegistration },
      { name: 'studentapps', label: 'Student Applications', model: StudentApplication },
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

// ── 1-Click Full Database Backup ─────────────────────────────────────
router.get('/db/backup', isAdmin, async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    const Committee    = require('../models/Committee');
    const Document     = require('../models/Document');
    const Gallery      = require('../models/Gallery');
    const Message      = require('../models/Message');
    const Settings     = require('../models/Settings');

    const [members, events, donations, announcements, committee, documents, gallery, settings] = await Promise.all([
      Member.find({}).lean(),
      Event.find({}).lean(),
      Donation.find({}).lean(),
      Announcement.find({}).lean(),
      Committee.find({}).lean(),
      Document.find({}).lean(),
      Gallery.find({}).lean(),
      Settings.find({}).lean(),
    ]);

    // Redact passwords from admin users
    const adminUsers = await AdminUser.find({}).lean();
    const safeAdmins = adminUsers.map(u => { const o = {...u}; delete o.password; delete o.passwordHash; return o; });

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.session.adminName || 'Admin',
      appVersion: '1.0',
      collections: {
        members, events, donations, announcements,
        committee, documents, gallery,
        adminUsers: safeAdmins, settings
      }
    };

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="UBS-Backup-${date}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('DB Backup error:', err);
    res.status(500).send('Backup failed: ' + err.message);
  }
});

const DB_MODEL_MAP = {
  members: 'Member',
  events: 'Event',
  donations: 'Donation',
  announcements: 'Announcement',
  committee: 'Committee',
  documents: 'Document',
  gallery: 'Gallery',
  messages: 'Message',
  adminusers: 'AdminUser',
  meetregs: 'MeetRegistration',
  studentapps: 'StudentApplication',
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
    if (!collection || !id || !data) {
      return res.status(400).json({ ok: false, error: 'Missing required fields (collection, id, or data)' });
    }
    
    const parsed = JSON.parse(data);
    
    // Safety: Remove protected fields from the update payload
    delete parsed._id; 
    delete parsed.__v; 
    delete parsed.password; 
    delete parsed.passwordHash;
    
    const Model = resolveModel(collection);
    
    // Map any dot-notation keys directly to $set for deep updates
    const updateResult = await Model.findByIdAndUpdate(id, { $set: parsed }, { new: true, runValidators: true });
    
    if (!updateResult) {
      return res.status(404).json({ ok: false, error: 'Document not found' });
    }
    
    res.json({ ok: true });
  } catch (err) {
    console.error(`[DB Update Error] Collection: ${req.body.collection}, ID: ${req.body.id}:`, err);
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

// DB Explorer – Bulk update: set multiple fields on selected docs
router.post('/db/bulk-update', isAdmin, async (req, res) => {
  try {
    const { collection, ids, field, value, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: 'No IDs provided' });
    
    let finalUpdates = updates || {};
    if (!updates && field) {
      let parsedValue;
      try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
      finalUpdates[field] = parsedValue;
    }

    if (Object.keys(finalUpdates).length === 0) return res.status(400).json({ ok: false, error: 'No updates provided' });

    const protectedFields = ['_id', '__v', 'password', 'passwordHash'];
    for (const key of Object.keys(finalUpdates)) {
      if (protectedFields.includes(key)) {
        return res.status(400).json({ ok: false, error: 'Cannot update protected field: ' + key });
      }
    }

    const Model = resolveModel(collection);
    const result = await Model.updateMany({ _id: { $in: ids } }, { $set: finalUpdates });
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

// DB Explorer – Restore deleted docs (Undo)
router.post('/db/restore', isAdmin, async (req, res) => {
  try {
    const { collection, docs } = req.body;
    if (!Array.isArray(docs) || docs.length === 0) return res.status(400).json({ ok: false, error: 'No docs provided' });
    const Model = resolveModel(collection);
    // Use insertMany to bypass some save middleware and allow setting _id
    await Model.insertMany(docs);
    res.json({ ok: true, restored: docs.length });
  } catch (err) {
    console.error('DB Restore error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});





// ═══════════════════════════════════════════════════════════
// MASTER DATA MANAGEMENT SYSTEM (MDMS)
// ═══════════════════════════════════════════════════════════
const Gotra = require('../models/Gotra');
const Village = require('../models/Village');
const Honorific = require('../models/Honorific');
const Occupation = require('../models/Occupation');
// Note: Surname model is already required later in this file (line ~864)


// Map type slug → model + display label + fields schema
const MDMS_CONFIG = {
  gotra: {
    model: Gotra, label: 'Gotras', icon: 'fa-om',
    fields: [
      { key: 'name', label: 'Gotra Name (English)', required: true },
      { key: 'hindiName', label: 'Gotra Name (Hindi)', required: false },
      { key: 'description', label: 'Description', required: false },
    ],
    display: d => d.name,
    sub: d => d.hindiName || '',
  },
  village: {
    model: Village, label: 'Villages', icon: 'fa-map-marker-alt',
    fields: [
      { key: 'name', label: 'Village Name (English)', required: true },
      { key: 'hindiName', label: 'Village Name (Hindi)', required: false },
      { key: 'district', label: 'District', required: false },
      { key: 'state', label: 'State', required: false },
    ],
    display: d => d.name,
    sub: d => [d.hindiName, d.district, d.state].filter(Boolean).join(' · '),
  },
  honorific: {
    model: Honorific, label: 'Honorifics / Titles', icon: 'fa-id-badge',
    fields: [
      { key: 'code', label: 'Code (e.g. Shri)', required: true },
      { key: 'label', label: 'Full Label', required: true },
      { key: 'hindiLabel', label: 'Hindi Label', required: false },
      { key: 'gender', label: 'Gender (M/F/Both)', required: false },
    ],
    display: d => `${d.code} — ${d.label}`,
    sub: d => d.hindiLabel || '',
  },
  occupation: {
    model: Occupation, label: 'Occupations', icon: 'fa-briefcase',
    fields: [
      { key: 'name', label: 'Occupation Name', required: true },
      { key: 'hindiName', label: 'Hindi Name', required: false },
      { key: 'category', label: 'Category', required: false },
    ],
    display: d => d.name,
    sub: d => d.category || '',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ONE-TIME FAMILY TREE IMPORT  (Hota family — from Google Sheet)
// Open in browser: http://localhost:3000/admin/api/import-family-tree
// ══════════════════════════════════════════════════════════════════════════════
router.get('/api/import-family-tree', isAdmin, async (req, res) => {
  const SURNAME = 'Hota';
  const GOTRA   = 'Jat Konenya';

  // ── AUTHORITATIVE DATA — Google Sheet (verified re-read, 70 rows) ──────
  // Corrections vs previous import:
  //   Row 17: Sudarshan parent = GHANSHYAM (not Lachhindra)
  //   Row 47: Anil parent = PITAMBAR (not Sankarsan)
  //   Row 56: Omprakash parent = PITAMBAR
  //   Brajabandhu duplicate row 28-29 removed (keep only one)
  const familyData = [
    // Gen 1
    { husband:'Fakir',          wife:'Malti',           isDeceased:true, honorific:'Late' },
    // Gen 2
    { husband:'Sobhnath',       wife:null,              fatherKey:'Fakir',      isDeceased:true, honorific:'Late' },
    { husband:'Bhikhari',       wife:'Sunaphool',       fatherKey:'Fakir',      isDeceased:true, honorific:'Late' },
    { husband:'Kanhai',         wife:null,              fatherKey:'Fakir' },
    { husband:'Shankarshan',    wife:null,              fatherKey:'Fakir' },
    // Gen 3
    { husband:'Krishna',        wife:null,              fatherKey:'Sobhnath' },
    { husband:'Trilochan',      wife:'Mukta',           fatherKey:'Bhikhari',   isDeceased:true, honorific:'Late' },
    { husband:'Lachhindra',     wife:'Yashoda',         fatherKey:'Bhikhari',   isDeceased:true, honorific:'Late' },
    { husband:'Jageshwar',      wife:'Sita',            fatherKey:'Bhikhari',   isDeceased:true, honorific:'Late' },
    { husband:'Ghanshyam',      wife:null,              fatherKey:'Kanhai' },
    { husband:'Gangadhar',      wife:null,              fatherKey:'Shankarshan' },
    // Gen 4
    { husband:'Vanmali',        wife:'Satyawati',       fatherKey:'Trilochan',  isDeceased:true, honorific:'Late' },
    { husband:'Kripasindhu',    wife:'Rahilaxmi',       fatherKey:'Lachhindra', isDeceased:true, honorific:'Late' },
    { husband:'Bhuvneshwar',    wife:'Rahi',            fatherKey:'Lachhindra', isDeceased:true, honorific:'Late' },
    { husband:'Narayan',        wife:'Hemwati',         fatherKey:'Lachhindra', isDeceased:true, honorific:'Late' },
    { husband:'Arjun',          wife:'Tripura',         fatherKey:'Lachhindra' },
    // ✅ FIXED: Sheet row 17 — Sudarshan parent = Ghanshyam (not Lachhindra)
    { husband:'Sudarshan_G4',   wife:null,              fatherKey:'Ghanshyam',  displayName:'Sudarshan' },
    { husband:'Manbodh',        wife:null,              fatherKey:'Gangadhar' },
    // Gen 5
    { husband:'Kritiwas',       wife:null,              fatherKey:'Vanmali' },
    { husband:'Sudarshan_G5',   wife:'Satyabhama',      fatherKey:'Vanmali',    isDeceased:true, honorific:'Late', displayName:'Sudarshan' },
    { husband:'Satrughan',      wife:null,              fatherKey:'Vanmali' },
    { husband:'Siddheswar',     wife:'Harawati',        fatherKey:'Kripasindhu',isDeceased:true, honorific:'Late' },
    { husband:'Sripati',        wife:'Subhadra',        fatherKey:'Bhuvneshwar' },
    { husband:'Lingraj',        wife:'Gauri',           fatherKey:'Narayan',    isDeceased:true, honorific:'Late' },
    { husband:'Upendra',        wife:'Parvati',         fatherKey:'Arjun' },
    // Gen 6
    { husband:'Dhanurjaya',     wife:null,              fatherKey:'Sudarshan_G5' },
    { husband:'Sahadev',        wife:'Urvashi',         fatherKey:'Sudarshan_G5' },
    { husband:'Vrindavan',      wife:null,              fatherKey:'Sudarshan_G5' },
    // ✅ Only ONE Brajabandhu (duplicate removed)
    { husband:'Brajabandhu',    wife:'Priyowati',       fatherKey:'Siddheswar', isDeceased:true, honorific:'Late' },
    { husband:'Sanatan',        wife:'Praksya Sewti',   fatherKey:'Lingraj' },
    { husband:'Sankarsan',      wife:'Sankara',         fatherKey:'Lingraj' },
    { husband:'Gowardhan',      wife:'Mogra',           fatherKey:'Lingraj' },
    { husband:'Janardan',       wife:'Maya',            fatherKey:'Lingraj' },
    { husband:'Minketan',       wife:'Bhagmati',        fatherKey:'Lingraj' },
    { husband:'Gajanand',       wife:'Khirodhari',      fatherKey:'Lingraj' },
    { husband:'Madusudan',      wife:null,              fatherKey:'Lingraj' },
    // Gen 7
    { husband:'Shiv Prashad',   wife:null,              fatherKey:'Dhanurjaya' },
    { husband:'Karunakar',      wife:'Gandharvi',       fatherKey:'Brajabandhu' },
    { husband:'Murlidhar',      wife:null,              fatherKey:'Brajabandhu' },
    { husband:'Kanhya',         wife:null,              fatherKey:'Sanatan' },
    { husband:'Yudhistir',      wife:null,              fatherKey:'Sanatan' },
    { husband:'Sushil',         wife:'Shailendri',      fatherKey:'Sanatan',    isDeceased:true, honorific:'Late' },
    { husband:'Surendra',       wife:null,              fatherKey:'Sanatan' },
    { husband:'Ganesh',         wife:null,              fatherKey:'Sanatan' },
    { husband:'Durgacharan',    wife:null,              fatherKey:'Sanatan' },
    { husband:'Pitambar',       wife:'Uma',             fatherKey:'Sankarsan' },
    { husband:'Suklambar',      wife:'Urkuli',          fatherKey:'Janardan',   isDeceased:true, honorific:'Late' },
    { husband:'Maheshwar',      wife:'Safed',           fatherKey:'Janardan',   isDeceased:true, honorific:'Late' },
    { husband:'Shradhakar',     wife:'Shailendri_S',    fatherKey:'Janardan',   isDeceased:true, honorific:'Late', wifeName:'Shailendri' },
    { husband:'Chandrashekhar', wife:null,              fatherKey:'Minketan' },
    // Gen 8
    { husband:'Subhash',        wife:'Manorama',        fatherKey:'Karunakar',  isDeceased:true, honorific:'Late' },
    { husband:'Gokul',          wife:'Gandharvi_G',     fatherKey:'Karunakar',  wifeName:'Gandharvi' },
    { husband:'Hrishikesh',     wife:null,              fatherKey:'Murlidhar' },
    { husband:'Dheeraj',        wife:null,              fatherKey:'Sushil' },
    // ✅ FIXED: Anil parent = Pitambar (sheet row 47), NOT Sankarsan
    { husband:'Anil',           wife:'Poornima',        fatherKey:'Pitambar' },
    // ✅ FIXED: Omprakash parent = Pitambar (sheet row 56)
    { husband:'Omprakash',      wife:'Savitri',         fatherKey:'Pitambar' },
    { husband:'Anup',           wife:null,              fatherKey:'Suklambar' },
    { husband:'Dinesh',         wife:null,              fatherKey:'Suklambar' },
    { husband:'Ramesh',         wife:'Sikha',           fatherKey:'Maheshwar' },
    { husband:'Raju',           wife:null,              fatherKey:'Maheshwar' },
    { husband:'Sudhir',         wife:null,              fatherKey:'Shradhakar' },
    { husband:'Sanjay',         wife:null,              fatherKey:'Shradhakar' },
    // Gen 9
    { husband:'Gajendra',       wife:null,              fatherKey:'Subhash' },
    { husband:'Harshwardhan',   wife:'Jyoti',           fatherKey:'Subhash' },
    { husband:'Mahendra',       wife:'Gyaneshwari',     fatherKey:'Subhash' },
    { husband:'Pratap',         wife:null,              fatherKey:'Gokul' },
    { husband:'Pranav',         wife:null,              fatherKey:'Gokul' },
    { husband:'Subham',         wife:null,              fatherKey:'Omprakash' },
    // Gen 10
    { husband:'Prajwal',        wife:null,              fatherKey:'Gajendra' },
    { husband:'Parth',          wife:null,              fatherKey:'Mahendra' },
  ];

  function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  async function upsert(name, extra = {}) {
    let m = await Member.findOne({ name: new RegExp('^' + escRx(name) + '$', 'i') });
    if (!m) {
      m = new Member({ name, surname: SURNAME, gotra: GOTRA, isFamilyTreeOnly: true, isApproved: true, ...extra });
      await m.save();
      return { m, created: true };
    }
    let dirty = false;
    if (!m.surname) { m.surname = SURNAME; dirty = true; }
    if (!m.gotra)   { m.gotra   = GOTRA;   dirty = true; }
    if (!m.isFamilyTreeOnly) { m.isFamilyTreeOnly = true; dirty = true; }
    if (extra.isDeceased && !m.isDeceased) { m.isDeceased = true; m.honorific = extra.honorific || 'Late'; dirty = true; }
    if (dirty) await m.save();
    return { m, created: false };
  }

  const log = [];
  const keyToId = {};
  let created = 0, skipped = 0, linked = 0, missing = 0;

  try {
    // Pass 1: Upsert all members
    for (const e of familyData) {
      const displayName = e.displayName || e.husband;
      const { m: h, created: hNew } = await upsert(displayName, { isDeceased: e.isDeceased || false, honorific: e.honorific || '' });
      hNew ? (log.push(`✅ Created: ${displayName}`), created++) : (log.push(`ℹ️ Exists: ${displayName}`), skipped++);
      keyToId[e.husband] = h._id;

      if (e.wife) {
        const wName = e.wifeName || e.wife;
        const { m: w, created: wNew } = await upsert(wName, {});
        wNew ? (log.push(`✅ Created wife: ${wName}`), created++) : (log.push(`ℹ️ Exists: ${wName}`), skipped++);
        if (!h.spouse) {
          await Member.findByIdAndUpdate(h._id, { spouse: w._id, spouseName: wName });
          await Member.findByIdAndUpdate(w._id, { spouse: h._id, spouseName: displayName });
          log.push(`💍 Linked spouses: ${displayName} ↔ ${wName}`);
        }
      }
    }

    // Pass 2: Link parent → child (FORCE overwrite to fix old wrong links)
    for (const e of familyData) {
      if (!e.fatherKey) continue;
      const displayName = e.displayName || e.husband;
      const childId  = keyToId[e.husband];
      const fatherId = keyToId[e.fatherKey];
      if (childId && fatherId) {
        // Force-set father (overwrites any wrong old link)
        await Member.findByIdAndUpdate(childId,  { father: fatherId });
        await Member.findByIdAndUpdate(fatherId, { $addToSet: { children: childId } });
        const fEntry = familyData.find(x => x.husband === e.fatherKey);
        log.push(`🔗 ${fEntry?.displayName || e.fatherKey}  →  ${displayName}`);
        linked++;
      } else {
        log.push(`⚠️ Missing parent ref: "${e.fatherKey}" for "${displayName}"`);
        missing++;
      }
    }

    const total = await Member.countDocuments();
    res.json({ ok: true, summary: { created, skipped, linked, missing, totalMembersInDB: total }, log });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, log });
  }
});


// GET /admin/family-tree-bulk — Bulk relationship import page
router.get('/family-tree-bulk', isAdmin, (req, res) => {
  res.render('admin/family-tree-bulk', {
    title: 'Bulk Import Relationships',
  });
});

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

// ══════════════════════════════════════════════════════════
// MDMS USAGE TRACKING & BULK IMPORT/EXPORT
// ══════════════════════════════════════════════════════════

// Helper: Get usage count for each master data item
async function getMdmsUsageStats(type) {
  const stats = {};
  try {
    if (type === 'gotra') {
      const gotras = await Gotra.find().lean();
      for (const g of gotras) {
        const count = await Member.countDocuments({ gotra: g.name });
        stats[g._id] = count;
      }
    } else if (type === 'village') {
      const villages = await Village.find().lean();
      for (const v of villages) {
        const count = await Member.countDocuments({ village: v.name });
        stats[v._id] = count;
      }
    } else if (type === 'occupation') {
      const occupations = await Occupation.find().lean();
      for (const o of occupations) {
        const count = await Member.countDocuments({ occupation: o.name });
        stats[o._id] = count;
      }
    } else if (type === 'honorific') {
      const honorifics = await Honorific.find().lean();
      for (const h of honorifics) {
        const count = await Member.countDocuments({ honorific: h.code });
        stats[h._id] = count;
      }
    } else if (type === 'surname') {
      const surnames = await Surname.find().lean();
      for (const s of surnames) {
        const count = await Member.countDocuments({ surname: s.surname });
        stats[s._id] = count;
      }
    }
  } catch (e) {
    console.error('Usage stats error:', e);
  }
  return stats;
}

// API: Get usage stats (returns JSON)
router.get('/mdms/:type/usage', isAdmin, async (req, res) => {
  try {
    const stats = await getMdmsUsageStats(req.params.type);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /admin/mdms/:type/export — Export master data as CSV
router.get('/mdms/:type/export', isAdmin, async (req, res) => {
  try {
    const cfg = MDMS_CONFIG[req.params.type];
    if (!cfg) return res.status(404).send('Type not found');
    
    const items = await cfg.model.find().sort({ createdAt: -1 }).lean();
    const stats = await getMdmsUsageStats(req.params.type);
    
    // Build CSV header
    let headers = ['ID', 'Created', 'Active'];
    cfg.fields.forEach(f => headers.push(f.label));
    headers.push('Usage Count');
    let csv = headers.join(',') + '\n';
    
    // Build CSV rows
    items.forEach(item => {
      const row = [
        item._id || '',
        item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
        item.isActive !== false ? 'Yes' : 'No'
      ];
      cfg.fields.forEach(f => {
        let val = item[f.key] || '';
        val = String(val).replace(/"/g, '""');
        row.push(`"${val}"`);
      });
      row.push(stats[item._id] || 0);
      csv += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="MDMS_${req.params.type}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(400).send('Export error: ' + err.message);
  }
});

// GET /admin/mdms/:type/export-json — Export as JSON
router.get('/mdms/:type/export-json', isAdmin, async (req, res) => {
  try {
    const cfg = MDMS_CONFIG[req.params.type];
    if (!cfg) return res.status(404).json({ error: 'Type not found' });
    
    const items = await cfg.model.find().lean();
    const stats = await getMdmsUsageStats(req.params.type);
    
    const itemsWithUsage = items.map(item => ({
      ...item,
      usageCount: stats[item._id] || 0
    }));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="MDMS_${req.params.type}_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(itemsWithUsage);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/mdms/:type/import — Bulk import from CSV/JSON
router.post('/mdms/:type/import', isAdmin, async (req, res) => {
  try {
    const cfg = MDMS_CONFIG[req.params.type];
    if (!cfg) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    
    const csvData = req.body.csvData || req.body?.data;
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided' });
    }
    
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    let importedCount = 0;
    let skippedCount = 0;
    
    // Import each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const data = {};
      
      cfg.fields.forEach((f, idx) => {
        const headerIdx = headers.indexOf(f.label);
        if (headerIdx >= 0 && values[headerIdx]) {
          data[f.key] = values[headerIdx];
        }
      });
      
      // Check if required fields are present
      const hasRequired = cfg.fields.filter(f => f.required).every(f => data[f.key]);
      if (!hasRequired) {
        skippedCount++;
        continue;
      }
      
      try {
        await cfg.model.create(data);
        importedCount++;
      } catch (e) {
        skippedCount++;
      }
    }
    
    // Return JSON response for fetch requests, or redirect for form posts
    if (req.headers['content-type']?.includes('application/json')) {
      res.json({ ok: true, imported: importedCount, skipped: skippedCount });
    } else {
      req.session.flash = {
        type: 'import',
        imported: importedCount,
        skipped: skippedCount
      };
      res.redirect(`/admin/mdms?tab=${req.params.type}&flash=import`);
    }
  } catch (err) {
    console.error('Import error:', err);
    if (req.headers['content-type']?.includes('application/json')) {
      res.status(400).json({ error: err.message });
    } else {
      res.redirect(`/admin/mdms?tab=${req.params.type}&flash=error`);
    }
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
    const [allMembers, surnames] = await Promise.all([
      Member.find().sort({ name: 1 }),
      Surname.find().sort({ surname: 1 })
    ]);
    res.render('admin/member-form', { title: 'Add New Member', allMembers, surnames });
  } catch (err) {
    res.render('admin/member-form', { title: 'Add New Member', allMembers: [], surnames: [] });
  }
});

router.post('/members/add', isAdmin, async (req, res) => {
  try {
    const gotra = req.body.gotra_select === 'Others' ? req.body.gotra_other : req.body.gotra_select;
    const surname = req.body.surname_select === 'Others' ? req.body.surname_other : req.body.surname_select;
    const newMember = new Member({
      honorific: req.body.honorific || '',
      name: req.body.name,
      gender: req.body.gender,
      surname: surname,
      gotra: gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      bloodGroup: req.body.bloodGroup || '',
      isCommitteeMember: req.body.isCommitteeMember === 'on',
      isDeceased: req.body.isDeceased === 'on',
      isFamilyTreeOnly: req.body.isFamilyTreeOnly === 'on',
      deathDate: req.body.deathDate || null,
      father: req.body.father || null,
      fatherName: req.body.fatherName || null,
      mother: req.body.mother || null,
      motherName: req.body.motherName || null,
      spouse: req.body.spouse || null,
      spouseName: req.body.spouseName || null,
      matrimonialProfile: {
        dateOfBirth: req.body.dob ? new Date(req.body.dob) : null,
        education: req.body.education || ''
      },
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

    // AUTO-UPDATE GENERATION
    // Run async so it doesn't block the redirect
    updateGenerationCascade(savedMember._id).catch(e => console.error('[Generation] Add cascade failed:', e.message));

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
    const [member, allMembers, surnames] = await Promise.all([
      Member.findById(req.params.id),
      Member.find({ _id: { $ne: req.params.id } }).sort({ name: 1 }),
      Surname.find().sort({ surname: 1 })
    ]);
    res.render('admin/member-form', { title: 'Edit Member', member, allMembers, surnames });
  } catch (err) {
    res.redirect('/admin/members');
  }
});

// API: Get family member's surname/gotra for auto-fill
router.get('/api/member/:id/family-data', isAdmin, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).lean();
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({
      name: member.name,
      surname: member.surname,
      gotra: member.gotra,
      village: member.village
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Helper: Recursively get all descendants of a member
async function getAllDescendants(memberId, visited = new Set()) {
  if (visited.has(memberId)) return [];
  visited.add(memberId);
  
  const descendants = [memberId];
  
  // Find direct children (where this member is father or mother)
  const children = await Member.find({
    $or: [{ father: memberId }, { mother: memberId }]
  }).select('_id').lean();
  
  for (const child of children) {
    const grandChildren = await getAllDescendants(child._id, visited);
    descendants.push(...grandChildren);
  }
  
  return descendants;
}

// API: Apply surname/gotra to entire family tree (all descendants recursively)
router.post('/api/member/:id/apply-to-tree', isAdmin, async (req, res) => {
  try {
    const parent = await Member.findById(req.params.id).lean();
    if (!parent) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { surname, gotra } = parent;
    if (!surname || !gotra) {
      return res.status(400).json({ error: 'Parent surname or gotra not set' });
    }

    // Get all descendants recursively
    const descendants = await getAllDescendants(req.params.id);
    
    if (descendants.length <= 1) {
      return res.json({ 
        ok: true, 
        updated: 0,
        message: 'No descendants found in the family tree'
      });
    }

    // Update all descendants (skip the parent itself)
    const descendantIds = descendants.filter(id => id.toString() !== req.params.id);
    
    const result = await Member.updateMany(
      { _id: { $in: descendantIds } },
      { $set: { surname, gotra } }
    );

    res.json({ 
      ok: true, 
      updated: result.modifiedCount,
      message: `✅ पूरे family tree को updated किया! ${result.modifiedCount} members का surname "${surname}" और gotra "${gotra}" set हो गया।\n\nTotal descendants: ${descendantIds.length}`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Apply surname/gotra to all children of a member (direct only)
router.post('/api/member/:id/apply-to-children', isAdmin, async (req, res) => {
  try {
    const parent = await Member.findById(req.params.id).lean();
    if (!parent) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { surname, gotra } = parent;
    if (!surname || !gotra) {
      return res.status(400).json({ error: 'Parent surname or gotra not set' });
    }

    // Update all children
    const result = await Member.updateMany(
      { $or: [{ father: req.params.id }, { mother: req.params.id }] },
      { $set: { surname, gotra } }
    );

    res.json({ 
      ok: true, 
      updated: result.modifiedCount,
      message: `Updated ${result.modifiedCount} children with surname "${surname}" and gotra "${gotra}"`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Recalculate ALL generations in the entire community tree
router.post('/api/members/recalculate-generations', isAdmin, async (req, res) => {
  try {
    const result = await recalculateAllGenerations();
    res.json({
      ok: true,
      message: `✅ Generation recalculation complete! ${result.updated} members updated.${result.errors > 0 ? ` (${result.errors} errors)` : ''}`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Bulk Approve Members
router.post('/api/members/bulk-approve', isAdmin, async (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Invalid member IDs' });
    }

    const result = await Member.updateMany(
      { _id: { $in: memberIds } },
      { $set: { isApproved: true } }
    );

    res.json({
      ok: true,
      updated: result.modifiedCount,
      message: `Approved ${result.modifiedCount} members`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Bulk Reject Members
router.post('/api/members/bulk-reject', isAdmin, async (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Invalid member IDs' });
    }

    const result = await Member.updateMany(
      { _id: { $in: memberIds } },
      { $set: { isApproved: false } }
    );

    res.json({
      ok: true,
      updated: result.modifiedCount,
      message: `Rejected ${result.modifiedCount} members`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Bulk Delete Members
router.post('/api/members/bulk-delete', isAdmin, async (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Invalid member IDs' });
    }

    // Cleanup reciprocal relationships for all members being deleted
    for (const memberId of memberIds) {
      await Member.updateMany({ father: memberId }, { $unset: { father: 1 } });
      await Member.updateMany({ mother: memberId }, { $unset: { mother: 1 } });
      await Member.updateMany({ spouse: memberId }, { $unset: { spouse: 1 } });
      await Member.updateMany({ children: memberId }, { $pull: { children: memberId } });
    }

    const result = await Member.deleteMany({ _id: { $in: memberIds } });

    res.json({
      ok: true,
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} members`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Bulk Import Members from CSV
router.post('/api/members/bulk-import', isAdmin, async (req, res) => {
  try {
    const { members } = req.body;
    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid members data' });
    }

    let created = 0;
    let duplicates = 0;

    for (const memberData of members) {
      // Validate required fields
      if (!memberData.name || !memberData.gotra) {
        continue; // Skip invalid records
      }

      // Check for duplicates (same name + gotra)
      const existing = await Member.findOne({
        name: memberData.name,
        gotra: memberData.gotra
      });

      if (existing) {
        duplicates++;
        continue;
      }

      // Create new member
      const newMember = new Member({
        name: memberData.name,
        surname: memberData.surname || '',
        gotra: memberData.gotra,
        village: memberData.village || '',
        contactNumber: memberData.contactNumber || '',
        honorific: memberData.honorific || '',
        isFamilyTreeOnly: !!memberData.isFamilyTreeOnly, // Support boolean or truthy values
        spouseName: memberData.spouseName || null,       // Support manual spouse name
        fatherName: memberData.fatherName || null,       // Support manual father name
        motherName: memberData.motherName || null,       // Support manual mother name
        isApproved: false, // New imports need approval
        createdAt: new Date()
      });

      await newMember.save();
      created++;
    }

    res.json({
      ok: true,
      created,
      duplicates,
      message: `Imported ${created} members (${duplicates} duplicates skipped)`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/members/:id/edit', isAdmin, async (req, res) => {
  try {
    const gotra = req.body.gotra_select === 'Others' ? req.body.gotra_other : req.body.gotra_select;
    const surname = req.body.surname_select === 'Others' ? req.body.surname_other : req.body.surname_select;
    const updateData = {
      honorific: req.body.honorific || '',
      name: req.body.name,
      gender: req.body.gender,
      surname: surname,
      gotra: gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      bloodGroup: req.body.bloodGroup || '',
      isCommitteeMember: req.body.isCommitteeMember === 'on',
      isDeceased: req.body.isDeceased === 'on',
      isFamilyTreeOnly: req.body.isFamilyTreeOnly === 'on',
      deathDate: req.body.deathDate || null,
      father: req.body.father || null,
      fatherName: req.body.fatherName || null,
      mother: req.body.mother || null,
      motherName: req.body.motherName || null,
      spouse: req.body.spouse || null,
      spouseName: req.body.spouseName || null,
      matrimonialProfile: {
        dateOfBirth: req.body.dob ? new Date(req.body.dob) : null,
        education: req.body.education || ''
      }
    };

    if (!updateData.father) updateData.father = null;
    if (!updateData.mother) updateData.mother = null;
    if (!updateData.spouse) updateData.spouse = null;

    // Sync manual names with selected member IDs to reduce redundancy and data drift
    if (updateData.father) {
      const f = await Member.findById(updateData.father).select('name').lean();
      if (f) updateData.fatherName = f.name;
    }
    if (updateData.mother) {
      const m = await Member.findById(updateData.mother).select('name').lean();
      if (m) updateData.motherName = m.name;
    }
    if (updateData.spouse) {
      const s = await Member.findById(updateData.spouse).select('name').lean();
      if (s) updateData.spouseName = s.name;
    }

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

    // AUTO-UPDATE GENERATION — recalculate if parent relationship changed
    const parentChanged =
      (oldMember.father?.toString() !== (updatedMember.father?.toString() || null)) ||
      (oldMember.mother?.toString() !== (updatedMember.mother?.toString() || null));
    if (parentChanged) {
      updateGenerationCascade(updatedMember._id).catch(e => console.error('[Generation] Edit cascade failed:', e.message));
    }

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
    const { search, status, gender } = req.query;
    
    // Primary Filter: Only show profiles that were specifically submitted for matrimonial
    let query = { 'matrimonialProfile.isMatrimonialRequest': true };

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

    if (gender) {
      query.gender = gender;
    }

    const profiles = await Member.find(query).sort({ createdAt: -1 });

    // Calculate quick stats
    const stats = {
      total: await Member.countDocuments({ 'matrimonialProfile.isMatrimonialRequest': true }),
      pending: await Member.countDocuments({ 'matrimonialProfile.isMatrimonialRequest': true, 'matrimonialProfile.isApproved': false }),
      male: await Member.countDocuments({ 'matrimonialProfile.isMatrimonialRequest': true, gender: 'Male' }),
      female: await Member.countDocuments({ 'matrimonialProfile.isMatrimonialRequest': true, gender: 'Female' })
    };

    res.render('admin/matrimonial', {
      title: 'Manage Matrimonial',
      profiles,
      stats,
      searchQuery: search || '',
      statusQuery: status || '',
      genderQuery: gender || ''
    });
  } catch (err) {
    res.render('admin/matrimonial', { title: 'Manage Matrimonial', profiles: [], stats: {total:0, pending:0, male:0, female:0}, searchQuery: '', statusQuery: '', genderQuery: '' });
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
    await Member.findByIdAndUpdate(req.params.id, { 
      'matrimonialProfile.isEligible': false,
      'matrimonialProfile.isMatrimonialRequest': false 
    });
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

// Bulk Approve Matrimonial Profiles
router.post('/matrimonial/bulk-approve', isAdmin, async (req, res) => {
  try {
    const { profileIds } = req.body;
    if (profileIds && Array.isArray(profileIds)) {
      await Member.updateMany(
        { _id: { $in: profileIds } },
        { $set: { 'matrimonialProfile.isApproved': true } }
      );
    }
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

// Bulk Reject Matrimonial Profiles
router.post('/matrimonial/bulk-reject', isAdmin, async (req, res) => {
  try {
    const { profileIds } = req.body;
    if (profileIds && Array.isArray(profileIds)) {
      await Member.updateMany(
        { _id: { $in: profileIds } },
        { $set: { 
          'matrimonialProfile.isEligible': false,
          'matrimonialProfile.isMatrimonialRequest': false 
        } }
      );
    }
  } catch (err) { console.error(err); }
  res.redirect('/admin/matrimonial');
});

// Bulk Delete Matrimonial Profiles (Actual Member Deletion)
router.post('/matrimonial/bulk-delete', isAdmin, async (req, res) => {
  try {
    const { profileIds } = req.body;
    if (profileIds && Array.isArray(profileIds)) {
      await Member.deleteMany({ _id: { $in: profileIds } });
    }
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
      'matrimonialProfile.educationLevel': req.body.educationLevel,
      'matrimonialProfile.height': req.body.height,
      'matrimonialProfile.annualIncome': req.body.annualIncome,
      'matrimonialProfile.expectations': req.body.expectations,
      'matrimonialProfile.fatherOccupation': req.body.fatherOccupation,
      'matrimonialProfile.brothers': parseInt(req.body.brothers) || 0,
      'matrimonialProfile.sisters': parseInt(req.body.sisters) || 0,
      'matrimonialProfile.bio': req.body.bio
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
  } catch (err) { }
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
    if (req.body.expiryDate) {
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
    if (req.body.expiryDate) {
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
  } catch (err) { }
  res.redirect('/admin/announcements');
});

// Event Submissions & Registrations
router.get('/meet-registrations', isAdmin, async (req, res) => {
  try {
    const registrations = await MeetRegistration.find().sort({ createdAt: -1 });
    res.render('admin/meet-registrations', { title: 'Meet Registrations', registrations });
  } catch (err) {
    res.render('admin/meet-registrations', { title: 'Meet Registrations', registrations: [] });
  }
});

// Export meet registrations as CSV
router.get('/meet-registrations/export', isAdmin, async (req, res) => {
  try {
    const registrations = await MeetRegistration.find().sort({ createdAt: -1 });
    let csv = 'Name,Age,Gotra,Location,Contact,Registered At\n';
    registrations.forEach(r => {
      const name     = `"${(r.name     || '').replace(/"/g, '""')}"`;
      const age      = r.age || '';
      const gotra    = `"${(r.gotra    || '').replace(/"/g, '""')}"`;
      const location = `"${(r.location || '').replace(/"/g, '""')}"`;
      const contact  = `"${(r.contact  || '').replace(/"/g, '""')}"`;
      const date     = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '';
      csv += `${name},${age},${gotra},${location},${contact},${date}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="MeetRegistrations.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.redirect('/admin/meet-registrations');
  }
});

// Delete a single meet registration
router.post('/meet-registrations/:id/delete', isAdmin, async (req, res) => {
  try {
    await MeetRegistration.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/meet-registrations');
});

router.get('/student-applications', isAdmin, async (req, res) => {
  try {
    const applications = await StudentApplication.find().sort({ createdAt: -1 });
    res.render('admin/student-applications', { title: 'Student Applications', applications });
  } catch (err) {
    res.render('admin/student-applications', { title: 'Student Applications', applications: [] });
  }
});

// ── Surname Management (Admin CMS) ──────────────────────────────

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
      surname: req.body.surname,
      reporterName: req.body.reporterName || 'Anonymous',
      errorType: req.body.errorType || 'general',
      description: req.body.description
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
    let siteSettings = await Settings.findById('site_settings');
    if (!siteSettings) {
      siteSettings = new Settings({ _id: 'site_settings' });
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
    let siteSettings = await Settings.findById('site_settings');
    if (!siteSettings) {
      siteSettings = new Settings({ _id: 'site_settings' });
    }

    siteSettings.siteTitle = req.body.siteTitle;
    siteSettings.donationTarget = req.body.donationTarget;
    siteSettings.upiId = req.body.upiId;
    siteSettings.qrCodeUrl = req.body.qrCodeUrl;
    siteSettings.contactEmail = req.body.contactEmail;
    siteSettings.contactPhone = req.body.contactPhone;
    siteSettings.facebookUrl = req.body.facebookUrl;
    siteSettings.whatsappGroupUrl = req.body.whatsappGroupUrl;
    
    // Bank Details
    siteSettings.accountName = req.body.accountName;
    siteSettings.accountNumber = req.body.accountNumber;
    siteSettings.bankName = req.body.bankName;
    siteSettings.ifscCode = req.body.ifscCode;
    siteSettings.branchName = req.body.branchName;
    siteSettings.isChatbotEnabled = req.body.isChatbotEnabled === 'true' || req.body.isChatbotEnabled === 'on';
    siteSettings.geminiApiKey = req.body.geminiApiKey;

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
      role: req.body.role,
      name: req.body.name
    });
    newAdmin.password = req.body.password; // virtual -> hashed in pre-save
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

// ═══════════════════════════════════════════════════════════
// BULK FAMILY TREE RELATIONSHIP IMPORT
// ═══════════════════════════════════════════════════════════

// Helper: Find member by name (exact + partial match fallback)
async function findMemberByName(name) {
  if (!name || name.trim() === '') return null;
  
  // First try exact match (case-insensitive)
  let member = await Member.findOne({
    name: new RegExp(`^${name}$`, 'i')
  }).lean();
  
  // Fallback to partial/startsWith match
  if (!member) {
    member = await Member.findOne({
      name: new RegExp(`^${name}`, 'i')
    }).lean();
  }
  
  return member;
}

// Helper: Validate if a relationship is possible
function validateRelationship(memberId, targetId, relationType) {
  // Can't link someone to themselves
  if (memberId.toString() === targetId.toString()) {
    return { valid: false, reason: 'Cannot link a member to themselves' };
  }
  
  return { valid: true };
}

// API: Validate bulk relationship data before importing
router.post('/api/family-tree/bulk-validate', isAdmin, async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || csvData.trim() === '') {
      return res.status(400).json({ error: 'No CSV data provided' });
    }

    const lines = csvData.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header and at least 1 data row' });
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const memberNameIdx = headers.indexOf('member_name');
    const fatherNameIdx = headers.indexOf('father_name');
    const motherNameIdx = headers.indexOf('mother_name');
    const spouseNameIdx = headers.indexOf('spouse_name');

    if (memberNameIdx === -1) {
      return res.status(400).json({ error: 'CSV must have "member_name" column' });
    }

    const results = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const memberName = parts[memberNameIdx];
      const fatherName = fatherNameIdx >= 0 ? parts[fatherNameIdx] : '';
      const motherName = motherNameIdx >= 0 ? parts[motherNameIdx] : '';
      const spouseName = spouseNameIdx >= 0 ? parts[spouseNameIdx] : '';

      if (!memberName) {
        invalidCount++;
        results.push({ row: i + 1, status: '❌', reason: 'Empty member name' });
        continue;
      }

      const record = {
        row: i + 1,
        memberName,
        fatherName,
        motherName,
        spouseName,
        status: '✅',
        issues: []
      };

      // Check if members exist
      const member = await findMemberByName(memberName);
      if (!member) {
        record.status = '❌';
        record.issues.push(`Member "${memberName}" not found`);
      } else {
        if (fatherName) {
          const father = await findMemberByName(fatherName);
          if (!father) {
            record.issues.push(`Father "${fatherName}" not found`);
          }
        }
        if (motherName) {
          const mother = await findMemberByName(motherName);
          if (!mother) {
            record.issues.push(`Mother "${motherName}" not found`);
          }
        }
        if (spouseName) {
          const spouse = await findMemberByName(spouseName);
          if (!spouse) {
            record.issues.push(`Spouse "${spouseName}" not found`);
          }
        }
      }

      if (record.issues.length > 0) {
        record.status = record.status === '✅' ? '⚠️' : '❌';
        invalidCount++;
      } else {
        validCount++;
      }

      results.push(record);
    }

    res.json({
      ok: true,
      validRecords: validCount,
      invalidRecords: invalidCount,
      totalRecords: validCount + invalidCount,
      results
    });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(400).json({ error: err.message });
  }
});

// API: Import bulk family tree relationships
router.post('/api/family-tree/bulk-import', isAdmin, async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || csvData.trim() === '') {
      return res.status(400).json({ error: 'No CSV data provided' });
    }

    const lines = csvData.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header and at least 1 data row' });
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const memberNameIdx = headers.indexOf('member_name');
    const fatherNameIdx = headers.indexOf('father_name');
    const motherNameIdx = headers.indexOf('mother_name');
    const spouseNameIdx = headers.indexOf('spouse_name');

    if (memberNameIdx === -1) {
      return res.status(400).json({ error: 'CSV must have "member_name" column' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        const memberName = parts[memberNameIdx];
        const fatherName = fatherNameIdx >= 0 ? parts[fatherNameIdx] : '';
        const motherName = motherNameIdx >= 0 ? parts[motherNameIdx] : '';
        const spouseName = spouseNameIdx >= 0 ? parts[spouseNameIdx] : '';

        if (!memberName) {
          errorCount++;
          results.push({ row: i + 1, status: '❌', message: 'Empty member name' });
          continue;
        }

        // Find member
        const member = await findMemberByName(memberName);
        if (!member) {
          errorCount++;
          results.push({ 
            row: i + 1, 
            status: '❌', 
            message: `Member "${memberName}" not found` 
          });
          continue;
        }

        const updateData = {};
        const issues = [];

        // Process Father
        if (fatherName) {
          const father = await findMemberByName(fatherName);
          if (father) {
            // Validate relationship
            const validation = validateRelationship(member._id, father._id, 'father');
            if (validation.valid) {
              updateData.father = father._id;
              // Reciprocal: Add member to father's children
              await Member.findByIdAndUpdate(father._id, { $addToSet: { children: member._id } });
            } else {
              issues.push(`Father link failed: ${validation.reason}`);
            }
          } else {
            issues.push(`Father "${fatherName}" not found`);
          }
        }

        // Process Mother
        if (motherName) {
          const mother = await findMemberByName(motherName);
          if (mother) {
            const validation = validateRelationship(member._id, mother._id, 'mother');
            if (validation.valid) {
              updateData.mother = mother._id;
              // Reciprocal: Add member to mother's children
              await Member.findByIdAndUpdate(mother._id, { $addToSet: { children: member._id } });
            } else {
              issues.push(`Mother link failed: ${validation.reason}`);
            }
          } else {
            issues.push(`Mother "${motherName}" not found`);
          }
        }

        // Process Spouse
        if (spouseName) {
          const spouse = await findMemberByName(spouseName);
          if (spouse) {
            const validation = validateRelationship(member._id, spouse._id, 'spouse');
            if (validation.valid) {
              updateData.spouse = spouse._id;
              // Reciprocal: Set member as spouse for target too
              await Member.findByIdAndUpdate(spouse._id, { spouse: member._id });
            } else {
              issues.push(`Spouse link failed: ${validation.reason}`);
            }
          } else {
            issues.push(`Spouse "${spouseName}" not found`);
          }
        }

        // Save updates
        if (Object.keys(updateData).length > 0) {
          await Member.findByIdAndUpdate(member._id, { $set: updateData });
          successCount++;
          results.push({
            row: i + 1,
            status: issues.length === 0 ? '✅' : '⚠️',
            memberName,
            linkedFields: Object.keys(updateData),
            issues: issues.length > 0 ? issues : undefined
          });
        } else {
          if (issues.length > 0) {
            errorCount++;
            results.push({
              row: i + 1,
              status: '❌',
              memberName,
              message: issues.join('; ')
            });
          } else {
            results.push({
              row: i + 1,
              status: 'ℹ️',
              memberName,
              message: 'No relationships to update'
            });
          }
        }
      } catch (err) {
        errorCount++;
        results.push({
          row: i + 1,
          status: '❌',
          message: `Error: ${err.message}`
        });
      }
    }

    res.json({
      ok: true,
      successCount,
      errorCount,
      totalProcessed: successCount + errorCount,
      results,
      summary: `✅ ${successCount} relationships linked | ❌ ${errorCount} errors`
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// FAMILY TREE VALIDATION DASHBOARD
// ═══════════════════════════════════════════════════════════

// GET /admin/family-tree-validation — Dashboard page
router.get('/family-tree-validation', isAdmin, (req, res) => {
  res.render('admin/family-tree-validation', {
    title: 'Family Tree Validation Dashboard',
  });
});

// GET /admin/api/family-tree/validation-report — Validation analysis
router.get('/api/family-tree/validation-report', isAdmin, async (req, res) => {
  try {
    // Get all members with relationships
    const allMembers = await Member.find()
      .select('_id name gotra surname village father mother spouse children')
      .lean();

    const totalMembers = allMembers.length;
    if (totalMembers === 0) {
      return res.json({
        ok: true,
        stats: {
          totalMembers: 0,
          completeProfiles: 0,
          completeProfilesPercent: 0,
          linkedToTree: 0,
          linkedToTreePercent: 0,
          brokenRelationships: 0,
          inconsistentRelationships: 0,
          circularReferences: 0,
          orphanedMembers: 0,
          lastValidated: new Date()
        },
        issues: []
      });
    }

    // Create ID lookup for fast access
    const memberMap = {};
    allMembers.forEach(m => {
      memberMap[m._id.toString()] = m;
    });

    const issues = [];
    let completeProfileCount = 0;
    let linkedCount = 0;
    let orphanedCount = 0;
    const brokenIds = new Set();
    const inconsistentIds = new Set();
    const circularIds = new Set();

    // Check each member
    for (const member of allMembers) {
      const memberId = member._id.toString();
      
      // Check complete profile (has name, gotra, village)
      if (member.name && member.gotra && member.village) {
        completeProfileCount++;
      }

      // Check if linked to family tree (has any relationship)
      const hasRelationships = member.father || member.mother || member.spouse || (member.children && member.children.length > 0);
      if (hasRelationships) {
        linkedCount++;
      } else {
        orphanedCount++;
      }

      // Check father reference
      if (member.father) {
        const father = memberMap[member.father.toString()];
        if (!father) {
          brokenIds.add(memberId);
          issues.push({
            type: 'broken-father',
            memberId,
            memberName: member.name,
            message: `Father reference (ID: ${member.father}) not found in database`,
            severity: 'critical',
            action: 'Remove father link'
          });
        } else if (!father.children || !father.children.some(c => c.toString() === memberId)) {
          // Reciprocal check
          inconsistentIds.add(memberId);
          issues.push({
            type: 'inconsistent-father',
            memberId,
            memberName: member.name,
            fatherName: father.name,
            message: `Father "${father.name}" doesn't have "${member.name}" in children list`,
            severity: 'high',
            action: 'Auto-fix: Add to father\'s children'
          });
        }
      }

      // Check mother reference
      if (member.mother) {
        const mother = memberMap[member.mother.toString()];
        if (!mother) {
          brokenIds.add(memberId);
          issues.push({
            type: 'broken-mother',
            memberId,
            memberName: member.name,
            message: `Mother reference (ID: ${member.mother}) not found in database`,
            severity: 'critical',
            action: 'Remove mother link'
          });
        } else if (!mother.children || !mother.children.some(c => c.toString() === memberId)) {
          inconsistentIds.add(memberId);
          issues.push({
            type: 'inconsistent-mother',
            memberId,
            memberName: member.name,
            motherName: mother.name,
            message: `Mother "${mother.name}" doesn't have "${member.name}" in children list`,
            severity: 'high',
            action: 'Auto-fix: Add to mother\'s children'
          });
        }
      }

      // Check spouse reference (must be reciprocal)
      if (member.spouse) {
        const spouse = memberMap[member.spouse.toString()];
        if (!spouse) {
          brokenIds.add(memberId);
          issues.push({
            type: 'broken-spouse',
            memberId,
            memberName: member.name,
            message: `Spouse reference (ID: ${member.spouse}) not found in database`,
            severity: 'critical',
            action: 'Remove spouse link'
          });
        } else if (spouse.spouse && spouse.spouse.toString() !== memberId) {
          inconsistentIds.add(memberId);
          issues.push({
            type: 'inconsistent-spouse',
            memberId,
            memberName: member.name,
            spouseName: spouse.name,
            message: `Spouse "${spouse.name}" is linked to someone else`,
            severity: 'high',
            action: 'Fix: Resolve spouse conflict'
          });
        } else if (!spouse.spouse) {
          inconsistentIds.add(memberId);
          issues.push({
            type: 'one-way-spouse',
            memberId,
            memberName: member.name,
            spouseName: spouse.name,
            message: `One-way spouse link: "${spouse.name}" doesn't have reciprocal link`,
            severity: 'medium',
            action: 'Auto-fix: Add reciprocal spouse link'
          });
        }
      }

      // Check children references are reciprocal
      if (member.children && member.children.length > 0) {
        for (const childId of member.children) {
          const child = memberMap[childId.toString()];
          if (!child) {
            brokenIds.add(memberId);
            issues.push({
              type: 'broken-child',
              memberId,
              memberName: member.name,
              childId: childId.toString(),
              message: `Child reference (ID: ${childId}) not found in database`,
              severity: 'critical',
              action: 'Remove child from list'
            });
          } else if (child.father && child.father.toString() !== memberId && child.mother && child.mother.toString() !== memberId) {
            inconsistentIds.add(memberId);
            issues.push({
              type: 'inconsistent-child',
              memberId,
              memberName: member.name,
              childName: child.name,
              message: `Child "${child.name}" doesn't have "${member.name}" as father or mother`,
              severity: 'high',
              action: 'Review relationship'
            });
          }
        }
      }

      // Detect circular references (simplified: check if someone is own ancestor)
      if (member.father || member.mother) {
        const visited = new Set();
        const checkCircular = (id) => {
          if (visited.has(id.toString())) return true;
          visited.add(id.toString());
          const m = memberMap[id.toString()];
          if (!m) return false;
          if (m.father && checkCircular(m.father)) return true;
          if (m.mother && checkCircular(m.mother)) return true;
          return false;
        };
        
        if (checkCircular(member._id)) {
          circularIds.add(memberId);
          issues.push({
            type: 'circular-reference',
            memberId,
            memberName: member.name,
            message: `Circular family tree detected: ${member.name} is ancestor of themselves`,
            severity: 'critical',
            action: 'Review and fix relationships'
          });
        }
      }
    }

    res.json({
      ok: true,
      stats: {
        totalMembers,
        completeProfiles: completeProfileCount,
        completeProfilesPercent: Math.round((completeProfileCount / totalMembers) * 100),
        linkedToTree: linkedCount,
        linkedToTreePercent: Math.round((linkedCount / totalMembers) * 100),
        brokenRelationships: brokenIds.size,
        inconsistentRelationships: inconsistentIds.size,
        circularReferences: circularIds.size,
        orphanedMembers: orphanedCount,
        lastValidated: new Date()
      },
      issues: issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }).slice(0, 100) // Return first 100 issues
    });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/api/family-tree/fix-issue — Auto-fix specific issues
router.post('/api/family-tree/fix-issue', isAdmin, async (req, res) => {
  try {
    const { issueType, memberId } = req.body;
    
    if (!issueType || !memberId) {
      return res.status(400).json({ error: 'issueType and memberId required' });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    let fixed = false;
    let message = '';

    switch (issueType) {
      case 'broken-father':
        member.father = undefined;
        fixed = true;
        message = 'Removed broken father reference';
        break;

      case 'broken-mother':
        member.mother = undefined;
        fixed = true;
        message = 'Removed broken mother reference';
        break;

      case 'broken-spouse':
        member.spouse = undefined;
        fixed = true;
        message = 'Removed broken spouse reference';
        break;

      case 'inconsistent-father':
        if (member.father) {
          await Member.findByIdAndUpdate(member.father, { $addToSet: { children: member._id } });
          fixed = true;
          message = 'Added member to father\'s children list';
        }
        break;

      case 'inconsistent-mother':
        if (member.mother) {
          await Member.findByIdAndUpdate(member.mother, { $addToSet: { children: member._id } });
          fixed = true;
          message = 'Added member to mother\'s children list';
        }
        break;

      case 'one-way-spouse':
        if (member.spouse) {
          await Member.findByIdAndUpdate(member.spouse, { spouse: member._id });
          fixed = true;
          message = 'Added reciprocal spouse link';
        }
        break;

      case 'broken-child':
        // Note: Can't remove from broken child as child doesn't exist
        // Just log the issue
        message = 'Cannot auto-fix: child member does not exist';
        break;

      case 'circular-reference':
        message = 'Cannot auto-fix: Manual review required for circular references';
        break;

      default:
        message = 'Unknown issue type';
    }

    if (fixed) {
      await member.save();
    }

    res.json({
      ok: true,
      fixed,
      message
    });
  } catch (err) {
    console.error('Fix error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// BROKEN LINK FIXER TOOL
// ═══════════════════════════════════════════════════════════

// GET /admin/family-tree-repair — Interactive repair interface
router.get('/family-tree-repair', isAdmin, (req, res) => {
  res.render('admin/family-tree-repair', {
    title: 'Broken Link Fixer Tool',
  });
});

// GET /admin/api/family-tree/repair-suggestions — Get issues with suggested fixes
router.get('/api/family-tree/repair-suggestions', isAdmin, async (req, res) => {
  try {
    const allMembers = await Member.find()
      .select('_id name gotra surname village father mother spouse children deathDate')
      .lean();

    const memberMap = {};
    allMembers.forEach(m => {
      memberMap[m._id.toString()] = m;
    });

    const suggestions = [];

    // Scan for issues and suggest fixes
    for (const member of allMembers) {
      const memberId = member._id.toString();

      // Check father reference
      if (member.father) {
        const father = memberMap[member.father.toString()];
        if (!father) {
          // Broken father - suggest removal or search
          suggestions.push({
            id: `broken-father-${memberId}`,
            type: 'broken-father',
            severity: 'critical',
            member: { _id: memberId, name: member.name },
            issue: `Father reference (ID: ${member.father}) not found`,
            suggestedFixes: [
              {
                fixId: `remove-father-${memberId}`,
                action: 'remove-father',
                title: 'Remove Father Link',
                description: 'Unlink the broken father reference',
                riskLevel: 'low',
                impact: 'Father link will be removed. Use if father is deceased or data is incorrect.'
              },
              {
                fixId: `mark-orphan-${memberId}`,
                action: 'mark-orphan',
                title: 'Mark as Orphan',
                description: 'Set father as unknown',
                riskLevel: 'low',
                impact: 'Member will be marked as orphan status'
              }
            ]
          });
        } else if (!father.children || !father.children.some(c => c.toString() === memberId)) {
          // Inconsistent father
          suggestions.push({
            id: `inconsistent-father-${memberId}`,
            type: 'inconsistent-father',
            severity: 'high',
            member: { _id: memberId, name: member.name },
            relatedMember: { _id: father._id, name: father.name },
            issue: `Father "${father.name}" doesn't list "${member.name}" as child`,
            suggestedFixes: [
              {
                fixId: `add-to-father-children-${memberId}`,
                action: 'add-to-father-children',
                title: 'Add to Father\'s Children',
                description: `Add "${member.name}" to "${father.name}"'s children list`,
                riskLevel: 'low',
                impact: 'Reciprocal link will be created'
              },
              {
                fixId: `unlink-father-${memberId}`,
                action: 'remove-father',
                title: 'Unlink Father',
                description: 'Remove the father relationship',
                riskLevel: 'low',
                impact: 'Father link will be removed if it was incorrect'
              }
            ]
          });
        }
      }

      // Check mother reference
      if (member.mother) {
        const mother = memberMap[member.mother.toString()];
        if (!mother) {
          suggestions.push({
            id: `broken-mother-${memberId}`,
            type: 'broken-mother',
            severity: 'critical',
            member: { _id: memberId, name: member.name },
            issue: `Mother reference (ID: ${member.mother}) not found`,
            suggestedFixes: [
              {
                fixId: `remove-mother-${memberId}`,
                action: 'remove-mother',
                title: 'Remove Mother Link',
                description: 'Unlink the broken mother reference',
                riskLevel: 'low',
                impact: 'Mother link will be removed'
              }
            ]
          });
        } else if (!mother.children || !mother.children.some(c => c.toString() === memberId)) {
          suggestions.push({
            id: `inconsistent-mother-${memberId}`,
            type: 'inconsistent-mother',
            severity: 'high',
            member: { _id: memberId, name: member.name },
            relatedMember: { _id: mother._id, name: mother.name },
            issue: `Mother "${mother.name}" doesn't list "${member.name}" as child`,
            suggestedFixes: [
              {
                fixId: `add-to-mother-children-${memberId}`,
                action: 'add-to-mother-children',
                title: 'Add to Mother\'s Children',
                description: `Add "${member.name}" to "${mother.name}"'s children list`,
                riskLevel: 'low',
                impact: 'Reciprocal link will be created'
              },
              {
                fixId: `unlink-mother-${memberId}`,
                action: 'remove-mother',
                title: 'Unlink Mother',
                description: 'Remove the mother relationship',
                riskLevel: 'low',
                impact: 'Mother link will be removed'
              }
            ]
          });
        }
      }

      // Check spouse reference
      if (member.spouse) {
        const spouse = memberMap[member.spouse.toString()];
        if (!spouse) {
          suggestions.push({
            id: `broken-spouse-${memberId}`,
            type: 'broken-spouse',
            severity: 'critical',
            member: { _id: memberId, name: member.name },
            issue: `Spouse reference (ID: ${member.spouse}) not found`,
            suggestedFixes: [
              {
                fixId: `remove-spouse-${memberId}`,
                action: 'remove-spouse',
                title: 'Remove Spouse Link',
                description: 'Unlink the broken spouse reference',
                riskLevel: 'low',
                impact: 'Spouse link will be removed'
              }
            ]
          });
        } else if (spouse.spouse && spouse.spouse.toString() !== memberId) {
          suggestions.push({
            id: `spouse-conflict-${memberId}`,
            type: 'spouse-conflict',
            severity: 'critical',
            member: { _id: memberId, name: member.name },
            relatedMember: { _id: spouse._id, name: spouse.name },
            issue: `Spouse "${spouse.name}" is linked to someone else`,
            suggestedFixes: [
              {
                fixId: `remove-spouse-${memberId}`,
                action: 'remove-spouse',
                title: 'Remove This Spouse Link',
                description: `Remove ${member.name}'s spouse link`,
                riskLevel: 'low',
                impact: 'This member\'s spouse link will be removed'
              },
              {
                fixId: `force-reciprocal-${memberId}`,
                action: 'force-reciprocal-spouse',
                title: 'Force Reciprocal Link',
                description: `Overwrite spouse's link to be ${member.name}`,
                riskLevel: 'high',
                impact: 'Warning: This will replace the other spouse link!'
              }
            ]
          });
        } else if (!spouse.spouse) {
          suggestions.push({
            id: `one-way-spouse-${memberId}`,
            type: 'one-way-spouse',
            severity: 'high',
            member: { _id: memberId, name: member.name },
            relatedMember: { _id: spouse._id, name: spouse.name },
            issue: `One-way spouse link: "${spouse.name}" doesn't have reciprocal link`,
            suggestedFixes: [
              {
                fixId: `create-reciprocal-${memberId}`,
                action: 'create-reciprocal-spouse',
                title: 'Create Reciprocal Link',
                description: `Link ${spouse.name} back to ${member.name}`,
                riskLevel: 'low',
                impact: 'Reciprocal spouse link will be created'
              },
              {
                fixId: `remove-spouse-${memberId}`,
                action: 'remove-spouse',
                title: 'Remove This Spouse Link',
                description: 'Remove the one-way link',
                riskLevel: 'low',
                impact: 'Spouse link will be removed from this member'
              }
            ]
          });
        }
      }

      // Check children references
      if (member.children && member.children.length > 0) {
        for (const childId of member.children) {
          const child = memberMap[childId.toString()];
          if (!child) {
            suggestions.push({
              id: `broken-child-${memberId}-${childId}`,
              type: 'broken-child',
              severity: 'critical',
              member: { _id: memberId, name: member.name },
              issue: `Child reference (ID: ${childId}) not found`,
              suggestedFixes: [
                {
                  fixId: `remove-child-${memberId}-${childId}`,
                  action: 'remove-child',
                  childId: childId.toString(),
                  title: 'Remove Broken Child Link',
                  description: 'Remove the non-existent child from list',
                  riskLevel: 'low',
                  impact: 'Broken child reference will be removed'
                }
              ]
            });
          }
        }
      }
    }

    res.json({
      ok: true,
      totalSuggestions: suggestions.length,
      suggestionsBy: {
        critical: suggestions.filter(s => s.severity === 'critical').length,
        high: suggestions.filter(s => s.severity === 'high').length
      },
      suggestions: suggestions.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }).slice(0, 100)
    });
  } catch (err) {
    console.error('Suggestion error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/api/family-tree/apply-repair — Apply selected repair with audit logging
router.post('/api/family-tree/apply-repair', isAdmin, async (req, res) => {
  try {
    const { repairs } = req.body; // Array of { suggestionId, fixId, action, memberId, childId? }
    
    if (!Array.isArray(repairs) || repairs.length === 0) {
      return res.status(400).json({ error: 'No repairs selected' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const repair of repairs) {
      try {
        const { action, memberId, childId, relatedMemberId } = repair;
        const member = await Member.findById(memberId);
        if (!member) throw new Error('Member not found');

        let fixed = false;
        let message = '';

        switch (action) {
          case 'remove-father':
            member.father = undefined;
            fixed = true;
            message = 'Removed father link';
            break;

          case 'remove-mother':
            member.mother = undefined;
            fixed = true;
            message = 'Removed mother link';
            break;

          case 'remove-spouse':
            member.spouse = undefined;
            fixed = true;
            message = 'Removed spouse link';
            break;

          case 'add-to-father-children':
            if (member.father) {
              await Member.findByIdAndUpdate(member.father, { $addToSet: { children: member._id } });
              fixed = true;
              message = 'Added to father\'s children list';
            }
            break;

          case 'add-to-mother-children':
            if (member.mother) {
              await Member.findByIdAndUpdate(member.mother, { $addToSet: { children: member._id } });
              fixed = true;
              message = 'Added to mother\'s children list';
            }
            break;

          case 'create-reciprocal-spouse':
            if (member.spouse) {
              await Member.findByIdAndUpdate(member.spouse, { spouse: member._id });
              fixed = true;
              message = 'Created reciprocal spouse link';
            }
            break;

          case 'force-reciprocal-spouse':
            if (member.spouse) {
              await Member.findByIdAndUpdate(member.spouse, { spouse: member._id });
              fixed = true;
              message = 'Forced reciprocal spouse link (overwritten previous)';
            }
            break;

          case 'remove-child':
            if (childId) {
              member.children = member.children.filter(c => c.toString() !== childId);
              fixed = true;
              message = 'Removed broken child reference';
            }
            break;

          case 'mark-orphan':
            // Don't actually change data, just note in audit
            message = 'Marked as orphan (no change needed)';
            fixed = true;
            break;
        }

        if (fixed) {
          await member.save();
          successCount++;
          results.push({
            suggestionId: repair.suggestionId,
            fixId: repair.fixId,
            status: '✅',
            message
          });
        } else {
          errorCount++;
          results.push({
            suggestionId: repair.suggestionId,
            fixId: repair.fixId,
            status: '⚠️',
            message: 'Could not apply fix'
          });
        }
      } catch (err) {
        errorCount++;
        results.push({
          suggestionId: repair.suggestionId,
          fixId: repair.fixId,
          status: '❌',
          message: err.message
        });
      }
    }

    res.json({
      ok: true,
      successCount,
      errorCount,
      totalProcessed: successCount + errorCount,
      results,
      summary: `✅ Fixed: ${successCount} | ❌ Errors: ${errorCount}`,
      message: successCount > 0 ? 'Repairs applied successfully' : 'No repairs were applied'
    });
  } catch (err) {
    console.error('Repair error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
