require('dotenv').config();
const dns = require('dns');
// Use Google's public DNS to resolve MongoDB Atlas SRV records reliably
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

// Trust Railway/Render/Heroku reverse proxy for HTTPS session cookies
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pusaur_samaj_secret_108',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View Engine Setup (using EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samaj_db';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Global Middleware for Database Data used in Layouts
const Announcement = require('./models/Announcement');
app.use(async (req, res, next) => {
  res.locals.isAdmin = req.session && req.session.isAdmin ? true : false;
  try {
    const activeAnnouncements = await Announcement.find({ 
      isActive: true, 
      $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }] 
    }).sort({ createdAt: -1 }).limit(5);
    res.locals.announcements = activeAnnouncements;
  } catch (err) {
    res.locals.announcements = [];
  }
  next();
});

// Site Settings Singleton
const Settings = require('./models/Settings');
Settings.findById('site_settings').then(async settings => {
  if (!settings) {
    settings = await Settings.create({ _id: 'site_settings' });
  }
  app.locals.siteSettings = settings;
}).catch(console.error);

// Import Routes
const indexRoutes = require('./routes/index');
const memberRoutes = require('./routes/members');
const eventRoutes = require('./routes/events');
const adminRoutes = require('./routes/admin');

// Use Routes
app.use('/admin', adminRoutes);
app.use('/members', memberRoutes);
app.use('/events', eventRoutes);
app.use('/', indexRoutes);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
