// src/utils/helpers.js
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns';

export const formatDate = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'MMM dd, yyyy h:mm a');
};

export const getTimeAgo = (date) => {
  if (!date) return '-';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const getDaysUntil = (date) => {
  if (!date) return null;
  const targetDate = new Date(date);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const isUpcoming = (date, withinDays = 7) => {
  if (!date) return false;
  const targetDate = new Date(date);
  const today = new Date();
  const futureDate = addDays(today, withinDays);
  return isAfter(targetDate, today) && isBefore(targetDate, futureDate);
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'],
  } = options;

  if (file.size > maxSize) {
    return { valid: false, error: `File size must be less than ${maxSize / 1024 / 1024}MB` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type must be ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
};

export const validateAudioFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm'],
  } = options;

  if (file.size > maxSize) {
    return { valid: false, error: `Audio file size must be less than ${maxSize / 1024 / 1024}MB` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Audio file must be MP3, WAV, or WebM format' };
  }

  return { valid: true };
};

// Occasion types categorized by type
export const occasionTypes = [
  // Personal Occasions (requires date)
  { value: 'birthday', label: 'Birthday', icon: '🎂', category: 'personal', requiresDate: true },
  { value: 'anniversary', label: 'Anniversary', icon: '💑', category: 'personal', requiresDate: true },
  { value: 'graduation', label: 'Graduation', icon: '🎓', category: 'personal', requiresDate: true },
  { value: 'other', label: 'Other Occasion', icon: '🎉', category: 'personal', requiresDate: true },

  // Christian Faith-Based (fixed dates)
  { value: 'christmas', label: 'Christmas', icon: '🎄', category: 'christian', fixedDate: '12-25' },
  { value: 'easter', label: 'Easter', icon: '🐰', category: 'christian', requiresDate: true }, // Easter date varies
  { value: 'good_friday', label: 'Good Friday', icon: '✝️', category: 'christian', requiresDate: true },
  { value: 'ash_wednesday', label: 'Ash Wednesday', icon: '🕊️', category: 'christian', requiresDate: true },

  // Jewish Faith-Based (dates vary by Hebrew calendar)
  { value: 'rosh_hashanah', label: 'Rosh Hashanah', icon: '🍎', category: 'jewish', requiresDate: true },
  { value: 'yom_kippur', label: 'Yom Kippur', icon: '🕯️', category: 'jewish', requiresDate: true },
  { value: 'hanukkah', label: 'Hanukkah', icon: '🕎', category: 'jewish', requiresDate: true },
  { value: 'passover', label: 'Passover', icon: '🍷', category: 'jewish', requiresDate: true },
  { value: 'purim', label: 'Purim', icon: '🎭', category: 'jewish', requiresDate: true },

  // Muslim Faith-Based (dates vary by Islamic calendar)
  { value: 'eid_al_fitr', label: 'Eid al-Fitr', icon: '🌙', category: 'muslim', requiresDate: true },
  { value: 'eid_al_adha', label: 'Eid al-Adha', icon: '🕌', category: 'muslim', requiresDate: true },
  { value: 'ramadan', label: 'Ramadan', icon: '🌟', category: 'muslim', requiresDate: true },

  // Secular Holidays (fixed dates)
  { value: 'new_year', label: 'New Year', icon: '🎆', category: 'secular', fixedDate: '01-01' },
  { value: 'valentines', label: "Valentine's Day", icon: '💝', category: 'secular', fixedDate: '02-14' },
  { value: 'mothers_day', label: "Mother's Day", icon: '💐', category: 'secular', requiresDate: true }, // 2nd Sunday in May
  { value: 'fathers_day', label: "Father's Day", icon: '👔', category: 'secular', requiresDate: true }, // 3rd Sunday in June
  { value: 'thanksgiving', label: "Thanksgiving", icon: '🦃', category: 'secular', requiresDate: true }, // 4th Thursday in November
];

export const getOccasionIcon = (occasionType) => {
  const occasion = occasionTypes.find(o => o.value === occasionType);
  return occasion ? occasion.icon : '🎉';
};

export const getOccasionLabel = (occasionType) => {
  const occasion = occasionTypes.find(o => o.value === occasionType);
  return occasion ? occasion.label : occasionType;
};

export const getOccasionsByCategory = () => {
  return {
    personal: occasionTypes.filter(o => o.category === 'personal'),
    christian: occasionTypes.filter(o => o.category === 'christian'),
    jewish: occasionTypes.filter(o => o.category === 'jewish'),
    muslim: occasionTypes.filter(o => o.category === 'muslim'),
    secular: occasionTypes.filter(o => o.category === 'secular'),
  };
};

export const truncate = (str, length = 50) => {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
};

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        const data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });

        resolve({ headers, data });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Relationship types with closeness
export const relationshipTypes = [
  { value: 'spouse', label: 'Spouse/Partner', closeness: 'intimate' },
  { value: 'parent', label: 'Parent', closeness: 'close_family' },
  { value: 'child', label: 'Child', closeness: 'close_family' },
  { value: 'sibling', label: 'Sibling', closeness: 'close_family' },
  { value: 'grandparent', label: 'Grandparent', closeness: 'close_family' },
  { value: 'grandchild', label: 'Grandchild', closeness: 'close_family' },
  { value: 'aunt_uncle', label: 'Aunt/Uncle', closeness: 'extended_family' },
  { value: 'cousin', label: 'Cousin', closeness: 'extended_family' },
  { value: 'close_friend', label: 'Close Friend', closeness: 'close_friend' },
  { value: 'friend', label: 'Friend', closeness: 'friend' },
  { value: 'colleague', label: 'Colleague', closeness: 'professional' },
  { value: 'boss', label: 'Boss/Manager', closeness: 'professional' },
  { value: 'client', label: 'Client/Customer', closeness: 'professional' },
  { value: 'acquaintance', label: 'Acquaintance', closeness: 'casual' },
  { value: 'other', label: 'Other', closeness: 'casual' },
];

export const closenessLevels = [
  { value: 'intimate', label: 'Intimate (Spouse/Partner)' },
  { value: 'close_family', label: 'Close Family' },
  { value: 'extended_family', label: 'Extended Family' },
  { value: 'close_friend', label: 'Close Friend' },
  { value: 'friend', label: 'Friend' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual Acquaintance' },
];
