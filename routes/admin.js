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
  const adminCount = await AdminUser.countDocuments();
  if (adminCount === 0) {
    const defaultAdmin = new AdminUser({
      username: process.env.ADMIN_USERNAME || 'admin',
      // Plain-text value — the pre-save hook will hash it automatically
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

  // Look up the user by username, then verify the password against its bcrypt hash
  const user = await AdminUser.findOne({ username });
  if (user && await user.comparePassword(password)) {
    req.session.isAdmin = true;
    req.session.adminRole = user.role;
    req.session.adminName = user.name;
    req.session.adminId = user._id;
    return res.redirect('/admin');
  }

  // Fallback to .env credentials (safety net for development / recovery)
  const envUser = await AdminUser.findOne({ username: process.env.ADMIN_USERNAME });
  const isEnvAdmin =
    username === process.env.ADMIN_USERNAME &&
    (envUser
      ? await envUser.comparePassword(password)
      : password === process.env.ADMIN_PASSWORD);

  if (isEnvAdmin) {
    req.session.isAdmin = true;
    req.session.adminRole = 'Super Admin';
    req.session.adminName = 'Root Admin';
    return res.redirect('/admin');
  }

  res.render('admin/login', { title: 'Admin Login', error: 'Invalid username or password' });
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

router.get('/members/add', isAdmin, (req, res) => {
  res.render('admin/member-form', { title: 'Add New Member' });
});

router.post('/members/add', isAdmin, async (req, res) => {
  try {
    const newMember = new Member({
      name: req.body.name,
      gotra: req.body.gotra,
      village: req.body.village,
      occupation: req.body.occupation,
      contactNumber: req.body.contactNumber,
      email: req.body.email,
      address: req.body.address,
      isCommitteeMember: req.body.isCommitteeMember === 'on'
    });
    await newMember.save();
    res.redirect('/admin/members');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/members/add');
  }
});

router.post('/members/:id/delete', isAdmin, async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
  } catch (err) { console.error(err); }
  res.redirect('/admin/members');
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
