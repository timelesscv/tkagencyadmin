import { Office, OfficeRefCounter, CompetencyProfile, Contract } from './types';

export const offices: Office[] = [
  { id: '1', name: 'Ewan', country: 'Jordan', color: 'border-red-500' },
  { id: '2', name: 'Options', country: 'Jordan', color: 'border-red-500' },
  { id: '3', name: 'Injaz', country: 'Jordan', color: 'border-red-500' },
  { id: '4', name: 'Alnoor', country: 'Kuwait', color: 'border-blue-500' },
  { id: '5', name: 'Fahad', country: 'Kuwait', color: 'border-blue-500' },
  { id: '6', name: 'Aldhahran', country: 'Saudi', color: 'border-green-500' },
];

export const defaultOfficeCounters: OfficeRefCounter[] = [
  { id: '1', name: 'Ewan', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
  { id: '2', name: 'Options', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
  { id: '3', name: 'Injaz', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
  { id: '4', name: 'Alnoor', country: 'Kuwait', nextNumber: 1, color: 'border-blue-500' },
  { id: '5', name: 'Fahad', country: 'Kuwait', nextNumber: 1, color: 'border-blue-500' },
  { id: '6', name: 'Aldhahran', country: 'Saudi', nextNumber: 1, color: 'border-green-500' },
];

export const formatOfficeRefNumber = (
  office: OfficeRefCounter,
  numValue?: number
): string => {
  const val = numValue !== undefined ? numValue : (office.nextNumber || 1);
  return String(val);
};

export const defaultCompetenciesNormal: CompetencyProfile = {
  cooking: false,
  cleaning: true,
  babysitting: true,
  washing: true,
  ironing: true,
  sewing: true,
};

export const defaultCompetenciesExperienced: CompetencyProfile = {
  cooking: true,
  cleaning: true,
  babysitting: true,
  washing: true,
  ironing: true,
  sewing: true,
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export const isFlightUpcoming = (departureDateStr?: string): boolean => {
  if (!departureDateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = departureDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const flightDayEnd = new Date(year, month, day, 23, 59, 59, 999);
    return flightDayEnd.getTime() >= today.getTime();
  }

  const d = new Date(departureDateStr);
  return !isNaN(d.getTime()) && d.getTime() >= today.getTime();
};

export const getFlightDepartureLabel = (departureDateStr?: string): { label: string; isPast: boolean; isToday: boolean } => {
  if (!departureDateStr) return { label: 'No date', isPast: true, isToday: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let flightDate: Date;
  const parts = departureDateStr.split('-');
  if (parts.length === 3) {
    flightDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    flightDate = new Date(departureDateStr);
  }
  flightDate.setHours(0, 0, 0, 0);

  const diffTime = flightDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: 'Departs Today', isPast: false, isToday: true };
  } else if (diffDays === 1) {
    return { label: 'Departs Tomorrow', isPast: false, isToday: false };
  } else if (diffDays > 1) {
    return { label: `In ${diffDays} days`, isPast: false, isToday: false };
  } else if (diffDays === -1) {
    return { label: 'Departed Yesterday', isPast: true, isToday: false };
  } else {
    return { label: `Departed ${Math.abs(diffDays)} days ago`, isPast: true, isToday: false };
  }
};

export const calculateAge = (dob: string): string => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 ? age.toString() : '';
};

export const generateRefNumber = (name: string, dateStr?: string): string => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const yr = date.getFullYear().toString().slice(-2);
  const mo = (date.getMonth() + 1).toString().padStart(2, '0');
  const cleanName = (name || 'APP').trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TK-${yr}${mo}-${cleanName}-${randomNum}`;
};

export const sampleContracts: Contract[] = [
  {
    id: 'c1',
    refNumber: 'TK-2603-WUD-0115',
    name: 'WUDINESH BEKELE ELAMO',
    laborId: 'EFLCD01159',
    dateOfBirth: '2001-11-03',
    age: '24',
    phoneNumber: '+251 92 456 7890',
    religion: 'Christian',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.60 M',
    weight: '54 KG',
    passportNumber: 'EP9928134',
    placeOfBirth: 'Hawassa',
    issueDate: '2024-01-15',
    expiryDate: '2029-01-14',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'poor',
    arabicProficiency: 'fair',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Bekele Elamo',
    emergencyContactAddress: 'Hawassa',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 91 555 7788',
    brokerName: 'Mulugeta Kebede',
    brokerNumber: '+251 94 888 9900',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Wudinesh',
    office: 'Options',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c2',
    refNumber: 'TK-2603-BIR-1201',
    name: 'Bire Burka Kebabu',
    laborId: 'EF12011624',
    dateOfBirth: '1995-09-18',
    age: '30',
    phoneNumber: '+251 93 321 6549',
    religion: 'Muslim',
    maritalStatus: 'married',
    numberOfChildren: '1',
    height: '1.68 M',
    weight: '62 KG',
    passportNumber: 'EP6543219',
    placeOfBirth: 'Bishoftu',
    issueDate: '2022-06-12',
    expiryDate: '2027-06-11',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'fluent',
    arabicProficiency: 'poor',
    hasPreviousExperience: true,
    experience: 'yes',
    employmentRecords: [
      { country: 'Jordan', periodYears: '2', position: 'HOUSEMAID' }
    ],
    competencies: {
      cooking: true,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Burka Kebabu',
    emergencyContactAddress: 'Bishoftu',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 92 111 2233',
    brokerName: 'Girma Alemayehu',
    brokerNumber: '+251 95 666 7788',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Bire',
    office: 'Ewan',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c3',
    refNumber: 'TK-2603-YET-1100',
    name: 'YETINAYET ASRES DECHASA',
    laborId: 'EF11008995',
    dateOfBirth: '1999-03-25',
    age: '27',
    phoneNumber: '+251 94 777 8899',
    religion: 'Christian',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.63 M',
    weight: '56 KG',
    passportNumber: 'EP4419203',
    placeOfBirth: 'Bahir Dar',
    issueDate: '2023-09-01',
    expiryDate: '2028-08-31',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'fluent',
    arabicProficiency: 'fair',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Asres Dechasa',
    emergencyContactAddress: 'Bahir Dar',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 93 444 5566',
    brokerName: 'Solomon Worku',
    brokerNumber: '+251 91 222 3344',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Yetinayet',
    office: 'Ewan',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c4',
    refNumber: 'TK-2603-FAN-1107',
    name: 'FANA GOITOM HNDEYA',
    laborId: 'EF11074012',
    dateOfBirth: '2000-07-19',
    age: '26',
    phoneNumber: '+251 96 222 1100',
    religion: 'Christian',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.62 M',
    weight: '55 KG',
    passportNumber: 'EP7721839',
    placeOfBirth: 'Mekelle',
    issueDate: '2024-03-10',
    expiryDate: '2029-03-09',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'fair',
    arabicProficiency: 'poor',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Goitom Hndeya',
    emergencyContactAddress: 'Mekelle',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 96 333 4455',
    brokerName: 'Alula Berhe',
    brokerNumber: '+251 97 111 2233',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Fana',
    office: 'Ewan',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c5',
    refNumber: 'TK-2603-MES-1213',
    name: 'MESELECH AREBA YAYA',
    laborId: 'EF12134628',
    dateOfBirth: '1998-10-12',
    age: '27',
    phoneNumber: '+251 91 666 4321',
    religion: 'Muslim',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.64 M',
    weight: '57 KG',
    passportNumber: 'EP5532109',
    placeOfBirth: 'Jimma',
    issueDate: '2023-05-18',
    expiryDate: '2028-05-17',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'fair',
    arabicProficiency: 'fair',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Areba Yaya',
    emergencyContactAddress: 'Jimma',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 91 777 9900',
    brokerName: 'Tewodros Kassaye',
    brokerNumber: '+251 92 888 1122',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Meselech',
    office: 'Ewan',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c6',
    refNumber: 'TK-2603-NGS-1189',
    name: 'NGSTI ABRHA HADIS',
    laborId: 'EF11898868',
    dateOfBirth: '2002-04-15',
    age: '23',
    phoneNumber: '+251 95 333 8877',
    religion: 'Christian',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.59 M',
    weight: '51 KG',
    passportNumber: 'EP3321908',
    placeOfBirth: 'Adwa',
    issueDate: '2024-02-20',
    expiryDate: '2029-02-19',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'poor',
    arabicProficiency: 'poor',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Abrha Hadis',
    emergencyContactAddress: 'Adwa',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 95 444 6677',
    brokerName: 'Mulugeta Kebede',
    brokerNumber: '+251 94 888 9900',
    date: '2026-03-25',
    status: 'Pending',
    seed: 'Ngsti',
    office: 'Ewan',
    visaArrivedDate: '2026-03-25',
  },
  {
    id: 'c7',
    refNumber: 'TK-2603-NAT-2398',
    name: 'GENET TADESSE KEBEDE',
    laborId: 'EW1298451',
    dateOfBirth: '2000-05-14',
    age: '25',
    phoneNumber: '+251 91 123 4567',
    religion: 'Muslim',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.65 M',
    weight: '58 KG',
    passportNumber: 'EP8472910',
    placeOfBirth: 'Addis Ababa',
    issueDate: '2023-02-10',
    expiryDate: '2028-02-09',
    coc: 'yes',
    preferredCountry: 'jordan',
    englishProficiency: 'fair',
    arabicProficiency: 'fluent',
    hasPreviousExperience: true,
    experience: 'yes',
    employmentRecords: [
      { country: 'Jordan', periodYears: '2', position: 'HOUSEMAID' }
    ],
    competencies: {
      cooking: true,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Tadesse Kebede',
    emergencyContactAddress: 'Addis Ababa',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 91 987 6543',
    brokerName: 'Tadesse Bekele',
    brokerNumber: '+251 92 333 4455',
    date: '2026-03-28',
    status: 'Available',
    seed: 'Genet',
    office: '',
  },
  {
    id: 'c8',
    refNumber: 'TK-2603-LEM-4512',
    name: 'LEMLEM HAILE GEBRE',
    laborId: 'EF1278943',
    dateOfBirth: '1999-08-20',
    age: '26',
    phoneNumber: '+251 92 888 7766',
    religion: 'Christian',
    maritalStatus: 'single',
    numberOfChildren: '0',
    height: '1.61 M',
    weight: '53 KG',
    passportNumber: 'EP9911223',
    placeOfBirth: 'Gondar',
    issueDate: '2024-04-01',
    expiryDate: '2029-03-31',
    coc: 'yes',
    preferredCountry: 'kuwait',
    englishProficiency: 'fluent',
    arabicProficiency: 'fair',
    hasPreviousExperience: false,
    experience: 'no',
    employmentRecords: [],
    competencies: {
      cooking: false,
      cleaning: true,
      babysitting: true,
      washing: true,
      ironing: true,
      sewing: true,
    },
    emergencyContactName: 'Haile Gebre',
    emergencyContactAddress: 'Gondar',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+251 92 777 6655',
    brokerName: 'Dawit Mengistu',
    brokerNumber: '+251 91 444 3322',
    date: '2026-03-28',
    status: 'Available',
    seed: 'Lemlem',
    office: '',
  }
];
