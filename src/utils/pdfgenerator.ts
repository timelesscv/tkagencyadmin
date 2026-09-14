import { jsPDF } from 'jspdf';
import {
  Contract,
  Office,
  OfficeRefCounter,
  BaseFormData,
  KuwaitFormData,
  SaudiFormData,
  JordanFormData,
  AllFormData,
} from '../types';
import { defaultOfficeCounters } from '../constants';
import {
  getInMemoryOfficeCounters,
  setInMemoryOfficeCounters,
  incrementOfficeCounterOnSupabase
} from '../services/dataService';

// ==========================================
// TYPES & COORDINATES
// ==========================================

export interface Coord {
  x: number;
  y: number;
  size?: number; // Font size override
  color?: [number, number, number]; // RGB
  font?: string; // 'helvetica' | 'times' | 'courier'
  _originalX?: number;
  _originalY?: number;
  _originalSize?: number;
  _originalFont?: string;
}

export interface PhotoCoord {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldLayout {
  [key: string]: Coord | PhotoCoord | undefined;
  // Header
  appliedFor?: Coord;
  salary?: Coord;
  contractPeriod?: Coord;
  refNo?: Coord;
  agentName?: Coord;
  printDate?: Coord; // For Fahad
  
  // Personal
  fullName?: Coord;
  religion?: Coord;
  dob?: Coord;
  age?: Coord;
  pob?: Coord;
  maritalStatus?: Coord;
  children?: Coord;
  weight?: Coord;
  height?: Coord;
  education?: Coord;
  nationality?: Coord;
  
  // Passport
  passportNumber?: Coord;
  issueDate?: Coord;
  placeOfIssue?: Coord;
  expiryDate?: Coord;
  
  // Photos (Page 1 & Page 2)
  photoFace?: PhotoCoord;     // Page 1 Top
  photoFull?: PhotoCoord;     // Page 1 Bottom/Side
  photoPassport?: PhotoCoord; // Page 2 Center
  
  // Employment 1
  expCountry?: Coord;
  expPeriod?: Coord;
  expPosition?: Coord;
  
  // Employment 2
  expCountry2?: Coord;
  expPeriod2?: Coord;
  expPosition2?: Coord;

  // Grids
  skillsStart?: Coord; // Starting point for skills
  languagesStart?: Coord; // Starting point for languages
  
  // Contact
  contactName?: Coord;
  contactPhone?: Coord;
  contactRelationship?: Coord; // For Saudi
  contactAddress?: Coord;      // For Saudi
}

// ==========================================
// OFFICE LIST & HELPERS
// ==========================================

export const ALL_SIX_OFFICES: Office[] = [
  { id: '3', name: 'Injaz', country: 'Jordan', color: 'border-red-500' },
  { id: '2', name: 'Options', country: 'Jordan', color: 'border-red-500' },
  { id: '1', name: 'Ewan', country: 'Jordan', color: 'border-red-500' },
  { id: '6', name: 'Aldhahran', country: 'Saudi', color: 'border-green-500' },
  { id: '5', name: 'Fahad', country: 'Kuwait', color: 'border-blue-500' },
  { id: '4', name: 'Alnoor', country: 'Kuwait', color: 'border-blue-500' },
];

export const getNormalizedOfficeKey = (officeName: string): string => {
  const norm = (officeName || '').trim().toLowerCase();
  if (norm.includes('option')) return 'options';
  if (norm.includes('injaz')) return 'injaz';
  if (norm.includes('ewan')) return 'ewan';
  if (norm.includes('dhahran')) return 'aldhahran';
  if (norm.includes('fahad')) return 'fahad';
  if (norm.includes('noor')) return 'alnoor';
  return norm;
};

export const getCountryForOffice = (officeName: string): 'jordan' | 'kuwait' | 'saudi' => {
  const key = getNormalizedOfficeKey(officeName);
  if (key === 'alnoor' || key === 'fahad') return 'kuwait';
  if (key === 'aldhahran') return 'saudi';
  return 'jordan';
};

export const getTemplateBases = (country: string, officeName: string): string[] => {
  const normalizedOffice = getNormalizedOfficeKey(officeName);
  const bases: string[] = [`${country}_${normalizedOffice}`];
  if (normalizedOffice === 'options') {
    bases.push(`${country}_option`);
  } else if (normalizedOffice === 'option') {
    bases.push(`${country}_options`);
  }
  return Array.from(new Set(bases));
};

export const getOfficePdfSlug = (officeName: string): string => {
  const key = getNormalizedOfficeKey(officeName);
  if (key === 'options' || key === 'option') return 'OPTIONS';
  if (key === 'injaz') return 'INJAZ';
  if (key === 'ewan') return 'EWAN';
  if (key === 'aldhahran') return 'ALDHAHRAN';
  if (key === 'fahad') return 'FAHAD';
  if (key === 'alnoor') return 'ALNOOR';
  return officeName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'OFFICE';
};

export const getOfficeRefNumberFromSettings = (
  officeName: string,
  contract?: Contract,
  counters?: OfficeRefCounter[]
): string => {
  let list = counters;
  if (!list || list.length === 0) {
    list = getInMemoryOfficeCounters() || defaultOfficeCounters;
  }

  const slug = getOfficePdfSlug(officeName);
  const matched = list?.find(
    o => o.name.toLowerCase() === officeName.toLowerCase() || getOfficePdfSlug(o.name) === slug
  );

  if (contract?.office && contract.office.toLowerCase() === officeName.toLowerCase() && contract.refNumber) {
    const raw = contract.refNumber.trim();
    const clean = raw.startsWith('TK-') ? raw.replace(/^TK-/i, '') : raw;
    if (clean) return clean;
  }

  if (matched && matched.nextNumber !== undefined && matched.nextNumber !== null) {
    return String(matched.nextNumber);
  }

  if (contract?.refNumber) {
    const raw = contract.refNumber.trim();
    const clean = raw.startsWith('TK-') ? raw.replace(/^TK-/i, '') : raw;
    if (clean) return clean;
  }

  return '1';
};

export const incrementOfficeRefCounter = (officeName: string): number => {
  try {
    let list: OfficeRefCounter[] = getInMemoryOfficeCounters() || [...defaultOfficeCounters];
    const slug = getOfficePdfSlug(officeName);
    let updatedNext = 2;

    list = list.map(item => {
      if (
        item.name.toLowerCase() === officeName.toLowerCase() ||
        getOfficePdfSlug(item.name) === slug
      ) {
        const current = typeof item.nextNumber === 'number' ? item.nextNumber : 1;
        updatedNext = current + 1;
        return {
          ...item,
          nextNumber: updatedNext,
        };
      }
      return item;
    });

    setInMemoryOfficeCounters(list);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: list }));
    }

    // Atomically increment on Supabase cloud
    incrementOfficeCounterOnSupabase(officeName)
      .catch((err) => console.warn('Supabase counter atomic sync notice:', err));

    return updatedNext;
  } catch (err) {
    console.error('Failed to increment office counter', err);
  }
  return 1;
};

export const getOfficePdfFileName = (
  contract: Contract,
  officeName: string,
  counters?: OfficeRefCounter[]
): string => {
  const refNum = getOfficeRefNumberFromSettings(officeName, contract, counters);
  const fullName = (contract.name || 'Candidate')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
  const officeSlug = getOfficePdfSlug(officeName);
  return `TK-${refNum}_${fullName}_${officeSlug}.pdf`;
};

export const getOfficesForContract = (contract: Contract): Office[] => {
  const pref = (contract.preferredCountry || 'all').toLowerCase();
  if (pref === 'jordan') {
    return ALL_SIX_OFFICES.filter(o => o.country.toLowerCase() === 'jordan');
  }
  if (pref === 'kuwait') {
    return ALL_SIX_OFFICES.filter(o => o.country.toLowerCase() === 'kuwait');
  }
  if (pref === 'saudi') {
    return ALL_SIX_OFFICES.filter(o => o.country.toLowerCase() === 'saudi');
  }
  return ALL_SIX_OFFICES;
};

// ==========================================
// DATE & TEXT FORMATTERS
// ==========================================

const formatCVDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day} ${months[monthIndex]} ${year}`;
};

const formatDateNumeric = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to adjust fullName layout based on character count
const adjustFullNameLayout = (
  data: BaseFormData,
  layout: FieldLayout,
  country: string,
  office: string
): void => {
  if (!layout.fullName || !data.fullName) return;

  const charCount = data.fullName.length;
  const officeUpper = office.toUpperCase();

  // Cache ORIGINAL values once (per runtime)
  const originalX = layout.fullName._originalX ?? layout.fullName.x;
  const originalY = layout.fullName._originalY ?? layout.fullName.y;
  const originalSize = layout.fullName._originalSize ?? layout.fullName.size;
  const originalFont = layout.fullName._originalFont ?? layout.fullName.font;
  const originalColor = layout.fullName.color ?? [0, 0, 0];

  // Store them (non-enumerable is optional)
  layout.fullName._originalX = originalX;
  layout.fullName._originalY = originalY;
  layout.fullName._originalSize = originalSize;
  layout.fullName._originalFont = originalFont;

  // RESET every time
  const fullNameLayout = {
    ...layout.fullName,
    x: originalX,
    y: originalY,
    size: originalSize,
    font: originalFont,
    color: originalColor,
  };

  // Jordan & Kuwait offices
  if (
    (country === 'jordan' && ['EWAN', 'OPTION', 'OPTIONS', 'INJAZ'].includes(officeUpper)) ||
    (country === 'kuwait' && officeUpper === 'ALNOOR')
  ) {
    if (charCount >= 28) {
      fullNameLayout.size = (originalSize ?? 14) - 3;
      fullNameLayout.x = originalX - 5;
    } else if (charCount >= 24) {
      fullNameLayout.size = (originalSize ?? 14) - 2;
      fullNameLayout.x = originalX - 5;
    }
  }

  // Aldhahran (absolute override)
  if (country === 'saudi' && officeUpper === 'ALDHAHRAN' && charCount >= 19) {
    fullNameLayout.size = 9;
    fullNameLayout.x = 35;
    fullNameLayout.y = 55;
    fullNameLayout.font = 'helvetica';
  }

  layout.fullName = fullNameLayout;
};

// ==========================================
// EXACT LAYOUT COORDINATES
// ==========================================

const RED_HEX: [number, number, number] = [149, 23, 27];
const GREEN_HEX: [number, number, number] = [36, 158, 84];
const PURPLE_HEX: [number, number, number] = [95, 73, 122];

// --- KUWAIT: ALNOOR OFFICE ---
const LAYOUT_KUWAIT_ALNOOR: FieldLayout = {
  // Header
  salary: { x: 82, y: 61.5, color: GREEN_HEX, font: 'helvetica', size: 12 },
  refNo: { x: 93.5, y: 74.75, color: GREEN_HEX, font: 'helvetica', size: 11.5 },
  
  // Personal Details
  fullName: { x: 64, y: 91.5, color: RED_HEX, font: 'helvetica', size: 18 },
  religion: { x: 53, y: 117, color: RED_HEX, font: 'helvetica', size: 12 },
  dob: { x: 53, y: 126, color: RED_HEX, font: 'helvetica', size: 12 },
  age: { x: 53, y: 138, color: RED_HEX, font: 'helvetica', size: 12 },
  pob: { x: 49, y: 147, color: RED_HEX, font: 'helvetica', size: 10 },
  children: { x: 53, y: 156, color: RED_HEX, font: 'helvetica', size: 12 },
  weight: { x: 53, y: 163, color: RED_HEX, font: 'helvetica', size: 12 },
  height: { x: 53, y: 170, color: RED_HEX, font: 'helvetica', size: 12 },
  maritalStatus: { x: 53, y: 188, color: RED_HEX, font: 'helvetica', size: 14 },
  
  // Passport Details
  passportNumber: { x: 139.5, y: 103, color: RED_HEX, font: 'helvetica', size: 11 },
  issueDate: { x: 140, y: 110, color: RED_HEX, font: 'helvetica', size: 11 },
  expiryDate: { x: 140, y: 124, color: RED_HEX, font: 'helvetica', size: 11 },
  
  // Photos (Al Noor Specific)
  photoFace: { x: 159, y: 46, w: 34, h: 35 },
  photoFull: { x: 140, y: 135, w: 45, h: 140 }, // Page 1 Bottom Right
  photoPassport: { x: 12, y: 60, w: 183, h: 180 }, // Page 2 Center

  // Languages
  languagesStart: { x: 40, y: 168, color: RED_HEX, font: 'helvetica', size: 10.5 },
  
  // Employment
  expPeriod: { x: 20, y: 231, color: GREEN_HEX, font: 'helvetica', size: 12 },
  expPosition: { x: 31.5, y: 231, color: GREEN_HEX, font: 'helvetica', size: 11 },
  expCountry: { x: 56.5, y: 231, color: GREEN_HEX, font: 'helvetica', size: 13.25 },
  
  // Second Employment
  expPeriod2: { x: 20, y: 240, color: GREEN_HEX, font: 'helvetica', size: 12 },
  expPosition2: { x: 31.5, y: 240, color: GREEN_HEX, font: 'helvetica', size: 11 },
  expCountry2: { x: 56.5, y: 240, color: GREEN_HEX, font: 'helvetica', size: 13.25 },

  // Skills
  skillsStart: { x: 18, y: 263, color: RED_HEX, font: 'helvetica', size: 16 },

  // Contact Info - HIDDEN FOR AL NOOR
  contactName: { x: 0, y: 0 },
  contactPhone: { x: 0, y: 0 },
};

// --- KUWAIT: FAHAD OFFICE ---
const LAYOUT_KUWAIT_FAHAD: FieldLayout = {
  // Header
  refNo: { x: 43.75, y: 78.25, color: PURPLE_HEX, font: 'helvetica', size: 16 },
  salary: { x: 56, y: 94, color: PURPLE_HEX, font: 'helvetica', size: 16 },
  printDate: { x: 95.5, y: 66, color: [0,0,0], font: 'helvetica', size: 20 },
  
  // Personal Details
  fullName: { x: 44, y: 110, color: PURPLE_HEX, font: 'helvetica', size: 14 }, 
  religion: { x: 44, y: 130, color: PURPLE_HEX, font: 'helvetica', size: 11 }, 
  dob: { x: 44, y: 135, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  age: { x: 44, y: 141, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  pob: { x: 44, y: 147, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  children: { x: 44, y: 163, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  weight: { x: 44, y: 170, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  height: { x: 44, y: 177, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  maritalStatus: { x: 44, y: 156, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  
  // Passport Details
  passportNumber: { x: 150, y: 125.5, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  issueDate: { x: 150, y: 130.25, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  expiryDate: { x: 150, y: 140.5, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  
  // Photos
  photoFace: { x: 153, y: 64, w: 40, h: 41 },
  photoFull: { x: 145, y: 143, w: 32, h: 100 }, 
  photoPassport: { x: 12, y: 40, w: 183, h: 220 }, 

  // Languages
  languagesStart: { x: 40, y: 168, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  
  // Employment
  expPeriod: { x: 31.5, y: 231, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  expCountry: { x: 31.5, y: 226, color: PURPLE_HEX, font: 'helvetica', size: 11 },

  // Second Employment
  expPeriod2: { x: 59, y: 231, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  expCountry2: { x: 59, y: 226, color: PURPLE_HEX, font: 'helvetica', size: 11 },
  
  // Skills
  skillsStart: { x: 18, y: 263, color: PURPLE_HEX, font: 'helvetica', size: 11 },

  // Contact Info - HIDDEN FOR FAHAD
  contactName: { x: 0, y: 0 },
  contactPhone: { x: 0, y: 0 },
};

// --- SAUDI: ALDHAHRAN OFFICE ---
const LAYOUT_SAUDI_ALDHAHRAN: FieldLayout = {
  fullName: { x: 43, y: 55, font: 'helvetica' },
  religion: { x: 50, y: 72, font: 'helvetica' },
  dob: { x: 50, y: 79, font: 'helvetica' },
  pob: { x: 50, y: 91, font: 'helvetica' },
  maritalStatus: { x: 50, y: 104, font: 'helvetica' },
  age: { x: 50, y: 85, font: 'helvetica' },
  children: { x: 50, y: 110, font: 'helvetica' },
  height: { x: 163, y: 224, font: 'helvetica' },
  weight: { x: 163, y: 218, font: 'helvetica' },
  passportNumber: { x: 163, y: 72, font: 'helvetica' },
  
  expCountry: { x: 50, y: 138, font: 'helvetica' },
  expPeriod: { x: 50, y: 144, font: 'helvetica' },

  expCountry2: { x: 85, y: 138, font: 'helvetica' },
  expPeriod2: { x: 85, y: 144, font: 'helvetica' },

  salary: { x: 163, y: 55, font: 'helvetica' },
  
  contactName: { x: 40, y: 184, font: 'helvetica' },
  contactRelationship: { x: 40, y: 191, font: 'helvetica' },
  contactPhone: { x: 40, y: 196, font: 'helvetica' },
  contactAddress: { x: 40, y: 202, font: 'helvetica' },

  photoFull: { x: 145, y: 75.2, w: 45, h: 136 },
  photoPassport: { x: 12, y: 40, w: 183, h: 220 },

  skillsStart: { x: 1200, y: 224 },
  languagesStart: { x: 10, y: 165 }
};

// --- JORDAN: EWAN OFFICE ---
const LAYOUT_JORDAN_EWAN: FieldLayout = {
  refNo: { x: 141.5, y: 76.25, font: 'helvetica' },
  fullName: { x: 65, y: 95, font: 'helvetica', size: 18 },
  religion: { x: 53, y: 130, font: 'helvetica' },
  dob: { x: 50, y: 136, font: 'helvetica' },
  pob: { x: 50, y: 154, font: 'helvetica' },
  maritalStatus: { x: 50, y: 193, font: 'helvetica' },
  age: { x: 55, y: 144, font: 'helvetica', size: 12 },
  children: { x: 50, y: 162, font: 'helvetica' },
  height: { x: 50, y: 177, font: 'helvetica' }, 
  weight: { x: 50, y: 170, font: 'helvetica' }, 
  placeOfIssue: { x: 0, y: 0 }, 
  passportNumber: { x: 142.5, y: 104.5, font: 'helvetica' },
  issueDate: { x: 142.5, y: 112, font: 'helvetica' },
  expiryDate: { x: 142.5, y: 127, font: 'helvetica' },
  expCountry: { x: 55, y: 238, font: 'helvetica' },
  expPeriod: { x: 15, y: 238, font: 'helvetica' },
  expPosition: { x: 27, y: 238, font: 'helvetica' },
  
  expCountry2: { x: 55, y: 245, font: 'helvetica' },
  expPeriod2: { x: 15, y: 245, font: 'helvetica' },
  expPosition2: { x: 27, y: 245, font: 'helvetica' },

  photoFace: { x: 32.5, y: 46.5, w: 27, h: 35 },
  photoFull: { x: 132, y: 136, w: 42, h: 132 },
  photoPassport: { x: 12, y: 40, w: 183, h: 220 },

  skillsStart: { x: 1320, y: 175 },
  languagesStart: { x: 20, y: 175 },

  contactName: { x: 0, y: 0 },
  contactPhone: { x: 0, y: 0 },
  contactRelationship: { x: 0, y: 0 },
  contactAddress: { x: 0, y: 0 }
};

// --- JORDAN: OPTION OFFICE ---
const LAYOUT_JORDAN_OPTION: FieldLayout = {
  refNo: { x: 139, y: 68.5, font: 'helvetica' },
  fullName: { x: 70, y: 89, font: 'helvetica', size: 16.5 },
  religion: { x: 53, y: 125, font: 'helvetica' },
  dob: { x: 50, y: 132, font: 'helvetica' },
  pob: { x: 50, y: 148, font: 'helvetica' },
  maritalStatus: { x: 50, y: 188, font: 'helvetica' },
  age: { x: 55, y: 142, font: 'helvetica', size: 12 },
  children: { x: 55, y: 155, font: 'helvetica' },
  height: { x: 50, y: 172, font: 'helvetica' },
  weight: { x: 50, y: 164, font: 'helvetica' },
  
  placeOfIssue: { x: 0, y: 0 }, 
  
  passportNumber: { x: 142.5, y: 104.5, font: 'helvetica' },
  issueDate: { x: 142.5, y: 112, font: 'helvetica' },
  expiryDate: { x: 142.5, y: 127, font: 'helvetica' },
  
  expCountry: { x: 55, y: 236, font: 'helvetica' },
  expPeriod: { x: 16, y: 236, font: 'helvetica' },
  expPosition: { x: 29.5, y: 236, font: 'helvetica' },

  photoFace: { x: 28.5, y: 45, w: 29, h: 34.5 },
  photoFull: { x: 132, y: 135, w: 38, h: 130 },
  photoPassport: { x: 12, y: 40, w: 183, h: 220 },

  skillsStart: { x: 1320, y: 175 }, 
  languagesStart: { x: 20, y: 175 },

  contactName: { x: 0, y: 0 },
  contactPhone: { x: 0, y: 0 },
  contactRelationship: { x: 0, y: 0 },
  contactAddress: { x: 0, y: 0 }
};

// --- JORDAN: INJAZ OFFICE ---
const LAYOUT_JORDAN_INJAZ: FieldLayout = {
  refNo: { x: 141.5, y: 59.5, font: 'helvetica' },
  fullName: { x: 64, y: 76, font: 'helvetica', size: 18 },
  religion: { x: 58, y: 110, font: 'helvetica' },
  dob: { x: 55, y: 116, font: 'helvetica' },
  pob: { x: 52, y: 132, font: 'helvetica' },
  maritalStatus: { x: 58, y: 154, font: 'helvetica' },
  age: { x: 58, y: 124, font: 'helvetica', size: 12 },
  children: { x: 58, y: 140, font: 'helvetica' },
  height: { x: 58, y: 162, font: 'helvetica' },
  weight: { x: 58, y: 148, font: 'helvetica' },
  placeOfIssue: { x: 0, y: 0 }, 
  passportNumber: { x: 146.5, y: 98, font: 'helvetica' },
  issueDate: { x: 146.5, y: 105.25, font: 'helvetica' },
  expiryDate: { x: 146.5, y: 119.5, font: 'helvetica' },
  expCountry: { x: 62, y: 229, font: 'helvetica' },
  expPeriod: { x: 22, y: 229, font: 'helvetica' },
  expPosition: { x: 34, y: 229, font: 'helvetica' },

  expCountry2: { x: 62, y: 236, font: 'helvetica' },
  expPeriod2: { x: 22, y: 236, font: 'helvetica' },
  expPosition2: { x: 34, y: 236, font: 'helvetica' },

  photoFace: { x: 20, y: 33.5, w: 27, h: 34 },
  photoFull: { x: 136, y: 131.5, w: 44, h: 135 },
  photoPassport: { x: 12, y: 40, w: 183, h: 220 },
  skillsStart: { x: 1320, y: 175 },
  languagesStart: { x: 20, y: 175 },

  contactName: { x: 0, y: 0 },
  contactPhone: { x: 0, y: 0 },
  contactRelationship: { x: 0, y: 0 },
  contactAddress: { x: 0, y: 0 }
};

export const getLayout = (country: string, office: string): FieldLayout => {
  const off = office.toUpperCase();
  if (country === 'kuwait') {
    return off.includes('FAHAD') ? LAYOUT_KUWAIT_FAHAD : LAYOUT_KUWAIT_ALNOOR;
  }
  if (country === 'saudi') return LAYOUT_SAUDI_ALDHAHRAN;
  if (country === 'jordan') {
    if (off.includes('INJAZ')) return LAYOUT_JORDAN_INJAZ;
    if (off.includes('OPTION')) return LAYOUT_JORDAN_OPTION;
    return LAYOUT_JORDAN_EWAN;
  }
  return LAYOUT_KUWAIT_ALNOOR;
};

// ==========================================
// DRAWING UTILS
// ==========================================

const drawCheckmark = (
  doc: jsPDF,
  x: number,
  y: number,
  size: number = 5,
  color: [number, number, number] = [0, 0, 0]
) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + size / 3, y + size); // Down stroke
  doc.line(x + size / 3, y + size, x + size, y - size / 2); // Up stroke
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
};

export const loadImageSafe = async (src?: string): Promise<HTMLImageElement | null> => {
  if (!src) return null;

  // 1. If it's already a base64 Data URL, load directly
  if (src.startsWith('data:')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // 2. If it's a remote URL (e.g. Cloudflare R2), fetch through same-origin proxy to eliminate CORS
  // and convert to Base64 Data URL so that jsPDF and HTML5 canvas never encounter canvas taint issues
  const candidateUrls: string[] = [];
  if (src.startsWith('http://') || src.startsWith('https://')) {
    candidateUrls.push(`/api/storage/proxy?url=${encodeURIComponent(src)}`);
    candidateUrls.push(src);
  } else {
    candidateUrls.push(src);
  }

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resData, rejData) => {
          const reader = new FileReader();
          reader.onloadend = () => resData(reader.result as string);
          reader.onerror = rejData;
          reader.readAsDataURL(blob);
        });

        const img = new Image();
        const ok = await new Promise<boolean>((resImg) => {
          img.onload = () => resImg(true);
          img.onerror = () => resImg(false);
          img.src = dataUrl;
        });

        if (ok) {
          return img;
        }
      }
    } catch (e) {
      console.warn('Image fetch attempt notice for', url, e);
    }
  }

  // 3. Fallback to standard Image loading
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Could not load image after fallbacks:', src);
      resolve(null);
    };
    img.src = src;
  });
};

// ==========================================
// DATA MAPPER
// ==========================================

export const contractToFormData = (
  contract: Contract,
  officeName: string,
  counters?: OfficeRefCounter[]
): AllFormData => {
  const refNo = getOfficeRefNumberFromSettings(officeName, contract, counters);
  const officeKey = getNormalizedOfficeKey(officeName);

  let salary = '120 KD';
  let monthlySalary = '1000 SAR';
  if (officeKey === 'aldhahran') {
    monthlySalary = '1000 SAR';
  } else if (officeKey === 'fahad') {
    salary = '120';
  } else if (officeKey === 'alnoor') {
    salary = '120 KD';
  }

  const exp1 = contract.employmentRecords?.[0];
  const exp2 = contract.employmentRecords?.[1];

  return {
    refNo,
    fullName: contract.name || '',
    religion: (contract.religion || 'CHRISTIAN').toUpperCase(),
    dob: contract.dateOfBirth || '',
    age: contract.age ? String(contract.age) : '',
    pob: (contract.placeOfBirth || 'ADDIS ABABA').toUpperCase(),
    maritalStatus: (contract.maritalStatus || 'SINGLE').toUpperCase(),
    children:
      contract.numberOfChildren !== undefined && contract.numberOfChildren !== ''
        ? String(contract.numberOfChildren)
        : '0',
    weight: contract.weight
      ? contract.weight.toUpperCase().includes('KG')
        ? contract.weight.toUpperCase()
        : `${contract.weight} KG`
      : '',
    height: contract.height
      ? contract.height.toUpperCase().includes('CM')
        ? contract.height.toUpperCase()
        : `${contract.height} CM`
      : '',
    education: 'ELEMENTARY',
    nationality: 'ETHIOPIAN',
    passportNumber: (contract.passportNumber || '').toUpperCase(),
    issueDate: contract.issueDate || '',
    placeOfIssue: 'ADDIS ABABA',
    expiryDate: contract.expiryDate || '',
    photos: {
      face: contract.facePhoto,
      full: contract.fullBodyPhoto,
      passport: contract.passportPhoto,
    },
    hasExperience: Boolean(
      (contract.employmentRecords && contract.employmentRecords.length > 0) ||
        contract.experienceCountry ||
        contract.hasPreviousExperience
    ),
    expCountry: (exp1?.country || contract.experienceCountry || '').toUpperCase(),
    expPeriod: (exp1?.periodYears || contract.duration || '').toUpperCase(),
    expPosition: (exp1?.position || 'HOUSEMAID').toUpperCase(),
    expCountry2: (exp2?.country || '').toUpperCase(),
    expPeriod2: (exp2?.periodYears || '').toUpperCase(),
    expPosition2: (exp2?.position || (exp2?.country ? 'HOUSEMAID' : '')).toUpperCase(),
    englishLevel: (contract.englishProficiency || 'fair').toUpperCase() as 'POOR' | 'FAIR' | 'FLUENT',
    arabicLevel: (contract.arabicProficiency || 'fair').toUpperCase() as 'POOR' | 'FAIR' | 'FLUENT',
    salary,
    monthlySalary,
    printDate: contract.date || new Date().toISOString().split('T')[0],
    skills: {
      cooking: Boolean(contract.competencies?.cooking),
      cleaning: Boolean(contract.competencies?.cleaning),
      babysitting: Boolean(contract.competencies?.babysitting),
      washing: Boolean(contract.competencies?.washing),
      ironing: Boolean(contract.competencies?.ironing),
      sewing: Boolean(contract.competencies?.sewing),
    },
    contactPerson: contract.emergencyContactName || '',
    contactPhone: contract.emergencyContactPhone || '',
    relationship: (contract.emergencyContactRelationship || 'RELATIVE').toUpperCase(),
    address: (contract.emergencyContactAddress || 'ADDIS ABABA').toUpperCase(),
  };
};

// ==========================================
// CORE RENDER FUNCTION
// ==========================================

export const renderCountryPDFDoc = async (
  data: BaseFormData | KuwaitFormData | SaudiFormData | JordanFormData | AllFormData,
  country: 'kuwait' | 'saudi' | 'jordan',
  office: string
): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const layout = getLayout(country, office);
  adjustFullNameLayout(data, layout, country, office);

  const isFahad = country === 'kuwait' && office.toUpperCase().includes('FAHAD');

  // Helper to draw text
  const draw = (text: string | undefined, coord: Coord | undefined) => {
    if (!text || !coord) return;
    if (coord.x === 0 && coord.y === 0) return; // Explicit hide

    doc.setTextColor(...(coord.color || [0, 0, 0]));
    doc.setFontSize(coord.size || 11);
    doc.setFont((coord.font as any) || 'helvetica', 'bold');
    doc.text(text.toString(), coord.x, coord.y);
  };

  // 1. LOAD TEMPLATE PAGES
  const templateBases = getTemplateBases(country, office);
  const extensions = ['.jpg', '.JPG', '.png', '.jpeg'];

  let bg1: HTMLImageElement | null = null;
  let bg2: HTMLImageElement | null = null;

  for (const base of templateBases) {
    for (const ext of extensions) {
      if (!bg1) {
        try {
          bg1 = await loadImage(`/templates/${base}_1${ext}`);
        } catch {
          // try next
        }
      }
      if (!bg2) {
        try {
          bg2 = await loadImage(`/templates/${base}_2${ext}`);
        } catch {
          // try next
        }
      }
    }
  }

  // ----------------------------------------
  // PAGE 1
  // ----------------------------------------
  if (bg1) {
    doc.addImage(bg1, 'JPEG', 0, 0, 210, 297);
  }

  // Draw Header
  draw(data.refNo, layout.refNo);

  let salaryText = '';
  if ('salary' in data && data.salary) {
    salaryText = data.salary;
    if (isFahad) {
      salaryText = salaryText.replace(/ KD/i, '').trim();
    }
  } else if ('monthlySalary' in data && data.monthlySalary) {
    salaryText = data.monthlySalary;
  }
  draw(salaryText, layout.salary);

  draw('2 YEARS', layout.contractPeriod);
  draw('TK-AGENT', layout.agentName);
  draw('HOUSEMAID', layout.appliedFor);

  if (isFahad && 'printDate' in data && data.printDate) {
    draw(formatDateNumeric(data.printDate), layout.printDate);
  }

  // Draw Personal
  draw(data.fullName, layout.fullName);
  draw(data.religion, layout.religion);
  draw(formatCVDate(data.dob), layout.dob);
  draw(data.age, layout.age);
  draw(data.pob, layout.pob);
  draw(data.maritalStatus, layout.maritalStatus);
  draw(data.children, layout.children);

  if ('weight' in data) draw(data.weight, layout.weight);
  if ('height' in data) draw(data.height, layout.height);
  if ('education' in data) draw(data.education, layout.education);
  draw('ETHIOPIAN', layout.nationality);

  // Passport
  draw(data.passportNumber, layout.passportNumber);
  draw(formatCVDate(data.issueDate), layout.issueDate);
  draw(data.placeOfIssue, layout.placeOfIssue);
  draw(formatCVDate(data.expiryDate), layout.expiryDate);

  // Employment
  if (data.hasExperience) {
    draw(data.expCountry, layout.expCountry);
    draw(data.expPeriod, layout.expPeriod);
    draw(data.expPosition, layout.expPosition);

    if (data.expCountry2) {
      draw(data.expCountry2, layout.expCountry2);
      draw(data.expPeriod2, layout.expPeriod2);
      draw(data.expPosition2, layout.expPosition2);
    }
  }

  // Contact (Saudi only)
  if ('contactPerson' in data && data.contactPerson) {
    const cData = data as AllFormData;
    if (layout.contactName && (layout.contactName.x !== 0 || layout.contactName.y !== 0)) {
      draw(cData.contactPerson, layout.contactName);
      draw(cData.contactPhone, layout.contactPhone);
      if ('relationship' in cData) {
        draw(cData.relationship, layout.contactRelationship);
        draw(cData.address, layout.contactAddress);
      }
    }
  }

  // Photos (Page 1)
  if (data.photos.face && layout.photoFace) {
    const faceImg = await loadImageSafe(data.photos.face);
    if (faceImg) {
      doc.addImage((faceImg as any).src || faceImg, 'JPEG', layout.photoFace.x, layout.photoFace.y, layout.photoFace.w, layout.photoFace.h);
    }
  }
  if (data.photos.full && layout.photoFull) {
    const fullImg = await loadImageSafe(data.photos.full);
    if (fullImg) {
      doc.addImage((fullImg as any).src || fullImg, 'JPEG', layout.photoFull.x, layout.photoFull.y, layout.photoFull.w, layout.photoFull.h);
    }
  }

  // --- SKILLS & LANGUAGES ---
  const RED: [number, number, number] = [149, 23, 27];

  // KUWAIT LOGIC
  if (country === 'kuwait') {
    const kData = data as KuwaitFormData | AllFormData;

    // Fahad: Checkmark for Cooking
    if (isFahad) {
      if (kData.skills?.cooking) drawCheckmark(doc, 106.5, 239, 2.5, [0, 0, 0]);
    } else {
      // Alnoor: YES text
      if (kData.skills?.cooking) {
        doc.setTextColor(...RED);
        doc.setFont('helvetica', 'bold');
        doc.text('YES', 18, 263);
      }
    }

    // Alnoor Languages
    if (!isFahad) {
      doc.setTextColor(...RED);
      doc.setFont('helvetica', 'bold');
      if (kData.englishLevel === 'POOR') doc.text('YES', 53, 210);
      if (kData.englishLevel === 'FAIR') doc.text('YES', 74, 210);
      if (kData.englishLevel === 'FLUENT') doc.text('YES', 95, 210);

      if (kData.arabicLevel === 'POOR') doc.text('YES', 53, 205);
      if (kData.arabicLevel === 'FAIR') doc.text('YES', 74, 205);
      if (kData.arabicLevel === 'FLUENT') doc.text('YES', 95, 205);
    } else {
      // Fahad Languages
      doc.setTextColor(...PURPLE_HEX);
      doc.setFont('helvetica', 'bold');
      if (kData.englishLevel === 'POOR') doc.text('YES', 45, 207.25);
      if (kData.englishLevel === 'FAIR') doc.text('YES', 45, 212);
      if (kData.englishLevel === 'FLUENT') doc.text('YES', 45, 216.75);

      if (kData.arabicLevel === 'POOR') doc.text('YES', 69, 207.25);
      if (kData.arabicLevel === 'FAIR') doc.text('YES', 69, 212);
      if (kData.arabicLevel === 'FLUENT') doc.text('YES', 69, 216.75);
    }
  }

  // SAUDI LOGIC
  if (country === 'saudi') {
    const sData = data as SaudiFormData | AllFormData;
    if (sData.skills?.cooking) {
      drawCheckmark(doc, 70, 166.5, 2.5, [0, 0, 0]);
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    if (sData.englishLevel === 'FLUENT') doc.text('YES', 40, 224);
    if (sData.englishLevel === 'FAIR') doc.text('YES', 68, 224);
    if (sData.englishLevel === 'POOR') doc.text('YES', 96, 224);

    if (sData.arabicLevel === 'FLUENT') doc.text('YES', 40, 230);
    if (sData.arabicLevel === 'FAIR') doc.text('YES', 68, 230);
    if (sData.arabicLevel === 'POOR') doc.text('YES', 96, 230);
  }

  // JORDAN LOGIC
  if (country === 'jordan') {
    const jData = data as JordanFormData | AllFormData;
    const off = office.toLowerCase();

    if (off.includes('injaz')) {
      if (jData.skills?.cooking) drawCheckmark(doc, 65.75, 265.5, 2.5, [0, 0, 0]);

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      if (jData.englishLevel === 'POOR') doc.text('YES', 55, 202);
      if (jData.englishLevel === 'FAIR') doc.text('YES', 75, 202);
      if (jData.englishLevel === 'FLUENT') doc.text('YES', 95, 202);

      if (jData.arabicLevel === 'POOR') doc.text('YES', 55, 197.5);
      if (jData.arabicLevel === 'FAIR') doc.text('YES', 75, 197.5);
      if (jData.arabicLevel === 'FLUENT') doc.text('YES', 95, 197.5);
    } else if (off.includes('option')) {
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      if (jData.englishLevel === 'POOR') doc.text('YES', 35, 212.5);
      if (jData.englishLevel === 'FAIR') doc.text('YES', 50, 212.5);
      if (jData.englishLevel === 'FLUENT') doc.text('YES', 80, 212.5);

      if (jData.arabicLevel === 'POOR') doc.text('YES', 35, 207);
      if (jData.arabicLevel === 'FAIR') doc.text('YES', 50, 207);
      if (jData.arabicLevel === 'FLUENT') doc.text('YES', 80, 207);
    } else {
      // Ewan
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      if (jData.englishLevel === 'POOR') doc.text('YES', 45, 217);
      if (jData.englishLevel === 'FAIR') doc.text('YES', 65, 217);
      if (jData.englishLevel === 'FLUENT') doc.text('YES', 85, 217);

      if (jData.arabicLevel === 'POOR') doc.text('YES', 45, 213);
      if (jData.arabicLevel === 'FAIR') doc.text('YES', 65, 213);
      if (jData.arabicLevel === 'FLUENT') doc.text('YES', 85, 213);
    }
  }

  // ----------------------------------------
  // PAGE 2
  // ----------------------------------------
  doc.addPage();
  if (bg2) {
    doc.addImage(bg2, 'JPEG', 0, 0, 210, 297);
  }

  if (data.photos.passport && layout.photoPassport) {
    const passportImg = await loadImageSafe(data.photos.passport);
    if (passportImg) {
      doc.addImage(
        (passportImg as any).src || passportImg,
        'JPEG',
        layout.photoPassport.x,
        layout.photoPassport.y,
        layout.photoPassport.w,
        layout.photoPassport.h
      );
    }
  }

  return doc;
};

// ==========================================
// EXPORTED GENERATION & DOWNLOAD FUNCTIONS
// ==========================================

export const generateCountryPDF = async (
  data: KuwaitFormData | SaudiFormData | JordanFormData | AllFormData,
  country: 'kuwait' | 'saudi' | 'jordan',
  office: string
): Promise<void> => {
  const doc = await renderCountryPDFDoc(data, country, office);
  const safeName = (data.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
  const safeRef = data.refNo ? data.refNo.replace(/[^a-zA-Z0-9]/g, '-') : 'REF';
  const officeSlug = getOfficePdfSlug(office);
  const fileName = `TK-${safeRef}_${safeName}_${officeSlug}.pdf`;
  doc.save(fileName);
};

export const generateCVPdfBlob = async (
  contract: Contract,
  targetOffice?: Office | string,
  counters?: OfficeRefCounter[]
): Promise<{ blob: Blob; url: string; fileName: string; officeName: string; doc: jsPDF }> => {
  const officeObj =
    typeof targetOffice === 'string'
      ? ALL_SIX_OFFICES.find(o => o.name.toLowerCase() === targetOffice.toLowerCase()) || ALL_SIX_OFFICES[0]
      : targetOffice || ALL_SIX_OFFICES[0];

  const officeName = officeObj.name;
  const country = getCountryForOffice(officeName);
  const formData = contractToFormData(contract, officeName, counters);

  const doc = await renderCountryPDFDoc(formData, country, officeName);
  const fileName = getOfficePdfFileName(contract, officeName, counters);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return { blob, url, fileName, officeName, doc };
};

export const downloadSingleOfficeCVPdf = async (
  contract: Contract,
  targetOffice?: Office | string,
  counters?: OfficeRefCounter[]
): Promise<string> => {
  const { blob, fileName, officeName } = await generateCVPdfBlob(contract, targetOffice, counters);
  const link = document.createElement('a');
  link.style.display = 'none';
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  incrementOfficeRefCounter(officeName);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return fileName;
};

export const downloadCandidateCVsForCountry = async (
  contract: Contract,
  onProgress?: (current: number, total: number, fileName: string) => void,
  counters?: OfficeRefCounter[]
): Promise<string[]> => {
  const officesList = getOfficesForContract(contract);
  const downloadedFiles: string[] = [];

  for (let i = 0; i < officesList.length; i++) {
    const office = officesList[i];
    const { blob, fileName } = await generateCVPdfBlob(contract, office, counters);

    if (onProgress) {
      onProgress(i + 1, officesList.length, fileName);
    }

    const link = document.createElement('a');
    link.style.display = 'none';
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    downloadedFiles.push(fileName);

    incrementOfficeRefCounter(office.name);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if (i < officesList.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return downloadedFiles;
};

export const downloadCandidateCV = async (
  contract: Contract,
  onProgress?: (current: number, total: number, fileName: string) => void,
  counters?: OfficeRefCounter[]
): Promise<string[]> => {
  return downloadCandidateCVsForCountry(contract, onProgress, counters);
};

// ==========================================
// RENDER CV DIRECTLY TO HTML5 CANVAS (FAILSAFE PREVIEW)
// ==========================================
export const renderCVToCanvas = async (
  contract: Contract,
  officeName: string,
  pageNumber: 1 | 2,
  canvas: HTMLCanvasElement,
  counters?: OfficeRefCounter[]
): Promise<void> => {
  const country = getCountryForOffice(officeName);
  const data = contractToFormData(contract, officeName, counters);
  const layout = getLayout(country, officeName);
  adjustFullNameLayout(data, layout, country, officeName);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Render high-DPI A4 (210mm x 297mm) at 1240 x 1754 px
  const targetW = 1240;
  const targetH = 1754;
  canvas.width = targetW;
  canvas.height = targetH;
  const scale = targetW / 210; // px per mm

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  // Background template
  const templateBases = getTemplateBases(country, officeName);
  const extensions = ['.jpg', '.JPG', '.png', '.jpeg'];
  let bgImg: HTMLImageElement | null = null;
  for (const base of templateBases) {
    for (const ext of extensions) {
      if (!bgImg) {
        bgImg = await loadImageSafe(`/templates/${base}_${pageNumber}${ext}`);
      }
    }
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, targetW, targetH);
  }

  const drawText = (text: string | undefined, coord: Coord | undefined) => {
    if (!text || !coord || (coord.x === 0 && coord.y === 0)) return;
    const color = coord.color || [0, 0, 0];
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    const fontSize = (coord.size || 11) * scale * 0.35 * 2.83;
    const fontFam = coord.font === 'times' ? 'Times New Roman, serif' : '"Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.font = `bold ${Math.round(fontSize)}px ${fontFam}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(text), coord.x * scale, coord.y * scale);
  };

  if (pageNumber === 1) {
    // Header & Meta
    drawText(data.salary, layout.salary);
    drawText(data.refNo, layout.refNo);
    drawText(data.printDate, layout.printDate);
    drawText(data.monthlySalary, layout.monthlySalary);

    // Personal details
    drawText(data.fullName, layout.fullName);
    drawText(data.religion, layout.religion);
    drawText(data.dob, layout.dob);
    drawText(data.age, layout.age);
    drawText(data.pob, layout.pob);
    drawText(data.maritalStatus, layout.maritalStatus);
    drawText(data.children, layout.children);
    drawText(data.weight, layout.weight);
    drawText(data.height, layout.height);
    drawText(data.education, layout.education);
    drawText(data.nationality, layout.nationality);

    // Passport
    drawText(data.passportNumber, layout.passportNumber);
    drawText(data.issueDate, layout.issueDate);
    drawText(data.placeOfIssue, layout.placeOfIssue);
    drawText(data.expiryDate, layout.expiryDate);

    // Employment
    if (data.hasExperience) {
      drawText(data.expPeriod, layout.expPeriod);
      drawText(data.expPosition, layout.expPosition);
      drawText(data.expCountry, layout.expCountry);
      drawText(data.expPeriod2, layout.expPeriod2);
      drawText(data.expPosition2, layout.expPosition2);
      drawText(data.expCountry2, layout.expCountry2);
    }

    // Saudi contacts
    if ('contactPerson' in data && data.contactPerson) {
      const cData = data as AllFormData;
      drawText(cData.contactPerson, layout.contactName);
      drawText(cData.contactPhone, layout.contactPhone);
      drawText(cData.relationship, layout.contactRelationship);
      drawText(cData.address, layout.contactAddress);
    }

    // Draw Face Photo
    if (data.photos.face && layout.photoFace) {
      const faceImg = await loadImageSafe(data.photos.face);
      if (faceImg) {
        ctx.drawImage(
          faceImg,
          layout.photoFace.x * scale,
          layout.photoFace.y * scale,
          layout.photoFace.w * scale,
          layout.photoFace.h * scale
        );
      }
    }

    // Draw Full Body Photo
    if (data.photos.full && layout.photoFull) {
      const fullImg = await loadImageSafe(data.photos.full);
      if (fullImg) {
        ctx.drawImage(
          fullImg,
          layout.photoFull.x * scale,
          layout.photoFull.y * scale,
          layout.photoFull.w * scale,
          layout.photoFull.h * scale
        );
      }
    }
  } else if (pageNumber === 2) {
    // Page 2: Passport
    if (data.photos.passport && layout.photoPassport) {
      const passImg = await loadImageSafe(data.photos.passport);
      if (passImg) {
        ctx.drawImage(
          passImg,
          layout.photoPassport.x * scale,
          layout.photoPassport.y * scale,
          layout.photoPassport.w * scale,
          layout.photoPassport.h * scale
        );
      }
    }
  }
};

