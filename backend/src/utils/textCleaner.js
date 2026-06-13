/**
 * Sanitizes and cleans text before storing it or rendering in the PDF.
 * Removes markdown symbols, emojis, special characters, and handles raw JSON formats.
 */
function cleanText(text) {
  if (text === null || text === undefined) return '';
  let str = String(text).trim();

  // If text is a raw JSON dump, extract the relevant message/summary
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const obj = JSON.parse(str);
      str = obj.summary || obj.message || obj.recommendation || obj.symptoms || str;
    } catch (e) {
      // Ignore parse errors, proceed with string
    }
  }

  // Normalize UTF-8 / Unicode
  str = str.normalize('NFC');

  // Remove markdown bold/italic/header symbols (like **, *, __, _, #, `)
  str = str.replace(/\*\*/g, '');
  str = str.replace(/\*/g, '');
  str = str.replace(/__/g, '');
  str = str.replace(/_/g, '');
  str = str.replace(/#/g, '');
  str = str.replace(/`/g, '');

  // Remove emojis
  str = str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{E000}-\u{F8FF}\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F093}\u{1F004}\u{1F170}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F1F2}-\u{1F1F3}\u{1F200}-\u{1F251}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F773}\u{1F780}-\u{1F7D4}\u{1F7E0}-\u{1F7EB}\u{1F800}-\u{1F80B}\u{1F810}-\u{1F847}\u{1F850}-\u{1F859}\u{1F860}-\u{1F887}\u{1F890}-\u{1F8AD}\u{1F8B0}-\u{1F8B1}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA53}\u{1FA60}-\u{1FA6D}\u{1FA70}-\u{1FA74}\u{1FA78}-\u{1FA7A}\u{1FA80}-\u{1FA86}\u{1FA90}-\u{1FAA8}\u{1FAB0}-\u{1FAB6}\u{1FAC0}-\u{1FAC2}\u{1FAD0}-\u{1FAD6}\u{2000}-\u{3300}]/gu, '');

  // Remove any remaining non-standard control characters or garbled symbols, but keep degree sign (°), standard punctuation, and alphanumeric
  let cleaned = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const char = str.charAt(i);
    // Keep ASCII printable chars, tab, newline, carriage return, and degree sign (°: code 176)
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || code === 176) {
      cleaned += char;
    }
  }

  // Remove multiple spacing/tabs but keep newlines
  return cleaned.replace(/[ \t]+/g, ' ').trim();
}

module.exports = { cleanText };
