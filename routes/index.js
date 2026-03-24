const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Home page
router.get('/', async (req, res) => {
  const siteTitle = req.app.locals.siteSettings ? req.app.locals.siteSettings.siteTitle : 'Utkal Brahmin Samaj';
  try {
    // Fetch upcoming events for the ticker/slider
    const upcomingEvents = await Event.find({ date: { $gte: new Date() }, isActive: true })
      .sort({ date: 1 })
      .limit(3);

    res.render('index', {
      title: siteTitle,
      events: upcomingEvents
    });
  } catch (err) {
    console.error('Database connection issue:', err.message);
    // Render gracefully without data
    res.render('index', {
      title: siteTitle,
      events: []
    });
  }
});

// Donation Page
router.get('/donate', async (req, res) => {
  try {
    const donationsList = await Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalRaised = donationsList.length > 0 ? donationsList[0].total : 0;
    const targetGoal = req.app.locals.siteSettings ? req.app.locals.siteSettings.donationTarget : 500000;
    res.render('donate', { title: 'Donation & Trust', totalRaised, targetGoal });
  } catch (err) {
    const targetGoal = req.app.locals.siteSettings ? req.app.locals.siteSettings.donationTarget : 500000;
    res.render('donate', { title: 'Donation & Trust', totalRaised: 0, targetGoal });
  }
});

const Committee = require('../models/Committee');

// About Us
router.get('/about', async (req, res) => {
  try {
    const committeeMembers = await Committee.find().sort({ priority: 1, name: 1 });
    res.render('about', { title: 'About Utkal Brahmin Samaj', committee: committeeMembers });
  } catch (err) {
    console.error(err);
    res.render('about', { title: 'About Utkal Brahmin Samaj', committee: [] });
  }
});

const Message = require('../models/Message');

// Contact Form Submission
router.post('/contact-submit', async (req, res) => {
  try {
    const newMessage = new Message({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message
    });
    await newMessage.save();
    
    // We could use flash messages here, but a simple redirect with query param works for now
    res.redirect('/about?contact=success#contact');
  } catch (err) {
    console.error(err);
    res.redirect('/about?contact=error#contact');
  }
});

const Document = require('../models/Document');

// Document Library Page
router.get('/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ dateUploaded: -1 });
    res.render('documents', { title: 'Document & Resource Library', documents });
  } catch (err) {
    console.error(err);
    res.render('documents', { title: 'Document & Resource Library', documents: [] });
  }
});

const Gallery = require('../models/Gallery');

// Gallery Page
router.get('/gallery', async (req, res) => {
  try {
    const images = await Gallery.find().sort({ dateUploaded: -1 });
    res.render('gallery', { title: 'Photo Gallery', images });
  } catch (err) {
    res.render('gallery', { title: 'Photo Gallery', images: [] });
  }
});

const Surname = require('../models/Surname');

// Surname Directory Page
router.get('/surnames', async (req, res) => {
  try {
    let surnamesList = await Surname.find();
    
    // One-time auto-seed function to prevent losing the existing 27 dictionary words
    if (surnamesList.length === 0) {
      console.log('Seeding initial 27 Surnames into database...');
      const SURNAMES_SEED = [
        { surname: "Acharya", hindiName: "आचार्य", meaning: "Teacher or Guru — those who taught the Vedas and scriptures and provided spiritual guidance.", meaningHindi: "शिक्षक या गुरु: जो वेदों और शास्त्रों का अध्यापन करते थे और आध्यात्मिक दिशा-निर्देश देते थे।", gotra: "Vashistha" },
        { surname: "Bahubali", hindiName: "बाहुबलीबलवान", meaning: "The Strong — Brahmins who were physically mighty and often took responsibility for protecting temples or rituals.", meaningHindi: "बलवान: वे ब्राह्मण जो शारीरिक रूप से अत्यंत मजबूत होते थे और अक्सर मंदिरों या अनुष्ठानों की सुरक्षा का जिम्मा संभालते थे।", gotra: "Bharadwaj" },
        { surname: "Brahma", hindiName: "ब्रह्मा", meaning: "Chief Priest — the supreme priest who oversees the Yajna and corrects errors in its performance.", meaningHindi: "मुख्य पुरोहित: यज्ञ (Yajna) का निरीक्षण करने वाले और उसमें होने वाली त्रुटियों को सुधारने वाले सर्वोच्च पुरोहित।", gotra: "Atri" },
        { surname: "Chaini", hindiName: "चैनि", meaning: "The Selector — from Sanskrit 'Chayan'; those who selected the correct mantras and methods for Vedic rituals.", meaningHindi: "चयनकर्ता: संस्कृत शब्द 'चयन' से उत्पन्न। जो वैदिक अनुष्ठानों के लिए सही मंत्रों और विधियों का चयन करते थे।", gotra: "Gargya" },
        { surname: "Chaturvedi", hindiName: "चतुर्वेदी", meaning: "Knower of Four Vedas — one who has mastered all four Vedas: Rigveda, Yajurveda, Samaveda, and Atharvaveda.", meaningHindi: "चार वेदों के ज्ञाता: जिन्हें ऋग्वेद, यजुर्वेद, सामवेद और अथर्ववेद—चारों का ज्ञान हो।", gotra: "Gautama" },
        { surname: "Dash / Das", hindiName: "दाश / दास", meaning: "Scholar / Servant of God — in Utkal Brahmin tradition, 'Das' denotes deep scholarship and devotion to Lord Jagannath.", meaningHindi: "विद्वान / ईश्वर के सेवक: उत्कल ब्राह्मणों में 'दाश' शब्द का प्रयोग गहन विद्वत्ता और भगवान जगन्नाथ के प्रति समर्पण के लिए होता है।", gotra: "Atri" },
        { surname: "Dixit", hindiName: "दीक्षित", meaning: "The Initiated — a Brahmin who has taken 'Diksha' (initiation) for performing special Vedic rituals or Yajnas.", meaningHindi: "दीक्षा प्राप्त: वह ब्राह्मण जिसने विशेष वैदिक अनुष्ठान या यज्ञ संपन्न करने की 'दीक्षा' ली हो।", gotra: "Kashyapa" },
        { surname: "Dwivedi", hindiName: "द्विवेदी", meaning: "Knower of Two Vedas — one who has deep mastery of any two of the four Vedas.", meaningHindi: "दो वेदों के ज्ञाता: जिन्हें किन्हीं दो वेदों का गहन ज्ञान हो।", gotra: "Bharadwaj" },
        { surname: "Hota", hindiName: "होता", meaning: "The Invoker — from 'Hotri'; those who chanted Rigvedic hymns aloud during Yajna to invoke the gods.", meaningHindi: "आह्वान करने वाले: 'होतृ' शब्द से बना। जो यज्ञ में ऋग्वेद के मंत्रों का सस्वर पाठ कर देवताओं का आह्वान करते थे।", gotra: "Kashyapa" },
        { surname: "Kar / Kaar", hindiName: "कर", meaning: "Revenue Manager — historically, Brahmins who managed taxation and state finances for kings.", meaningHindi: "राजस्व प्रबंधक: ऐतिहासिक रूप से जो ब्राह्मण राजाओं के लिए कर (Tax) या राज्य के वित्त का प्रबंधन करते थे।", gotra: "Parashara" },
        { surname: "Mahapatra", hindiName: "महापात्र", meaning: "Chief Advisor — Brahmins who served as Prime Ministers or chief political advisors in the Gajapati royal courts.", meaningHindi: "मुख्य सलाहकार: गजपति राजाओं के दरबार में जो ब्राह्मण मुख्यमंत्री या मुख्य राजनैतिक सलाहकार होते थे।", gotra: "Vashistha" },
        { surname: "Mishra", hindiName: "मिश्र", meaning: "The Versatile Scholar — one who has 'mixed' or comprehensive knowledge of Vedas, scriptures, and various fields of learning.", meaningHindi: "मिश्रित ज्ञाता: जिन्हें वेदों, शास्त्रों और विभिन्न विद्याओं का 'मिश्रित' (संपूर्ण) ज्ञान हो।", gotra: "Shandilya" },
        { surname: "Nanda", hindiName: "नंदा", meaning: "The Joyful — those who performed auspicious ceremonies and festivals, bringing joy and happiness to the community.", meaningHindi: "आनंद देने वाले: जो मांगलिक कार्यों और उत्सवों को संपन्न कराकर समाज में आनंद लाते थे।", gotra: "Gautama" },
        { surname: "Padhi", hindiName: "पाढ़ी", meaning: "The Reciter — those who recited sacred scriptures and Puranas daily in temples or royal courts.", meaningHindi: "पाठ करने वाले: जो मंदिरों या राजा के दरबार में पवित्र ग्रंथों और पुराणों का नित्य पाठ करते थे।", gotra: "Gargya" },
        { surname: "Panda", hindiName: "पंडा", meaning: "Temple Priest / Pilgrim Guide — those who perform the main rituals in temples and guide pilgrims.", meaningHindi: "तीर्थ पुरोहित: जो मंदिरों में मुख्य पूजा-पाठ संभालते हैं और तीर्थयात्रियों का मार्गदर्शन करते हैं।", gotra: "Bharadwaj" },
        { surname: "Panigrahi", hindiName: "पणिग्राही", meaning: "The Wedding Priest — from 'Pani' (hand) + 'Grahi' (holder); the chief priest who performs the Panigrahan (wedding) ceremony.", meaningHindi: "पाणिग्रहण कराने वाले: 'पाणि' (हाथ) + 'ग्राही' (पकड़ना)। जो विवाह संस्कार संपन्न कराने के मुख्य पुरोहित होते थे।", gotra: "Kaundinya" },
        { surname: "Pati", hindiName: "पति", meaning: "Lord / Protector — the master and guardian of a major ritual or Yajna.", meaningHindi: "स्वामी या रक्षक: किसी बड़े अनुष्ठान या यज्ञ के रक्षक और स्वामी।", gotra: "Parashara" },
        { surname: "Pujari", hindiName: "पुजारी", meaning: "The Worshipper — whose primary duty is the daily service (Seva) and decoration of the deity.", meaningHindi: "पूजा करने वाले: जिनका मुख्य कार्य भगवान की दैनिक सेवा और श्रृंगार करना होता है।", gotra: "Vishwamitra" },
        { surname: "Purohit", hindiName: "पुरोहित", meaning: "The Foremost Benefactor — 'Puro' (ahead) + 'Hita' (welfare); the family priest who leads all religious rites.", meaningHindi: "प्रथम हितैषी: 'पुरः' (आगे) + 'हित' (भलाई)। जो यजमान (परिवार) का नेतृत्व कर उनके सभी धार्मिक संस्कार संपन्न कराते हैं।", gotra: "Atri" },
        { surname: "Rajguru", hindiName: "राजगुरु", meaning: "Royal Preceptor — the personal spiritual guru and chief religious guide of kings.", meaningHindi: "शाही सलाहकार: राजाओं के निजी आध्यात्मिक गुरु और धर्म-कर्म के मुख्य मार्गदर्शक।", gotra: "Vashistha" },
        { surname: "Rath", hindiName: "रथ", meaning: "Chariot — those who were scriptural advisors for Lord Jagannath's Rath Yatra or military strategists in battle.", meaningHindi: "रथोत्सव के रक्षक/सलाहकार: जो भगवान जगन्नाथ की रथयात्रा के शास्त्र-सम्मत सलाहकार होते थे।", gotra: "Vishwamitra" },
        { surname: "Sarangi", hindiName: "षड़ंगी", meaning: "Knower of Six Vedangas — one who has mastered all six limbs of the Vedas: Shiksha, Kalpa, Vyakarana, Nirukta, Chhandas, and Jyotisha.", meaningHindi: "छह अंगों के ज्ञाता: जिन्हें वेदों के छह अंगों (शिक्षा, कल्प, व्याकरण, निरुक्त, छंद और ज्योतिष) का संपूर्ण ज्ञान हो।", gotra: "Kaushik" },
        { surname: "Satapathy", hindiName: "सतपथी", meaning: "Knower of Hundred Paths — one who has mastered the Shatapatha Brahmana (part of Yajurveda) or 100 hymns by heart.", meaningHindi: "सौ पथों के ज्ञाता: जिन्हें 'शतपथ ब्राह्मण' (यजुर्वेद का एक भाग) या 100 ऋचाओं का कंठस्थ ज्ञान हो।", gotra: "Kaundinya" },
        { surname: "Senapati", hindiName: "सेनापति", meaning: "Brahmin Warrior — in Odisha's history, many Brahmins led royal armies; this surname marks that lineage.", meaningHindi: "ब्राह्मण योद्धा: ओडिशा के इतिहास में कई ब्राह्मणों ने राजाओं की सेना का नेतृत्व किया था, यह उपनाम उन्हीं की पहचान है।", gotra: "Bharadwaj" },
        { surname: "Sharma", hindiName: "शर्मा", meaning: "Symbol of Happiness & Bliss — a traditional and honorific identity of Brahmins since the Vedic age.", meaningHindi: "सुख और आनंद का प्रतीक: यह वैदिक काल से ब्राह्मणों की एक पारंपरिक और सम्मानजनक पहचान है।", gotra: "Gargya" },
        { surname: "Tripathy / Tiwari", hindiName: "त्रिपाठी / तिवारी", meaning: "Knower of Three Vedas — one who has deep knowledge of three Vedas.", meaningHindi: "तीन वेदों के ज्ञाता: जिन्हें तीन वेदों का ज्ञान हो।", gotra: "Gautama" },
        { surname: "Udgata", hindiName: "उद्गाता", meaning: "Singer of the Samaveda — those who melodically chanted the hymns of the Samaveda during Yajna ceremonies.", meaningHindi: "सामवेद के गायक: जो यज्ञ के दौरान सामवेद के मंत्रों का संगीतमय गायन करते थे।", gotra: "Atri" }
      ];
      for (const item of SURNAMES_SEED) {
        await new Surname(item).save();
      }
      surnamesList = await Surname.find();
    }
    
    // Sort alphabetically by surname
    surnamesList.sort((a, b) => a.surname.localeCompare(b.surname));

    // Serialize cleanly
    const safeData = surnamesList.map(s => ({
      _id: s._id,
      surname: s.surname, hindiName: s.hindiName,
      meaning: s.meaning, meaningHindi: s.meaningHindi,
      gotra: s.gotra, letter: s.letter
    }));

    res.render('surnames', { title: 'Surname Directory', surnames: safeData });
  } catch (err) {
    console.error(err);
    res.render('surnames', { title: 'Surname Directory', surnames: [] });
  }
});

module.exports = router;
