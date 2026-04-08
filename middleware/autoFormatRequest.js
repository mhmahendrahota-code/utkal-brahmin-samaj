const { titleCase, normalizeEmail, normalizePhone, sanitizeString } = require('../utils/formatters');

function shouldTitleCase(key) {
  const k = key.toLowerCase();
  // Avoid transforming identifiers like `username` — only title-case actual name fields
  if (k === 'username' || k.endsWith('id')) return false;
  if (k === 'name' || k.endsWith('name')) return true;
  return ['surname', 'gotra', 'village', 'district', 'state', 'occupation'].includes(k);
}

function shouldEmail(key) {
  const k = key.toLowerCase();
  return k.includes('email');
}

function shouldPhone(key) {
  const k = key.toLowerCase();
  return k.includes('phone') || k.includes('contact') || k.includes('mobile');
}

function formatValue(key, value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (shouldPhone(key)) return normalizePhone(value);
    if (shouldEmail(key)) return normalizeEmail(value);
    if (shouldTitleCase(key)) return titleCase(value);
    return sanitizeString(value);
  }
  return value;
}

function walkAndFormat(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' ? walkAndFormat(item) : item));
  }
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v && typeof v === 'object') {
        walkAndFormat(v);
      } else {
        obj[k] = formatValue(k, v);
      }
    });
  }
  return obj;
}

module.exports = function autoFormatRequest(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      walkAndFormat(req.body);
    }

    // Optional: Add request logging
    if (process.env.LOG_REQUESTS === 'true' || process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
  } catch (e) {
    // Do not block request on formatting errors; log for debugging
    console.error('autoFormatRequest error:', e);
  }
  next();
};

