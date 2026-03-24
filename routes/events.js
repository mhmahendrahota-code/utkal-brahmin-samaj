const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const MeetRegistration = require('../models/MeetRegistration');
const StudentApplication = require('../models/StudentApplication');

// GET all events
router.get('/', async (req, res) => {
  try {
    const upcomingEvents = await Event.find({ date: { $gte: new Date() }, isActive: true }).sort({ date: 1 });
    const pastEvents = await Event.find({ date: { $lt: new Date() }, isActive: true }).sort({ date: -1 }).limit(10);
    
    res.render('events/index', { 
      title: 'Events & Festivals',
      upcomingEvents,
      pastEvents
    });
  } catch (err) {
    console.error('Database connection issue:', err.message);
    res.render('events/index', { 
      title: 'Events & Festivals',
      upcomingEvents: [],
      pastEvents: []
    });
  }
});

// Matrimonial Meet Routes
router.get('/meet-register', (req, res) => {
  res.render('events/meet-register', { title: 'Register for Matrimonial Meet', success: false });
});

router.post('/meet-register', async (req, res) => {
  try {
    const newReg = new MeetRegistration(req.body);
    await newReg.save();
    res.render('events/meet-register', { title: 'Register for Matrimonial Meet', success: true });
  } catch(err) {
    console.error(err);
    res.redirect('/events/meet-register');
  }
});

// Student Felicitation Routes
router.get('/student-apply', (req, res) => {
  res.render('events/student-apply', { title: 'Apply for Student Felicitation', success: false });
});

router.post('/student-apply', async (req, res) => {
  try {
    const newApp = new StudentApplication(req.body);
    await newApp.save();
    res.render('events/student-apply', { title: 'Apply for Student Felicitation', success: true });
  } catch(err) {
    console.error(err);
    res.redirect('/events/student-apply');
  }
});

// GET specific event details
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send('Event not found');
    
    res.render('events/show', { 
      title: event.title,
      event 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Event RSVP Route
router.post('/:id/rsvp', async (req, res) => {
  try {
    // Basic implementation: Increment going count
    // In a real app we'd track user IDs to prevent multiple RSVPs
    await Event.findByIdAndUpdate(req.params.id, { $inc: { rsvpCount: 1 } });
    res.redirect('/events');
  } catch (err) {
    console.error(err);
    res.redirect('/events');
  }
});

module.exports = router;
