const DICTIONARY = {
  'mon kharap':   'মনখারাপ',
  'moner kharap': 'মনেরখারাপ',
  'valo':         'ভালো',
  'bhalo':        'ভালো',
  'kharap':       'খারাপ',
  'khub':         'খুব',
  'ghum':         'ঘুম',
  'kanna':        'কান্না',
  'ekla':         'একা',
  'thakbo':       'থাকবো',
  'jabo':         'যাবো',
  'amar':         'আমার',
  'ami':          'আমি',
  'ajke':         'আজকে',
  'kal':          'কাল',
  'raat':         'রাত',
  'din':          'দিন',
  'jibon':        'জীবন',
  'beche':        'বেঁচে',
};

export const normalizeText = (text = '') => {
  let normalized = text.toLowerCase();

  // Sort longest phrases first — prevents "kharap" matching inside "mon kharap"
  const entries = Object.entries(DICTIONARY).sort((a, b) => b[0].length - a[0].length);

  for (const [key, value] of entries) {
    normalized = normalized.replace(
      new RegExp(`\\b${key}\\b`, 'g'),
      value
    );
  }

  return normalized;
};