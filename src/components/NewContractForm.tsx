import React, { useState, useEffect } from 'react';
import { 
  User, 
  Briefcase, 
  Globe, 
  Languages, 
  Award, 
  PhoneCall, 
  Download, 
  Check, 
  FileText,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { PhotoUploadCard } from './PhotoUploadCard';
import { 
  Contract, 
  MaritalStatus, 
  LanguageLevel, 
  PreferredCountry, 
  CompetencyProfile, 
  EmploymentRecord,
  OfficeRefCounter
} from '../types';
import { 
  calculateAge, 
  defaultCompetenciesNormal, 
  defaultCompetenciesExperienced,
  defaultOfficeCounters,
  offices 
} from '../constants';
import { downloadCandidateCVsForCountry } from '../utils/cvGenerator';
import { calculateIssueDateFromExpiry, calculateExpiryDateFromIssue, getPassportValidityYears } from '../utils/dateUtils';
import { scanPassportMRZ } from '../utils/mrzScanner';
import { toast } from 'sonner';

interface NewContractFormProps {
  onSubmitContract: (contract: Omit<Contract, 'id'>, shouldDownloadCV: boolean) => Promise<Contract | null>;
  onCancel?: () => void;
  officeCounters?: OfficeRefCounter[];
  onIncrementOfficeCounter?: (officeName: string) => void;
}

const extractFatherGrandfatherName = (name: string): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[1]} ${parts[2]}`;
  } else if (parts.length === 2) {
    return parts[1];
  }
  return '';
};

export const NewContractForm: React.FC<NewContractFormProps> = ({
  onSubmitContract,
  onCancel,
  officeCounters = defaultOfficeCounters,
  onIncrementOfficeCounter,
}) => {
  // Photos
  const [facePhoto, setFacePhoto] = useState<string | undefined>(undefined);
  const [fullBodyPhoto, setFullBodyPhoto] = useState<string | undefined>(undefined);
  const [passportPhoto, setPassportPhoto] = useState<string | undefined>(undefined);
  const [isScanningMRZ, setIsScanningMRZ] = useState(false);

  // Section 6: Broker & Emergency Contact details
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactAddress, setEmergencyContactAddress] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('Father');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerNumber, setBrokerNumber] = useState('');

  // Track if emergency contact fields were manually modified by user
  const [isEmergencyNameManuallyEdited, setIsEmergencyNameManuallyEdited] = useState(false);
  const [isEmergencyPhoneManuallyEdited, setIsEmergencyPhoneManuallyEdited] = useState(false);
  const [isEmergencyAddressManuallyEdited, setIsEmergencyAddressManuallyEdited] = useState(false);

  const handlePassportFileSelected = async (file: File) => {
    try {
      setIsScanningMRZ(true);
      toast.info('Scanning passport image and MRZ...');
      const scanned = await scanPassportMRZ(file);

      if (scanned.fullName) {
        setFullName(scanned.fullName);
        if (!isEmergencyNameManuallyEdited) {
          const fg = extractFatherGrandfatherName(scanned.fullName);
          if (fg) setEmergencyContactName(fg);
        }
      }
      if (scanned.passportNumber) {
        setPassportNumber(scanned.passportNumber);
      }
      if (scanned.dob) {
        setDateOfBirth(scanned.dob);
        const calcAge = calculateAge(scanned.dob);
        if (calcAge) setAge(calcAge);
      }
      if (scanned.expiryDate) {
        setExpiryDate(scanned.expiryDate);
      }
      if (scanned.issueDate) {
        setIssueDate(scanned.issueDate);
      } else if (scanned.expiryDate) {
        const autoIssue = calculateIssueDateFromExpiry(scanned.expiryDate, scanned.passportNumber);
        if (autoIssue) setIssueDate(autoIssue);
      }
      if (scanned.pob) {
        setPlaceOfBirth(scanned.pob);
        if (!isEmergencyAddressManuallyEdited) {
          setEmergencyContactAddress(scanned.pob);
        }
      }

      const isTenYear = scanned.validityYears === 10 || getPassportValidityYears(scanned.passportNumber, scanned.expiryDate) === 10;
      toast.success(
        `Passport scanned! Autofilled details (${isTenYear ? '10-Yr E-series: -10yr + 1day' : '5-Yr validity: -5yr + 1day'})`
      );
    } catch (err: any) {
      console.error('MRZ scan failed:', err);
      toast.error(err.message || 'Could not auto-read passport MRZ. You can fill details manually.');
    } finally {
      setIsScanningMRZ(false);
    }
  };

  // Section 1: Personal Details
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [religion, setReligion] = useState('Muslim');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>('single');
  const [numberOfChildren, setNumberOfChildren] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Section 2: Travel Credentials
  const [passportNumber, setPassportNumber] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [laborId, setLaborId] = useState('');
  const [coc, setCoc] = useState<'yes' | 'no'>('yes');
  const [preferredCountry, setPreferredCountry] = useState<PreferredCountry>('all');

  // Section 3: Language Proficiency (Unselected by default)
  const [englishProficiency, setEnglishProficiency] = useState<LanguageLevel | undefined>(undefined);
  const [arabicProficiency, setArabicProficiency] = useState<LanguageLevel | undefined>(undefined);

  // Section 4: Previous Employment History (No default country/period in record 1)
  const [hasPreviousExperience, setHasPreviousExperience] = useState(false);
  const [record1, setRecord1] = useState<EmploymentRecord>({
    country: '',
    periodYears: '',
    position: 'HOUSEMAID',
  });
  const [record2, setRecord2] = useState<EmploymentRecord>({
    country: '',
    periodYears: '',
    position: 'HOUSEMAID',
  });

  // Section 5: Competency Profile
  const [competencies, setCompetencies] = useState<CompetencyProfile>(defaultCompetenciesNormal);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Name handler - autofills Emergency Contact Name with Father + Grandfather name
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullName(val);
    if (!isEmergencyNameManuallyEdited) {
      const fg = extractFatherGrandfatherName(val);
      setEmergencyContactName(fg);
    }
  };

  // Phone Number handler - autofills Emergency Contact Phone
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneNumber(val);
    if (!isEmergencyPhoneManuallyEdited) {
      setEmergencyContactPhone(val);
    }
  };

  // Auto calculate age when DOB changes
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateOfBirth(val);
    if (val) {
      const calculated = calculateAge(val);
      if (calculated) {
        setAge(calculated);
      }
    }
  };

  // Place of birth autofills Emergency Contact Address
  const handlePlaceOfBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPlaceOfBirth(val);
    if (!isEmergencyAddressManuallyEdited) {
      setEmergencyContactAddress(val);
    }
  };

  // When "has previous experience" changes:
  const handleToggleExperience = () => {
    const nextState = !hasPreviousExperience;
    setHasPreviousExperience(nextState);
    
    if (nextState) {
      setCompetencies(prev => ({ ...prev, cooking: true }));
    } else {
      setCompetencies(prev => ({ ...prev, cooking: false }));
    }
  };

  const toggleCompetency = (key: keyof CompetencyProfile) => {
    setCompetencies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e: React.FormEvent, shouldDownloadCV: boolean = true) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Please enter the applicant full name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const employmentRecords: EmploymentRecord[] = [];
      if (hasPreviousExperience) {
        if (record1.country) employmentRecords.push(record1);
        if (record2.country) employmentRecords.push(record2);
      }

      // Labor ID format: EF or EW + 7 digits
      const formattedLaborId = laborId.trim().toUpperCase() || `EF${Math.floor(1000000 + Math.random() * 9000000)}`;

      const newContractPayload: Omit<Contract, 'id'> = {
        refNumber: '',
        facePhoto,
        fullBodyPhoto,
        passportPhoto,
        name: fullName.trim(),
        dateOfBirth,
        age: age || '24',
        phoneNumber: phoneNumber.trim(),
        religion,
        maritalStatus,
        numberOfChildren: numberOfChildren || '0',
        height,
        weight,
        passportNumber: passportNumber.trim(),
        placeOfBirth: placeOfBirth.trim(),
        issueDate,
        expiryDate,
        laborId: formattedLaborId,
        coc,
        preferredCountry,
        englishProficiency,
        arabicProficiency,
        hasPreviousExperience,
        experience: hasPreviousExperience ? 'yes' : 'no',
        experienceCountry: hasPreviousExperience ? record1.country : undefined,
        duration: hasPreviousExperience && record1.periodYears ? `${record1.periodYears} years` : undefined,
        employmentRecords,
        competencies,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactAddress: emergencyContactAddress.trim(),
        emergencyContactRelationship,
        emergencyContactPhone: emergencyContactPhone.trim(),
        brokerName: brokerName.trim() || 'Direct',
        brokerNumber: brokerNumber.trim(),
        office: '', // Available candidate
        date: new Date().toISOString().split('T')[0],
        status: 'Available',
        seed: fullName.trim().split(' ')[0] || 'Applicant',
      };

      const created = await onSubmitContract(newContractPayload, shouldDownloadCV);

      if (shouldDownloadCV && created) {
        toast.loading('Generating official PDF CVs...', { id: 'pdf-cv-gen' });
        try {
          await downloadCandidateCVsForCountry(created, (current, total, fileName) => {
            toast.loading(`Downloading (${current}/${total}): ${fileName}`, { id: 'pdf-cv-gen' });
          }, officeCounters);
          toast.success('Contract saved! PDF CVs downloaded successfully.', { id: 'pdf-cv-gen' });
        } catch (downloadErr) {
          console.error(downloadErr);
          toast.error('Contract saved, but failed to download PDF CVs.', { id: 'pdf-cv-gen' });
        }
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to submit contract.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6 md:space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header / Back Button */}
      {onCancel && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-300 hover:text-pink-400 font-bold text-xs sm:text-sm transition group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition" />
            <span>Back to Applicants</span>
          </button>
          <span className="text-xs font-mono text-slate-500 uppercase">
            New Registration
          </span>
        </div>
      )}

      {/* 3 PHOTO INPUTS (SHARED ASSETS) */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Layers size={18} className="text-pink-500" />
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-slate-200">
              Candidate Photos & Identity Assets
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
            3 Photo Uploads
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 pt-2">
          <PhotoUploadCard
            label="FACE PHOTO"
            subLabel="CLICK TO UPLOAD"
            type="face"
            value={facePhoto}
            onChange={setFacePhoto}
          />
          <PhotoUploadCard
            label="FULL BODY"
            subLabel="CLICK TO UPLOAD"
            type="body"
            value={fullBodyPhoto}
            onChange={setFullBodyPhoto}
          />
          <PhotoUploadCard
            label="PASSPORT PHOTO"
            subLabel={isScanningMRZ ? "SCANNING MRZ..." : "UPLOAD & AUTO-FILL"}
            type="passport"
            value={passportPhoto}
            onChange={setPassportPhoto}
            onFileSelected={handlePassportFileSelected}
            isLoading={isScanningMRZ}
            loadingText="Scanning MRZ..."
          />
        </div>
      </div>

      {/* SECTION 1: PERSONAL DETAILS */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-pink-500/20 pb-3">
          <User size={18} className="text-pink-500" />
          <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
            Section 1: Personal Details
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Full Name */}
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              Full Name <span className="text-pink-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder=""
              value={fullName}
              onChange={handleFullNameChange}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Religion - Only Muslim and Christian */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Religion
            </label>
            <select
              value={religion}
              onChange={(e) => setReligion(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            >
              <option value="Muslim">Muslim</option>
              <option value="Christian">Christian</option>
            </select>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} className="text-slate-500" /> Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={handleDobChange}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Age (Years)
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder=""
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder=""
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Marital Status */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Marital Status
            </label>
            <select
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value as MaritalStatus)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition uppercase"
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>

          {/* Number of Children */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Number of Children
            </label>
            <input
              type="number"
              min="0"
              placeholder=""
              value={numberOfChildren}
              onChange={(e) => setNumberOfChildren(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Height */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Height
            </label>
            <input
              type="text"
              placeholder=""
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Weight
            </label>
            <input
              type="text"
              placeholder=""
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: TRAVEL CREDENTIALS */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-pink-500/20 pb-3">
          <Globe size={18} className="text-pink-500" />
          <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
            Section 2: Travel Credentials
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Passport Number */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Passport Number
              </label>
              {passportNumber && (
                <span className="text-[10px] text-pink-400/90 font-mono font-medium">
                  {getPassportValidityYears(passportNumber, expiryDate) === 10 ? '10-Yr Validity (E-series)' : '5-Yr Validity'}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder=""
              value={passportNumber}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setPassportNumber(val);
                if (expiryDate) {
                  const autoIssue = calculateIssueDateFromExpiry(expiryDate, val);
                  if (autoIssue) setIssueDate(autoIssue);
                }
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition uppercase font-mono"
            />
          </div>

          {/* Place of Birth */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Place of Birth</span>
              <span className="text-[10px] text-pink-400 font-normal lowercase">(autofills address)</span>
            </label>
            <input
              type="text"
              placeholder=""
              value={placeOfBirth}
              onChange={handlePlaceOfBirthChange}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Labor ID */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Labor ID</span>
              <span className="text-[10px] text-slate-500 font-normal lowercase">(EF / EW + 7 digits)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. EF1201162 or EW1100899"
              value={laborId}
              onChange={(e) => setLaborId(e.target.value.toUpperCase())}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition uppercase font-mono placeholder:text-slate-600 placeholder:normal-case"
            />
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Passport Issue Date
              </label>
              {expiryDate && issueDate && (
                <span className="text-[11px] text-pink-400 font-medium flex items-center gap-1">
                  Auto: {getPassportValidityYears(passportNumber, expiryDate) === 10 ? '-10 yrs + 1 day' : '-5 yrs + 1 day'}
                </span>
              )}
            </div>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => {
                const val = e.target.value;
                setIssueDate(val);
                if (val && !expiryDate) {
                  const autoExpiry = calculateExpiryDateFromIssue(val, passportNumber);
                  if (autoExpiry) setExpiryDate(autoExpiry);
                }
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Passport Expiry Date
              </label>
              <span className="text-[10px] text-slate-500">
                {getPassportValidityYears(passportNumber, expiryDate) === 10 ? 'Auto: -10 yrs + 1 day' : 'Auto: -5 yrs + 1 day'}
              </span>
            </div>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => {
                const val = e.target.value;
                setExpiryDate(val);
                if (val) {
                  const autoIssue = calculateIssueDateFromExpiry(val, passportNumber);
                  if (autoIssue) setIssueDate(autoIssue);
                }
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* CoC (Yes/No Switch) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              CoC (Certificate of Competence)
            </label>
            <div className="flex gap-2 p-1 bg-[#050517] rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setCoc('yes')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition ${
                  coc === 'yes'
                    ? 'bg-pink-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setCoc('no')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition ${
                  coc === 'no'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Preferred Country */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Preferred Country
            </label>
            <select
              value={preferredCountry}
              onChange={(e) => setPreferredCountry(e.target.value as PreferredCountry)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition uppercase"
            >
              <option value="all">All Countries</option>
              <option value="jordan">Jordan</option>
              <option value="kuwait">Kuwait</option>
              <option value="saudi">Saudi Arabia</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 3: LANGUAGE PROFICIENCY (Unselected by default) */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-pink-500/20 pb-3">
          <Languages size={18} className="text-pink-500" />
          <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
            Section 3: Language Proficiency
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* English Radio Buttons */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#050517] border border-white/5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              English Language
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['poor', 'fair', 'fluent'] as LanguageLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEnglishProficiency(prev => prev === lvl ? undefined : lvl)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    englishProficiency === lvl
                      ? 'bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-500/20'
                      : 'bg-[#12122B] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${englishProficiency === lvl ? 'bg-white' : 'bg-slate-600'}`} />
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Arabic Radio Buttons - No Arabic subtext */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#050517] border border-white/5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Arabic Language
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['poor', 'fair', 'fluent'] as LanguageLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setArabicProficiency(prev => prev === lvl ? undefined : lvl)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    arabicProficiency === lvl
                      ? 'bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-500/20'
                      : 'bg-[#12122B] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${arabicProficiency === lvl ? 'bg-white' : 'bg-slate-600'}`} />
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: PREVIOUS EMPLOYMENT HISTORY */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-pink-500" />
            <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
              Section 4: Previous Employment History
            </h3>
          </div>
        </div>

        {/* Toggle Button */}
        <div>
          <button
            type="button"
            onClick={handleToggleExperience}
            className={`w-full py-3.5 px-5 rounded-2xl border flex items-center gap-3 transition-all ${
              hasPreviousExperience
                ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                : 'bg-[#050517] border-white/10 text-slate-400 hover:border-white/20'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
              hasPreviousExperience ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-600'
            }`}>
              {hasPreviousExperience && <Check size={14} className="stroke-[3]" />}
            </div>
            <span className="text-xs font-black uppercase tracking-wider">
              HAS PREVIOUS EXPERIENCE
            </span>
          </button>
        </div>

        {/* Dropdown 2 rows of inputs when active */}
        {hasPreviousExperience && (
          <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Record 1 - Empty default country and period */}
            <div className="p-5 rounded-2xl bg-[#050517] border border-white/10 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Record 1
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    placeholder=""
                    value={record1.country}
                    onChange={(e) => setRecord1(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Period (Years)</label>
                  <input
                    type="text"
                    placeholder=""
                    value={record1.periodYears}
                    onChange={(e) => setRecord1(prev => ({ ...prev, periodYears: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Position</label>
                  <input
                    type="text"
                    value={record1.position}
                    onChange={(e) => setRecord1(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none uppercase font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Record 2 (Optional) */}
            <div className="p-5 rounded-2xl bg-[#050517] border border-white/10 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Record 2 (Optional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    placeholder=""
                    value={record2.country}
                    onChange={(e) => setRecord2(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Period (Years)</label>
                  <input
                    type="text"
                    placeholder=""
                    value={record2.periodYears}
                    onChange={(e) => setRecord2(prev => ({ ...prev, periodYears: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Position</label>
                  <input
                    type="text"
                    value={record2.position}
                    onChange={(e) => setRecord2(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full bg-[#12122B] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none uppercase font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: COMPETENCY PROFILE (No Arabic subtext) */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-pink-500" />
            <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
              Section 5: Competency Profile
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info size={13} className="text-pink-400" />
            <span>Click any competency button to select/deselect</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'cooking', label: 'Cooking' },
            { key: 'babysitting', label: 'Baby Sitting' },
            { key: 'cleaning', label: 'Cleaning' },
            { key: 'washing', label: 'Washing' },
            { key: 'ironing', label: 'Ironing' },
            { key: 'sewing', label: 'Sewing' },
          ].map((item) => {
            const isSelected = competencies[item.key as keyof CompetencyProfile];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleCompetency(item.key as keyof CompetencyProfile)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[75px] ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/80 text-amber-400 shadow-md'
                    : 'bg-[#050517] border-white/10 text-slate-500 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-600'
                  }`}>
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider mt-2">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 6: BROKER & EMERGENCY CONTACT DETAILS */}
      <div className="bg-[#12122B] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-pink-500/20 pb-3">
          <PhoneCall size={18} className="text-pink-500" />
          <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest">
            Section 6: Broker & Emergency Contact Details
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Contact Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Emergency Contact Name</span>
              {emergencyContactName && !isEmergencyNameManuallyEdited && (
                <span className="text-[10px] text-pink-400 font-normal lowercase">
                  (autofilled: father + grandfather)
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder=""
              value={emergencyContactName}
              onChange={(e) => {
                setEmergencyContactName(e.target.value);
                setIsEmergencyNameManuallyEdited(true);
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Relationship */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Relationship
            </label>
            <input
              type="text"
              placeholder=""
              value={emergencyContactRelationship}
              onChange={(e) => setEmergencyContactRelationship(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Contact Phone Number</span>
              {emergencyContactPhone && !isEmergencyPhoneManuallyEdited && (
                <span className="text-[10px] text-pink-400 font-normal lowercase">
                  (autofilled with applicant phone)
                </span>
              )}
            </label>
            <input
              type="tel"
              placeholder=""
              value={emergencyContactPhone}
              onChange={(e) => {
                setEmergencyContactPhone(e.target.value);
                setIsEmergencyPhoneManuallyEdited(true);
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Address (Autofilled with place of birth) */}
          <div className="space-y-2 sm:col-span-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Emergency Contact Address</span>
              {emergencyContactAddress && !isEmergencyAddressManuallyEdited && (
                <span className="text-[10px] text-pink-400 font-normal lowercase">
                  (autofilled with place of birth: {placeOfBirth || emergencyContactAddress})
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder=""
              value={emergencyContactAddress}
              onChange={(e) => {
                setEmergencyContactAddress(e.target.value);
                setIsEmergencyAddressManuallyEdited(true);
              }}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Broker's Name */}
          <div className="space-y-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Broker's Name
            </label>
            <input
              type="text"
              placeholder=""
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>

          {/* Broker's Number */}
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Broker's Phone Number
            </label>
            <input
              type="tel"
              placeholder=""
              value={brokerNumber}
              onChange={(e) => setBrokerNumber(e.target.value)}
              className="w-full bg-[#050517] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* SUBMISSION & ACTIONS (ONLY SUBMIT AND DOWNLOAD CV) */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#12122B] to-[#1d1d42] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white">Ready to register applicant?</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Will generate ref number, save dossier, and automatically initiate candidate CV download.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3.5 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-xs uppercase tracking-widest transition shadow-xl shadow-pink-500/25 disabled:opacity-50"
          >
            <Download size={18} />
            <span>{isSubmitting ? 'Submitting...' : 'Submit and Download CV'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
