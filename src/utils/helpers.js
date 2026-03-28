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

// Simplified occasion types - only widely celebrated holidays
export const occasionTypes = [
  // Personal Occasions (requires date)
  { value: 'birthday', label: 'Birthday', icon: '🎂', category: 'personal', requiresDate: true },
  { value: 'anniversary', label: 'Anniversary', icon: '💑', category: 'personal', requiresDate: true },
  { value: 'graduation', label: 'Graduation', icon: '🎓', category: 'personal', requiresDate: true },
  { value: 'getwell', label: 'Get Well', icon: '🩹', category: 'personal', requiresDate: false },

  // Secular Holidays (widely celebrated)
  { value: 'new_year', label: "New Year's Day", icon: '🎆', category: 'secular', fixedDate: '01-01' },
  { value: 'valentines', label: "Valentine's Day", icon: '💝', category: 'secular', fixedDate: '02-14' },
  { value: 'mothers_day', label: "Mother's Day", icon: '💐', category: 'secular', requiresDate: true },
  { value: 'fathers_day', label: "Father's Day", icon: '👔', category: 'secular', requiresDate: true },
  { value: 'thanksgiving', label: 'Thanksgiving', icon: '🦃', category: 'secular', requiresDate: true },

  // Christian - Widely Celebrated
  { value: 'christmas', label: 'Christmas', icon: '🎄', category: 'christian', fixedDate: '12-25' },
  { value: 'easter', label: 'Easter', icon: '🐰', category: 'christian', requiresDate: true },

  // Jewish - Widely Celebrated
  { value: 'rosh_hashanah', label: 'Rosh Hashanah', icon: '🍎', category: 'jewish', requiresDate: true },
  { value: 'hanukkah', label: 'Hanukkah', icon: '🕎', category: 'jewish', requiresDate: true },
  { value: 'passover', label: 'Passover', icon: '🍷', category: 'jewish', requiresDate: true },

  // Muslim - Widely Celebrated
  { value: 'eid_al_fitr', label: 'Eid al-Fitr', icon: '🌙', category: 'muslim', requiresDate: true },
  { value: 'eid_al_adha', label: 'Eid al-Adha', icon: '🕌', category: 'muslim', requiresDate: true },
  { value: 'ramadan', label: 'Ramadan', icon: '🌟', category: 'muslim', requiresDate: true },
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

// Calculate dates for occasions that vary each year
export const calculateVaryingOccasionDate = (occasionType, year = new Date().getFullYear()) => {
  switch (occasionType) {
    case 'mothers_day':
      // 2nd Sunday in May
      return getNthWeekdayOfMonth(year, 4, 0, 2); // Month 4 = May (0-indexed), 0 = Sunday, 2nd occurrence

    case 'fathers_day':
      // 3rd Sunday in June
      return getNthWeekdayOfMonth(year, 5, 0, 3); // Month 5 = June, 0 = Sunday, 3rd occurrence

    case 'thanksgiving':
      // 4th Thursday in November
      return getNthWeekdayOfMonth(year, 10, 4, 4); // Month 10 = November, 4 = Thursday, 4th occurrence

    case 'easter':
      // Easter calculation (Computus algorithm - simplified)
      return calculateEaster(year);

    default:
      return null;
  }
};

// Helper: Get the Nth occurrence of a weekday in a month
const getNthWeekdayOfMonth = (year, month, weekday, occurrence) => {
  let count = 0;
  let date = new Date(year, month, 1);

  while (date.getMonth() === month) {
    if (date.getDay() === weekday) {
      count++;
      if (count === occurrence) {
        return formatDateForInput(date);
      }
    }
    date.setDate(date.getDate() + 1);
  }

  return null;
};

// Helper: Calculate Easter Sunday (using Meeus/Jones/Butcher algorithm)
const calculateEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return formatDateForInput(new Date(year, month, day));
};

// Helper: Format date as YYYY-MM-DD for input fields
const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

// New hierarchical relationship system
export const relationshipCategories = {
  family: {
    label: 'Family',
    icon: '👨‍👩‍👧‍👦',
    members: [
      { value: 'mom', label: 'Mom', icon: '👩' },
      { value: 'dad', label: 'Dad', icon: '👨' },
      { value: 'brother', label: 'Brother', icon: '👦' },
      { value: 'sister', label: 'Sister', icon: '👧' },
      { value: 'grandmother', label: 'Grandmother', icon: '👵' },
      { value: 'grandfather', label: 'Grandfather', icon: '👴' },
      { value: 'aunt', label: 'Aunt', icon: '👩' },
      { value: 'uncle', label: 'Uncle', icon: '👨' },
      { value: 'cousin', label: 'Cousin', icon: '👤' },
      { value: 'nephew', label: 'Nephew', icon: '👦' },
      { value: 'niece', label: 'Niece', icon: '👧' },
      { value: 'godson', label: 'Godson', icon: '👦' },
      { value: 'goddaughter', label: 'Goddaughter', icon: '👧' },
      { value: 'godmother', label: 'Godmother', icon: '👩' },
      { value: 'godfather', label: 'Godfather', icon: '👨' },
    ],
    closenessOption: { value: 'super_close_loved_one', label: 'Super Close Loved One' }
  },
  friends: {
    label: 'Friends',
    icon: '👥',
    levels: [
      { value: 'casual_acquaintance', label: 'Casual Acquaintance' },
      { value: 'fav', label: 'Fav' },
      { value: 'bestie', label: 'Bestie' },
      { value: 'like_family', label: 'Like Family to Me' },
    ]
  },
  professional: {
    label: 'Professional',
    icon: '💼',
    roles: [
      { value: 'top_client', label: 'Top Client' },
      { value: 'coworker', label: 'Coworker' },
      { value: 'boss_management', label: 'Boss/Management' },
    ],
    tones: [
      { value: 'keep_professional', label: 'Keep it Professional' },
      { value: 'professional_friendly', label: 'Professional but Friendly' },
      { value: 'good_like_that', label: "We're Good Like That!" },
    ]
  }
};

// Legacy support - flatten for backward compatibility
export const relationshipTypes = [
  ...relationshipCategories.family.members,
  ...relationshipCategories.friends.levels,
  ...relationshipCategories.professional.roles,
];

export const closenessLevels = [
  { value: 'inner_circle', label: 'Inner Circle' },
  { value: 'greetme_worthy', label: 'Greet-Me Worthy' },
  { value: 'obligatory', label: 'You Gotta Do What Ya Gotta Do' },
];
