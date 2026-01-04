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

export const occasionTypes = [
  { value: 'birthday', label: 'Birthday', icon: '🎂' },
  { value: 'anniversary', label: 'Anniversary', icon: '💑' },
  { value: 'christmas', label: 'Christmas', icon: '🎄' },
  { value: 'new_year', label: 'New Year', icon: '🎆' },
  { value: 'easter', label: 'Easter', icon: '🐰' },
  { value: 'mothers_day', label: "Mother's Day", icon: '💐' },
  { value: 'fathers_day', label: "Father's Day", icon: '👔' },
  { value: 'valentines', label: "Valentine's Day", icon: '💝' },
  { value: 'graduation', label: 'Graduation', icon: '🎓' },
  { value: 'other', label: 'Other', icon: '🎉' },
];

export const getOccasionIcon = (occasionType) => {
  const occasion = occasionTypes.find(o => o.value === occasionType);
  return occasion ? occasion.icon : '🎉';
};

export const getOccasionLabel = (occasionType) => {
  const occasion = occasionTypes.find(o => o.value === occasionType);
  return occasion ? occasion.label : occasionType;
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
