/**
 * Detects the language of a text string.
 * Returns 'bn' (Bangla), 'en' (English), or 'mixed'.
 */
export const detectLanguage = (text = '') => {
  const hasBangla  = /[\u0980-\u09FF]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  if (hasBangla && hasEnglish) return 'mixed';
  if (hasBangla) return 'bn';
  return 'en';
};