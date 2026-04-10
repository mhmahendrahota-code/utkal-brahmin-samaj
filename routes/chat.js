const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Member = require('../models/Member');
const Announcement = require('../models/Announcement');

// In-memory cache for DB Context to dramatically speed up response times
let cachedContextParts = null;
let lastContextFetch = 0;

router.post('/', async (req, res) => {
  try {
    const siteSettings = req.app.locals.siteSettings;
    let apiKey = (siteSettings && siteSettings.geminiApiKey) ? siteSettings.geminiApiKey : process.env.GEMINI_API_KEY;
    apiKey = apiKey ? apiKey.trim() : null;

    // 1. Check if AI Key is configured
    if (!apiKey) {
      return res.status(500).json({ error: 'AI integration is not configured yet. Please add a Gemini API Key in Admin Settings.' });
    }

    // 2. Check if Chatbot is explicitly disabled by admin
    if (siteSettings && !siteSettings.isChatbotEnabled) {
      return res.status(403).json({ error: 'The AI Assistant is currently disabled by administrators.' });
    }

    // 3. Extract Message
    const { message, previousHistory } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // 4. Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    // Setting up the model (Using gemini-flash-latest to support 2026+ API versions)
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // 5. Gather Database Context using caching to save ~2 seconds of Mongoose latency per message
    const NOW = Date.now();
    if (!cachedContextParts || (NOW - lastContextFetch) > 30 * 60 * 1000) {
      const memberCount = await Member.countDocuments({ isDeceased: { $ne: true }, isFamilyTreeOnly: { $ne: true } });
      const gotras = await Member.distinct('gotra', { gotra: { $ne: null, $ne: '' } });
      const activeAnnouncements = await Announcement.find({
        isActive: true,
        $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }]
      }).sort({ createdAt: -1 }).limit(3);

      cachedContextParts = {
        count: memberCount,
        gotras: gotras.join(', ') || 'Various',
        events: activeAnnouncements.map(a => a.title).join(', ') || 'No upcoming public announcements.'
      };
      lastContextFetch = NOW;
    }

    // 6. Provide the System Prompt
    const systemInstruction = `You are a helpful, respectful, and friendly AI Assistant representing the "Utkal Brahmin Samaj Pusaur" community.

Context about the community:
- We currently have approximately ${cachedContextParts.count} active registered members in our directory.
- Common Gotras (Lineages) in our community include: ${cachedContextParts.gotras}.
- Important Announcements / Upcoming Events: ${cachedContextParts.events}.
- Community Office Address: Samaj Bhavan, Pusaur, District-Raigarh, Chhattisgarh.
- Community Contact: ${siteSettings?.contactPhone || '+91-9630809081'}, Email: ${siteSettings?.contactEmail || 'N/A'}.

Rules for you:
1. Always answer politely in the language the user speaks (English or Hindi/Hinglish). Use a warm and welcoming tone.
2. Keep your answers concise, scannable, and directly to the point.
3. If they ask for information about specific people (e.g., "Tell me Ram's details"), explain that due to privacy reasons, you cannot share specific members' details, but they can search the Member Directory or view Family Trees themselves.
4. If they ask about matrimonial profiles, guide them to the "Matrimonial" section of the website.
5. NEVER invent or hallucinate rules, member names, or events. Only use the provided context or general knowledge about Indian culture/Utkal Brahmins.
6. If the user greets you, enthusiastically introduce yourself as "Parth" (पार्थ), the Utkal Brahmin Samaj AI Assistant. Use a respectful, slightly traditional tone.`;

    // 7. Establish Chat Session using Native Settings
    let chatHistory = [];
    if (Array.isArray(previousHistory)) {
      chatHistory = previousHistory.map(h => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: [{ text: h.text || '' }]
      }));
    }

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: { parts: [{ text: systemInstruction }] }
    });

    // 8. Send Request to Gemini
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    res.json({ reply: responseText });

  } catch (err) {
    console.error('Chatbot API Error:', err.message);
    if (err.message && err.message.includes('API key not valid')) {
      return res.status(500).json({ error: 'Invalid Google Gemini API Key. Please verify it in Settings.' });
    }
    if (err.message && (err.message.includes('503 Service Unavailable') || err.message.includes('Quota exceeded') || err.message.includes('429'))) {
      return res.status(503).json({ error: 'क्षमा करें, आपने थोड़ी देर में बहुत सारे मैसेज भेज दिए हैं (Quota Limit) या  AI का सर्वर बिज़ी है। कृपया 1-2 मिनट बाद कोशिश करें।' });
    }
    res.status(500).json({ error: 'सर्वर से कनेक्ट करने में समस्या आ रही है। कृपया थोड़ी देर बाद फिर से प्रयास करें।' });
  }
});

module.exports = router;
