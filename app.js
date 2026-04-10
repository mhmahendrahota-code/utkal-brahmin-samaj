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

// Rate Limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please try again later'
  }
});
app.use('/api', limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Auto-format incoming request text fields (trim, collapse spaces, title-case names, normalize phones/emails)
const autoFormatRequest = require('./middleware/autoFormatRequest');
app.use(autoFormatRequest);
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
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // Wait 30s before timeout
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    
    // Site Settings Singleton (Move inside connection success)
    const Settings = require('./models/Settings');
    try {
      let settings = await Settings.findById('site_settings');
      if (!settings) {
        settings = await Settings.create({ _id: 'site_settings' });
      }
      app.locals.siteSettings = settings;
      console.log('✅ Site settings loaded');
    } catch (err) {
      console.error('❌ Error loading site settings:', err);
    }
  })
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

// Import Routes
const indexRoutes = require('./routes/index');
const memberRoutes = require('./routes/members');
const eventRoutes = require('./routes/events');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

// Health Check Route
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

// Use Routes
app.use('/admin', adminRoutes);
app.use('/members', memberRoutes);
app.use('/events', eventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/', indexRoutes);

// Error Handler (must be at the end of middleware chain)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

