// Utility functions to normalize and format incoming text data
function collapseSpaces(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  if (!s || typeof s !== 'string') return s;
  return collapseSpaces(s)
    .split(' ')
    .map(w => {
      if (w.length === 0) return '';
      const first = w.charAt(0).toUpperCase();
      const rest = w.slice(1).toLowerCase();
      return first + rest;
    })
    .join(' ');
}

function normalizeEmail(s) {
  if (!s || typeof s !== 'string') return s;
  return collapseSpaces(s).toLowerCase();
}

function normalizePhone(s) {
  if (!s || typeof s !== 'string') return s;
  // Strip all non-digit chars
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  if (digits.length > 10 && digits.startsWith('91')) return '+' + digits;
  // Fallback: return digits as-is (but collapsed)
  return digits || s;
}

function sanitizeString(s) {
  if (s == null) return s;
  if (typeof s !== 'string') return s;
  return collapseSpaces(s);
}

module.exports = {
  titleCase,
  normalizeEmail,
  normalizePhone,
  sanitizeString,
  collapseSpaces,
};
