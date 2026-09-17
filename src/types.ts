export type PreferredCountry = 'all' | 'jordan' | 'kuwait' | 'saudi';
export type LanguageLevel = 'poor' | 'fair' | 'fluent';
export type MaritalStatus = 'single' | 'married' | 'widowed' | 'divorced';
export type ContractStatus = 'available' | 'pending' | 'completed';

export interface EmploymentRecord {
  country: string;
  periodYears: string;
  position: string;
}

export interface CompetencyProfile {
  cooking: boolean;
  cleaning: boolean;
  babysitting: boolean;
  washing: boolean;
  ironing: boolean;
  sewing: boolean;
}

export interface ContractPhotos {
  facePhoto?: string;
  fullBodyPhoto?: string;
  passportPhoto?: string;
}

export interface Contract {
  id: string;
  refNumber?: string;
  
  // Photos
  facePhoto?: string;
  fullBodyPhoto?: string;
  passportPhoto?: string;
  
  // Section 1: Personal Details
  name: string; // Full name
  dateOfBirth?: string;
  age: string;
  phoneNumber: string;
  religion: string;
  maritalStatus?: MaritalStatus;
  numberOfChildren?: string;
  height?: string;
  weight?: string;
  
  // Section 2: Travel Credentials
  passportNumber?: string;
  placeOfBirth?: string;
  issueDate?: string;
  expiryDate?: string;
  laborId: string;
  coc?: string; // 'yes' | 'no'
  preferredCountry?: string; // 'all' | 'jordan' | 'kuwait' | 'saudi'
  
  // Section 3: Language Proficiency
  englishProficiency?: LanguageLevel;
  arabicProficiency?: LanguageLevel;
  
  // Section 4: Previous Employment History
  hasPreviousExperience?: boolean;
  experienceCountry?: string; // legacy support
  duration?: string; // legacy support
  experience?: string; // 'yes' | 'no'
  employmentRecords?: EmploymentRecord[];
  
  // Section 5: Competency Profile
  competencies?: CompetencyProfile;
  
  // Section 6: Emergency Contact Details
  emergencyContactName?: string;
  emergencyContactAddress?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  brokerName?: string;
  brokerNumber?: string;
  
  // Meta & Status tracking
  date: string;
  status: string;
  seed: string;
  office: string;
  
  // Status flags
  isSpecialCase?: boolean;
  specialCaseNote?: string;
  visaArrivedDate?: string;
  
  // Flight & Deployment
  airline?: string;
  departureDate?: string;
  ticketPrice?: string;
  transit?: string;
  commissionPaid?: string;
  commissionAmount?: string;
  // Cloudflare Storage CV tracking
  generatedCVs?: GeneratedCVInfo[];
  assignedOfficeCV?: GeneratedCVInfo;
}

export interface GeneratedCVInfo {
  officeName: string;
  country: string;
  fileName: string;
  generatedAt: string;
  storageUrl: string;
  status: 'active' | 'pruned';
  sizeFormatted?: string;
}

export interface Office {
  id: string;
  name: string;
  country: 'Jordan' | 'Kuwait' | 'Saudi' | string;
  color: string;
}

export interface OfficeRefCounter {
  id: string;
  name: string;
  country: 'Jordan' | 'Kuwait' | 'Saudi' | string;
  nextNumber: number;
  color?: string;
}

export type ContractsSubTab = 'new-contract' | 'available' | 'pending' | 'completed' | 'special-cases';
export type MainView = 'home' | 'contracts' | 'settings';

export interface BaseFormData {
  refNo?: string;
  fullName: string;
  religion?: string;
  dob?: string;
  age?: string;
  pob?: string;
  maritalStatus?: string;
  children?: string;
  weight?: string;
  height?: string;
  education?: string;
  nationality?: string;
  passportNumber?: string;
  issueDate?: string;
  placeOfIssue?: string;
  expiryDate?: string;
  photos: {
    face?: string;
    full?: string;
    passport?: string;
  };
  hasExperience?: boolean;
  expCountry?: string;
  expPeriod?: string;
  expPosition?: string;
  expCountry2?: string;
  expPeriod2?: string;
  expPosition2?: string;
  englishLevel?: 'POOR' | 'FAIR' | 'FLUENT' | string;
  arabicLevel?: 'POOR' | 'FAIR' | 'FLUENT' | string;
}

export interface KuwaitFormData extends BaseFormData {
  salary: string;
  printDate?: string;
  skills: {
    cooking: boolean;
    [key: string]: boolean;
  };
  contactPerson?: string;
  contactPhone?: string;
}

export interface SaudiFormData extends BaseFormData {
  monthlySalary: string;
  skills: {
    cooking: boolean;
    [key: string]: boolean;
  };
  contactPerson?: string;
  contactPhone?: string;
  relationship?: string;
  address?: string;
}

export interface JordanFormData extends BaseFormData {
  salary?: string;
  skills: {
    cooking: boolean;
    [key: string]: boolean;
  };
  contactPerson?: string;
  contactPhone?: string;
  relationship?: string;
  address?: string;
}

export type AllFormData = BaseFormData & {
  salary?: string;
  monthlySalary?: string;
  printDate?: string;
  skills: {
    cooking: boolean;
    [key: string]: boolean;
  };
  contactPerson?: string;
  contactPhone?: string;
  relationship?: string;
  address?: string;
};
