import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon,
  User,
  Briefcase,
  Globe,
  Languages,
  Award,
  PhoneCall,
  Edit2,
  Trash2,
  Star,
  Download,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
  Scan,
  FileText
} from 'lucide-react';
import { 
  Contract, 
  MaritalStatus, 
  LanguageLevel, 
  PreferredCountry, 
  CompetencyProfile, 
  EmploymentRecord,
  OfficeRefCounter 
} from '../types';
import { PhotoUploadCard } from './PhotoUploadCard';
import { calculateAge, offices } from '../constants';
import { downloadCandidateCVsForCountry, getOfficesForContract } from '../utils/cvGenerator';
import { calculateIssueDateFromExpiry, calculateExpiryDateFromIssue, getPassportValidityYears } from '../utils/dateUtils';
import { scanPassportMRZ } from '../utils/mrzScanner';
import { pruneCandidateCVsAfterAllocation } from '../services/cloudflareStorage';
import { toast } from 'sonner';

interface ApplicantDetailModalProps {
  contract: Contract;
  officeCounters?: OfficeRefCounter[];
  onClose: () => void;
  onUpdate: (updated: Contract) => void;
  onDeleteRequest?: (contract: Contract) => void;
  onSpecialCaseRequest?: (contract: Contract) => void;
  onPreviewCV?: (contract: Contract) => void;
  onIncrementOfficeCounter?: (officeName: string) => void;
}

export const ApplicantDetailModal: React.FC<ApplicantDetailModalProps> = ({
  contract,
  officeCounters = [],
  onClose,
  onUpdate,
  onDeleteRequest,
  onSpecialCaseRequest,
  onPreviewCV,
  onIncrementOfficeCounter,
}) => {
  const [activeTab, setActiveTab] = useState<'contracts' | 'visa' | 'flight'>('contracts');
  
  // Independent edit modes for each section (locked by default until Edit is clicked)
  const [isEditingContracts, setIsEditingContracts] = useState(false);
  const [isEditingVisa, setIsEditingVisa] = useState(false);
  const [isEditingFlight, setIsEditingFlight] = useState(false);

  // Form state initialized with contract data
  const [formData, setFormData] = useState<Contract>({ ...contract });
  const [isDownloadingCV, setIsDownloadingCV] = useState<boolean>(false);
  const [isScanningMRZ, setIsScanningMRZ] = useState(false);
  const passportScanInputRef = React.useRef<HTMLInputElement>(null);

  const handlePassportMRZUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsScanningMRZ(true);
      toast.info('Scanning passport image and MRZ...');
      const scanned = await scanPassportMRZ(file);
      setFormData(p => {
        const updated = { ...p };
        if (scanned.fullName) updated.name = scanned.fullName;
        if (scanned.passportNumber) updated.passportNumber = scanned.passportNumber;
        if (scanned.dob) {
          updated.dateOfBirth = scanned.dob;
          const calcAge = calculateAge(scanned.dob);
          if (calcAge) updated.age = calcAge;
        }
        if (scanned.expiryDate) updated.expiryDate = scanned.expiryDate;
        if (scanned.issueDate) {
          updated.issueDate = scanned.issueDate;
        } else if (scanned.expiryDate) {
          const autoIssue = calculateIssueDateFromExpiry(scanned.expiryDate, scanned.passportNumber);
          if (autoIssue) updated.issueDate = autoIssue;
        }
        if (scanned.pob) updated.placeOfBirth = scanned.pob;
        return updated;
      });
      const isTenYear = scanned.validityYears === 10 || getPassportValidityYears(scanned.passportNumber, scanned.expiryDate) === 10;
      toast.success(
        `MRZ Scanned! Autofilled details (${isTenYear ? '10-Yr E-series: -10yr + 1day' : '5-Yr validity: -5yr + 1day'})`
      );
    } catch (err: any) {
      console.error('MRZ scan failed:', err);
      toast.error(err.message || 'Could not scan passport MRZ.');
    } finally {
      setIsScanningMRZ(false);
      if (passportScanInputRef.current) passportScanInputRef.current.value = '';
    }
  };

  const handleDownloadCVs = async () => {
    setIsDownloadingCV(true);
    const targetOffices = getOfficesForContract(formData);
    const toastId = toast.loading(`Generating & downloading ${targetOffices.length} office PDF CV(s)...`);
    try {
      await downloadCandidateCVsForCountry(formData, (curr, tot, fileName) => {
        toast.loading(`Downloading (${curr}/${tot}): ${fileName}`, { id: toastId });
      }, officeCounters);
      toast.success(`Successfully downloaded ${targetOffices.length} PDF CV(s)!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF CVs', { id: toastId });
    } finally {
      setIsDownloadingCV(false);
    }
  };

  // Selected country in Visa tab (autofilled from preferredCountry if not 'all')
  const [visaCountry, setVisaCountry] = useState<string>(() => {
    if (contract.preferredCountry && contract.preferredCountry !== 'all') {
      return contract.preferredCountry.toLowerCase();
    }
    // Check if office belongs to a specific country
    if (contract.office) {
      const match = offices.find(o => o.name.toLowerCase() === contract.office.toLowerCase());
      if (match) return match.country.toLowerCase();
    }
    return '';
  });

  // When contract changes, sync form state
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      ...contract,
      visaArrivedDate: contract.visaArrivedDate || today,
    });

    if (contract.preferredCountry && contract.preferredCountry !== 'all') {
      setVisaCountry(contract.preferredCountry.toLowerCase());
    } else if (contract.office) {
      const match = offices.find(o => o.name.toLowerCase() === contract.office.toLowerCase());
      if (match) setVisaCountry(match.country.toLowerCase());
    }
  }, [contract]);

  // Handle Save
  const handleSave = (section: 'contracts' | 'visa' | 'flight') => {
    let updatedStatus = formData.status;
    
    // Status logic:
    // Available = visa not issued yet (no visaArrivedDate)
    // Pending = visa filled (visaArrivedDate exists, no departureDate)
    // Completed = ticket booked (departureDate exists)
    if (formData.isSpecialCase) {
      updatedStatus = 'Special Case';
    } else if (formData.departureDate) {
      updatedStatus = 'Completed';
    } else if (formData.visaArrivedDate) {
      updatedStatus = 'Pending';
    } else {
      updatedStatus = 'Available';
    }

    const updated: Contract = {
      ...formData,
      status: updatedStatus,
    };

    // If saving VISA DETAILS & OFFICE ALLOCATION, delete all CVs from Cloudflare storage except the assigned office one
    if (section === 'visa' && formData.office && formData.visaArrivedDate) {
      try {
        const pruneResult = pruneCandidateCVsAfterAllocation(updated, formData.office, officeCounters);
        updated.assignedOfficeCV = pruneResult.retainedCV;
        updated.generatedCVs = pruneResult.remainingCVs;
        if (pruneResult.deletedCount > 0) {
          toast.success(
            `Office allocated to ${formData.office}: Retained official CV and deleted other ${pruneResult.deletedCount} CVs from Cloudflare storage.`
          );
        }
      } catch (err) {
        console.error('Failed to prune CVs in Cloudflare:', err);
      }
    }

    onUpdate(updated);
    setFormData(updated);

    // Lock edit mode for the saved section
    if (section === 'contracts') setIsEditingContracts(false);
    if (section === 'visa') setIsEditingVisa(false);
    if (section === 'flight') setIsEditingFlight(false);

    toast.success('Changes saved successfully and locked');
  };

  // Handle Cancel Edit
  const handleCancel = (section: 'contracts' | 'visa' | 'flight') => {
    setFormData({ ...contract });
    if (section === 'contracts') setIsEditingContracts(false);
    if (section === 'visa') setIsEditingVisa(false);
    if (section === 'flight') setIsEditingFlight(false);
    toast.info('Edit cancelled');
  };

  // Toggle Special Case
  const handleToggleSpecialCase = () => {
    if (formData.isSpecialCase) {
      const updated: Contract = {
        ...formData,
        isSpecialCase: false,
        specialCaseNote: undefined,
        status: formData.departureDate ? 'Completed' : formData.visaArrivedDate ? 'Pending' : 'Available',
      };
      setFormData(updated);
      onUpdate(updated);
      toast.success(`Removed ${formData.name} from Special Cases`);
    } else if (onSpecialCaseRequest) {
      onSpecialCaseRequest(formData);
    } else {
      const updated: Contract = {
        ...formData,
        isSpecialCase: true,
        specialCaseNote: 'Marked for special attention',
        status: 'Special Case',
      };
      setFormData(updated);
      onUpdate(updated);
      toast.success(`Moved ${formData.name} to Special Cases`);
    }
  };

  // Stepper completion indicators
  const isContractsCompleted = true; // Always completed since contract is registered
  const isVisaCompleted = Boolean(formData.visaArrivedDate && formData.office);
  const isFlightCompleted = Boolean(formData.departureDate);

  // Available offices based on selected country in Visa tab
  const filteredOffices = offices.filter(o => {
    if (!visaCountry) return false;
    return o.country.toLowerCase() === visaCountry.toLowerCase();
  });

  return (
    <div className="max-w-6xl w-full mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* TOP BAR: Back Navigation + Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-300 hover:text-pink-400 font-bold text-sm transition group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition" />
          <span>Back to Contracts</span>
        </button>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Move / Remove Special Case Button */}
          <button
            type="button"
            onClick={handleToggleSpecialCase}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              formData.isSpecialCase
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 hover:bg-orange-500/30'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-orange-400'
            }`}
          >
            <Star size={14} className={formData.isSpecialCase ? 'fill-orange-400' : ''} />
            <span>{formData.isSpecialCase ? 'Special Case Active' : 'Move to Special Case'}</span>
          </button>

          {/* Preview CV */}
          {onPreviewCV && (
            <button
              type="button"
              onClick={() => onPreviewCV(formData)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition"
            >
              <Eye size={14} />
              <span>Preview CV</span>
            </button>
          )}

          {/* Download CV */}
          <button
            type="button"
            onClick={handleDownloadCVs}
            disabled={isDownloadingCV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 text-xs font-bold transition disabled:opacity-50"
            title="Generate and download genuine PDF CVs"
          >
            {isDownloadingCV ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>{isDownloadingCV ? 'Downloading...' : 'Download PDF CV'}</span>
          </button>
        </div>
      </div>

      {/* HORIZONTAL STEPPER PROGRESS */}
      <div className="bg-[#0e0c24] rounded-2xl p-5 sm:p-6 border border-white/5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* STEP 1: Contracts (formerly Personal Details) */}
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className="flex items-center gap-3 text-left transition group"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className={`text-sm font-bold block ${activeTab === 'contracts' ? 'text-pink-400' : 'text-slate-200 group-hover:text-white'}`}>
                Contracts
              </span>
              <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Completed
              </span>
            </div>
          </button>

          {/* Dotted Separator */}
          <div className="hidden sm:block flex-1 border-t border-dashed border-white/10 mx-4" />

          {/* STEP 2: Visa (formerly Contract) */}
          <button
            type="button"
            onClick={() => setActiveTab('visa')}
            className="flex items-center gap-3 text-left transition group"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
              isVisaCompleted
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isVisaCompleted ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            </div>
            <div>
              <span className={`text-sm font-bold block ${activeTab === 'visa' ? 'text-pink-400' : 'text-slate-200 group-hover:text-white'}`}>
                Visa
              </span>
              <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isVisaCompleted
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#181630] text-slate-400 border border-white/5'
              }`}>
                {isVisaCompleted ? 'Completed' : 'Not Started'}
              </span>
            </div>
          </button>

          {/* Dotted Separator */}
          <div className="hidden sm:block flex-1 border-t border-dashed border-white/10 mx-4" />

          {/* STEP 3: Flight Ticket */}
          <button
            type="button"
            onClick={() => setActiveTab('flight')}
            className="flex items-center gap-3 text-left transition group"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
              isFlightCompleted
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isFlightCompleted ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            </div>
            <div>
              <span className={`text-sm font-bold block ${activeTab === 'flight' ? 'text-pink-400' : 'text-slate-200 group-hover:text-white'}`}>
                Flight Ticket
              </span>
              <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isFlightCompleted
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#181630] text-slate-400 border border-white/5'
              }`}>
                {isFlightCompleted ? 'Completed' : 'Not Started'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* TAB 1: CONTRACTS (Showing ALL Submitted Info from New Contract) */}
      {activeTab === 'contracts' && (
        <div className="bg-[#0e0c24] rounded-3xl p-6 sm:p-8 md:p-10 border border-white/5 shadow-2xl space-y-8">
          
          {/* Header & Lock Indicator */}
          <div className="border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-pink-500 tracking-wider uppercase">
              CONTRACTS
            </h3>
          </div>

          {/* Section 1: Personal Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  FULL NAME
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  DATE OF BIRTH
                </label>
                <input
                  type="date"
                  disabled={!isEditingContracts}
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => {
                    const dob = e.target.value;
                    const calculated = calculateAge(dob);
                    setFormData(p => ({ ...p, dateOfBirth: dob, age: calculated || p.age }));
                  }}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  AGE
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.age || ''}
                  onChange={(e) => setFormData(p => ({ ...p, age: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.phoneNumber || ''}
                  onChange={(e) => setFormData(p => ({ ...p, phoneNumber: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Religion */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  RELIGION
                </label>
                <select
                  disabled={!isEditingContracts}
                  value={formData.religion || 'Muslim'}
                  onChange={(e) => setFormData(p => ({ ...p, religion: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                >
                  <option value="Muslim">Muslim</option>
                  <option value="Christian">Christian</option>
                </select>
              </div>

              {/* Marital Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  MARITAL STATUS
                </label>
                <select
                  disabled={!isEditingContracts}
                  value={formData.maritalStatus || 'single'}
                  onChange={(e) => setFormData(p => ({ ...p, maritalStatus: e.target.value as MaritalStatus }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>

              {/* Number of Children */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  NUMBER OF CHILDREN
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.numberOfChildren || '0'}
                  onChange={(e) => setFormData(p => ({ ...p, numberOfChildren: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Height & Weight */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  HEIGHT & WEIGHT
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Height (e.g. 1.62 M)"
                    disabled={!isEditingContracts}
                    value={formData.height || ''}
                    onChange={(e) => setFormData(p => ({ ...p, height: e.target.value }))}
                    className={`w-full bg-[#070617] border rounded-xl py-3 px-3 text-xs text-white transition outline-none ${
                      isEditingContracts
                        ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                        : 'border-white/10 opacity-80 cursor-not-allowed'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Weight (e.g. 58 KG)"
                    disabled={!isEditingContracts}
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(p => ({ ...p, weight: e.target.value }))}
                    className={`w-full bg-[#070617] border rounded-xl py-3 px-3 text-xs text-white transition outline-none ${
                      isEditingContracts
                        ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                        : 'border-white/10 opacity-80 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Section 2: Travel Credentials */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Globe size={14} className="text-pink-500" />
                <span>2. TRAVEL CREDENTIALS</span>
              </h4>
              {isEditingContracts && (
                <div>
                  <input
                    ref={passportScanInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePassportMRZUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isScanningMRZ}
                    onClick={() => passportScanInputRef.current?.click()}
                    className="px-2.5 py-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {isScanningMRZ ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Scanning MRZ...</span>
                      </>
                    ) : (
                      <>
                        <Scan size={12} />
                        <span>Scan Passport MRZ</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Reference Number */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  REF NUMBER
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.refNumber || ''}
                  onChange={(e) => setFormData(p => ({ ...p, refNumber: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm font-mono text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                  placeholder="e.g. 1, 2, 3..."
                />
              </div>

              {/* Passport Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    PASSPORT NUMBER
                  </label>
                  {formData.passportNumber && (
                    <span className="text-[10px] text-pink-400 font-mono">
                      {getPassportValidityYears(formData.passportNumber, formData.expiryDate) === 10 ? '10-Yr (E-series)' : '5-Yr Validity'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.passportNumber || ''}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData(p => {
                      const updated = { ...p, passportNumber: val };
                      if (p.expiryDate) {
                        const autoIssue = calculateIssueDateFromExpiry(p.expiryDate, val);
                        if (autoIssue) updated.issueDate = autoIssue;
                      }
                      return updated;
                    });
                  }}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm font-mono uppercase text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Place of Birth */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  PLACE OF BIRTH
                </label>
                <input
                  type="text"
                  disabled={!isEditingContracts}
                  value={formData.placeOfBirth || ''}
                  onChange={(e) => setFormData(p => ({ ...p, placeOfBirth: e.target.value }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Labor ID */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  LABOR ID (EF / EW + 7 DIGITS)
                </label>
                <input
                  type="text"
                  placeholder="e.g. EF1201162 or EW1100899"
                  disabled={!isEditingContracts}
                  value={formData.laborId || ''}
                  onChange={(e) => setFormData(p => ({ ...p, laborId: e.target.value.toUpperCase() }))}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm font-mono text-white transition outline-none uppercase placeholder:normal-case placeholder:text-slate-600 ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">

              {/* Issue Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    ISSUE DATE
                  </label>
                  {isEditingContracts && formData.expiryDate && formData.issueDate && (
                    <span className="text-[10px] text-pink-400 font-medium">
                      {getPassportValidityYears(formData.passportNumber, formData.expiryDate) === 10 ? '-10 yrs + 1 day' : '-5 yrs + 1 day'}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  disabled={!isEditingContracts}
                  value={formData.issueDate || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(p => ({
                      ...p,
                      issueDate: val,
                      ...(val && !p.expiryDate ? { expiryDate: calculateExpiryDateFromIssue(val, p.passportNumber) } : {})
                    }));
                  }}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    EXPIRY DATE
                  </label>
                  {isEditingContracts && (
                    <span className="text-[10px] text-slate-500">
                      {getPassportValidityYears(formData.passportNumber, formData.expiryDate) === 10 ? 'Auto: -10 yrs + 1 day' : 'Auto: -5 yrs + 1 day'}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  disabled={!isEditingContracts}
                  value={formData.expiryDate || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(p => ({
                      ...p,
                      expiryDate: val,
                      ...(val ? { issueDate: calculateIssueDateFromExpiry(val, p.passportNumber) } : {})
                    }));
                  }}
                  className={`w-full bg-[#070617] border rounded-xl py-3 px-4 text-sm text-white transition outline-none ${
                    isEditingContracts
                      ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                      : 'border-white/10 opacity-80 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* COC & Preferred Country */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  COC & PREFERRED COUNTRY
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    disabled={!isEditingContracts}
                    value={formData.coc || 'yes'}
                    onChange={(e) => setFormData(p => ({ ...p, coc: e.target.value as 'yes' | 'no' }))}
                    className={`w-full bg-[#070617] border rounded-xl py-3 px-3 text-xs text-white transition outline-none ${
                      isEditingContracts
                        ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                        : 'border-white/10 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <option value="yes">COC: YES</option>
                    <option value="no">COC: NO</option>
                  </select>

                  <select
                    disabled={!isEditingContracts}
                    value={formData.preferredCountry || 'all'}
                    onChange={(e) => setFormData(p => ({ ...p, preferredCountry: e.target.value as PreferredCountry }))}
                    className={`w-full bg-[#070617] border rounded-xl py-3 px-3 text-xs text-white transition outline-none uppercase ${
                      isEditingContracts
                        ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                        : 'border-white/10 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <option value="all">ALL</option>
                    <option value="jordan">JORDAN</option>
                    <option value="kuwait">KUWAIT</option>
                    <option value="saudi">SAUDI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Language Proficiency */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Languages size={14} className="text-pink-500" />
              <span>3. LANGUAGE PROFICIENCY</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* English */}
              <div className="p-4 rounded-2xl bg-[#070617] border border-white/5 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">ENGLISH</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['fluent', 'fair', 'poor'] as LanguageLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={!isEditingContracts}
                      onClick={() => setFormData(p => ({ ...p, englishProficiency: lvl }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition ${
                        formData.englishProficiency === lvl
                          ? 'bg-pink-500 text-white'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      } ${!isEditingContracts ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arabic */}
              <div className="p-4 rounded-2xl bg-[#070617] border border-white/5 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">ARABIC</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['fluent', 'fair', 'poor'] as LanguageLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={!isEditingContracts}
                      onClick={() => setFormData(p => ({ ...p, arabicProficiency: lvl }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition ${
                        formData.arabicProficiency === lvl
                          ? 'bg-pink-500 text-white'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      } ${!isEditingContracts ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Previous Employment History */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Briefcase size={14} className="text-pink-500" />
                <span>4. PREVIOUS EXPERIENCE</span>
              </h4>
              <button
                type="button"
                disabled={!isEditingContracts}
                onClick={() => setFormData(p => ({ ...p, hasPreviousExperience: !p.hasPreviousExperience }))}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition ${
                  formData.hasPreviousExperience
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10'
                } ${!isEditingContracts ? 'cursor-not-allowed' : ''}`}
              >
                {formData.hasPreviousExperience ? 'Experienced (YES)' : 'First Timer (NO)'}
              </button>
            </div>

            {formData.hasPreviousExperience && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(formData.employmentRecords && formData.employmentRecords.length > 0
                  ? formData.employmentRecords
                  : [{ country: '', periodYears: '', position: 'HOUSEMAID' }]
                ).map((rec, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-[#070617] border border-white/5 space-y-3">
                    <span className="text-xs font-bold text-pink-400 block">Record #{idx + 1}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Country</label>
                        <input
                          type="text"
                          disabled={!isEditingContracts}
                          value={rec.country || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(p => {
                              const existing = [...(p.employmentRecords || [])];
                              existing[idx] = { ...existing[idx], country: val, position: 'HOUSEMAID' };
                              return { ...p, employmentRecords: existing };
                            });
                          }}
                          className="w-full bg-[#110f29] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Period (Years)</label>
                        <input
                          type="text"
                          disabled={!isEditingContracts}
                          value={rec.periodYears || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(p => {
                              const existing = [...(p.employmentRecords || [])];
                              existing[idx] = { ...existing[idx], periodYears: val, position: 'HOUSEMAID' };
                              return { ...p, employmentRecords: existing };
                            });
                          }}
                          className="w-full bg-[#110f29] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Competencies */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Award size={14} className="text-pink-500" />
              <span>5. COMPETENCY PROFILE</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { key: 'cooking', label: 'Cooking' },
                { key: 'cleaning', label: 'Cleaning' },
                { key: 'babysitting', label: 'Babysitting' },
                { key: 'washing', label: 'Washing' },
                { key: 'ironing', label: 'Ironing' },
                { key: 'sewing', label: 'Sewing' },
              ].map(({ key, label }) => {
                const isSelected = Boolean(formData.competencies?.[key as keyof CompetencyProfile]);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!isEditingContracts}
                    onClick={() => {
                      setFormData(p => ({
                        ...p,
                        competencies: {
                          cooking: false,
                          cleaning: false,
                          babysitting: false,
                          washing: false,
                          ironing: false,
                          sewing: false,
                          ...(p.competencies || {}),
                          [key]: !p.competencies?.[key as keyof CompetencyProfile]
                        }
                      }));
                    }}
                    className={`py-3 px-3 rounded-xl text-xs font-bold text-center border transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                        : 'bg-[#070617] text-slate-500 border-white/5'
                    } ${!isEditingContracts ? 'cursor-not-allowed opacity-90' : ''}`}
                  >
                    {isSelected && <Check size={12} />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6: Emergency Contact */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <PhoneCall size={14} className="text-pink-500" />
              <span>6. EMERGENCY CONTACT</span>
            </h4>
            <div className="grid grid-cols-1 gap-6">
              {/* Emergency Contact */}
              <div className="p-5 rounded-2xl bg-[#070617] border border-white/5 space-y-3">
                <span className="text-xs font-bold text-pink-400 block uppercase">Emergency Contact</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    disabled={!isEditingContracts}
                    value={formData.emergencyContactName || ''}
                    onChange={(e) => setFormData(p => ({ ...p, emergencyContactName: e.target.value }))}
                    className="w-full bg-[#110f29] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    disabled={!isEditingContracts}
                    value={formData.emergencyContactPhone || ''}
                    onChange={(e) => setFormData(p => ({ ...p, emergencyContactPhone: e.target.value }))}
                    className="w-full bg-[#110f29] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Address / Town"
                    disabled={!isEditingContracts}
                    value={formData.emergencyContactAddress || ''}
                    onChange={(e) => setFormData(p => ({ ...p, emergencyContactAddress: e.target.value }))}
                    className="w-full bg-[#110f29] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ACTION BAR (Edit / Delete / Save) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
            {/* Left: Delete Applicant Button */}
            <div>
              {onDeleteRequest && (
                <button
                  type="button"
                  onClick={() => onDeleteRequest(formData)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold transition"
                >
                  <Trash2 size={15} />
                  <span>Delete Applicant Contract</span>
                </button>
              )}
            </div>

            {/* Right: Edit / Save Controls */}
            <div className="flex items-center gap-3">
              {isEditingContracts ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleCancel('contracts')}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave('contracts')}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Save Changes</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingContracts(true)}
                  className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                >
                  <Edit2 size={15} />
                  <span>Edit Contract Info</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: VISA (formerly Contract) */}
      {activeTab === 'visa' && (
        <div className="bg-[#0e0c24] rounded-3xl p-6 sm:p-8 md:p-10 border border-white/5 shadow-2xl space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-pink-500 tracking-wider uppercase flex items-center gap-2">
                <span>VISA DETAILS & OFFICE ALLOCATION</span>
                {isEditingVisa ? (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Unlock size={10} /> Editing
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Candidate: <span className="text-white font-bold">{formData.name}</span> • Passport: <span className="font-mono text-blue-400">{formData.passportNumber || 'N/A'}</span>
              </p>
            </div>

            {!isEditingVisa && (
              <button
                type="button"
                onClick={() => setIsEditingVisa(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 text-xs font-bold transition"
              >
                <Edit2 size={14} />
                <span>Edit Visa</span>
              </button>
            )}
          </div>

          {/* Visa Date (Autofilled with current date) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                VISA ARRIVED ON
              </label>
              <input
                type="date"
                disabled={!isEditingVisa}
                value={formData.visaArrivedDate || ''}
                onChange={(e) => setFormData(p => ({ ...p, visaArrivedDate: e.target.value }))}
                className={`w-full md:w-1/2 bg-[#070617] border rounded-xl py-3.5 px-4 text-sm text-white transition outline-none ${
                  isEditingVisa
                    ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                    : 'border-white/10 opacity-80 cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-6 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                CHOOSE COUNTRY
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'jordan', name: 'Jordan' },
                  { id: 'kuwait', name: 'Kuwait' },
                  { id: 'saudi', name: 'Saudi Arabia' },
                ].map(c => {
                  const isSelected = visaCountry === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!isEditingVisa}
                      onClick={() => {
                        setVisaCountry(c.id);
                        // Auto-select first office of that country if needed
                        const firstOffice = offices.find(o => o.country.toLowerCase() === c.id);
                        if (firstOffice) {
                          setFormData(p => ({ ...p, office: firstOffice.name, preferredCountry: c.id as PreferredCountry }));
                        }
                      }}
                      className={`py-3 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                        isSelected
                          ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25 border border-pink-500'
                          : 'bg-[#070617] border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      } ${!isEditingVisa ? 'cursor-not-allowed' : ''}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display ONLY the offices corresponding to that chosen country */}
            {visaCountry ? (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  ASSIGNED OFFICE ({visaCountry.toUpperCase()})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {filteredOffices.map((off) => {
                    const isSelected = formData.office?.toLowerCase() === off.name.toLowerCase();
                    return (
                      <button
                        key={off.name}
                        type="button"
                        disabled={!isEditingVisa}
                        onClick={() => setFormData(p => ({ ...p, office: off.name, preferredCountry: visaCountry as PreferredCountry }))}
                        className={`py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                          isSelected
                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25 border border-pink-500'
                            : 'bg-[#070617] border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                        } ${!isEditingVisa ? 'cursor-not-allowed' : ''}`}
                      >
                        {off.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center text-xs text-slate-400">
                Please select a country above to display and assign available agency offices.
              </div>
            )}
          </div>

          {/* Cloudflare Storage & Allocation Status Notice */}
          {formData.office && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Office Allocated: {formData.office}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Cloudflare Retained
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Other country CV drafts deleted. Official assigned CV for <strong className="text-slate-200">{formData.name}</strong> is retained on Cloudflare.
                  </p>
                </div>
              </div>

              {onPreviewCV && (
                <button
                  type="button"
                  onClick={() => onPreviewCV(formData)}
                  className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-pink-500/20"
                >
                  <Eye size={14} />
                  <span>Preview Lady's CV</span>
                </button>
              )}
            </div>
          )}

          {/* BOTTOM ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
            <div>
              {onDeleteRequest && (
                <button
                  type="button"
                  onClick={() => onDeleteRequest(formData)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold transition"
                >
                  <Trash2 size={15} />
                  <span>Delete Record</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isEditingVisa ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleCancel('visa')}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave('visa')}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Save Changes</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  {onPreviewCV && formData.office && (
                    <button
                      type="button"
                      onClick={() => onPreviewCV(formData)}
                      className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-6 rounded-2xl border border-white/10 transition text-xs flex items-center gap-2"
                    >
                      <Eye size={15} />
                      <span>Preview CV</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingVisa(true)}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                  >
                    <Edit2 size={15} />
                    <span>Edit Visa Details</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: FLIGHT TICKET */}
      {activeTab === 'flight' && (
        <div className="bg-[#0e0c24] rounded-3xl p-6 sm:p-8 md:p-10 border border-white/5 shadow-2xl space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-pink-500 tracking-wider uppercase flex items-center gap-2">
                <span>FLIGHT TICKET & DEPARTURE</span>
                {isEditingFlight ? (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Unlock size={10} /> Editing
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Departure scheduling for <span className="text-white font-bold">{formData.name}</span>
              </p>
            </div>

            {!isEditingFlight && (
              <button
                type="button"
                onClick={() => setIsEditingFlight(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 text-xs font-bold transition"
              >
                <Edit2 size={14} />
                <span>Edit Flight</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Airline */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                AIRLINE
              </label>
              <input
                type="text"
                disabled={!isEditingFlight}
                placeholder="e.g. Ethiopian Airlines"
                value={formData.airline || ''}
                onChange={(e) => setFormData(p => ({ ...p, airline: e.target.value }))}
                className={`w-full bg-[#070617] border rounded-xl py-3.5 px-4 text-sm text-white transition outline-none ${
                  isEditingFlight
                    ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                    : 'border-white/10 opacity-80 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Departure Date */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                DEPARTURE DATE
              </label>
              <input
                type="date"
                disabled={!isEditingFlight}
                value={formData.departureDate || ''}
                onChange={(e) => setFormData(p => ({ ...p, departureDate: e.target.value }))}
                className={`w-full bg-[#070617] border rounded-xl py-3.5 px-4 text-sm text-white transition outline-none ${
                  isEditingFlight
                    ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                    : 'border-white/10 opacity-80 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Ticket Price */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                TICKET PRICE
              </label>
              <input
                type="text"
                disabled={!isEditingFlight}
                placeholder="e.g. $750 USD"
                value={formData.ticketPrice || ''}
                onChange={(e) => setFormData(p => ({ ...p, ticketPrice: e.target.value }))}
                className={`w-full bg-[#070617] border rounded-xl py-3.5 px-4 text-sm text-white transition outline-none ${
                  isEditingFlight
                    ? 'border-pink-500/50 focus:ring-2 focus:ring-pink-500'
                    : 'border-white/10 opacity-80 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Transit Toggle */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                TRANSIT
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!isEditingFlight}
                  onClick={() => setFormData(p => ({ ...p, transit: 'Yes' }))}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold transition ${
                    formData.transit === 'Yes'
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25 border border-pink-500'
                      : 'bg-[#070617] border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                  } ${!isEditingFlight ? 'cursor-not-allowed' : ''}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  disabled={!isEditingFlight}
                  onClick={() => setFormData(p => ({ ...p, transit: 'No' }))}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold transition ${
                    formData.transit === 'No' || !formData.transit
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25 border border-pink-500'
                      : 'bg-[#070617] border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                  } ${!isEditingFlight ? 'cursor-not-allowed' : ''}`}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          {/* BOTTOM ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
            <div>
              {onDeleteRequest && (
                <button
                  type="button"
                  onClick={() => onDeleteRequest(formData)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold transition"
                >
                  <Trash2 size={15} />
                  <span>Delete Record</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isEditingFlight ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleCancel('flight')}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave('flight')}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Save Changes</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingFlight(true)}
                  className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-pink-500/25 transition text-xs flex items-center gap-2"
                >
                  <Edit2 size={15} />
                  <span>Edit Flight Details</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
