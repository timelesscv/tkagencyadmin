import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  User, 
  Download, 
  Eye, 
  Star, 
  CheckCircle2, 
  Clock, 
  Plane, 
  ChevronLeft, 
  ChevronRight,
  FileSignature,
  Layers,
  ArrowUpDown,
  ArrowLeft,
  Trash2,
  X
} from 'lucide-react';
import { Contract, ContractsSubTab, OfficeRefCounter } from '../types';
import { offices, formatDate } from '../constants';
import { NewContractForm } from './NewContractForm';
import { downloadCandidateCV } from '../utils/cvGenerator';

interface ContractsTabsViewProps {
  contracts: Contract[];
  activeSubTab: ContractsSubTab;
  initialCountryFilter?: string;
  initialSearchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  officeCounters?: OfficeRefCounter[];
  onIncrementOfficeCounter?: (officeName: string) => void;
  onSubTabChange: (tab: ContractsSubTab) => void;
  onBackToHome?: () => void;
  onOpenContract: (contract: Contract) => void;
  onPreviewCV: (contract: Contract) => void;
  onSubmitNewContract: (newContract: Omit<Contract, 'id'>, shouldDownloadCV: boolean) => Promise<Contract | null>;
  onDeleteContract?: (contract: Contract) => void;
}

const ApplicantAvatar: React.FC<{ photo?: string; name?: string; sizeClass?: string; iconSize?: number }> = ({
  photo,
  name,
  sizeClass = 'w-11 h-11',
  iconSize = 18
}) => {
  const [loadError, setLoadError] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  useEffect(() => {
    setLoadError(false);
    setUseProxy(false);
  }, [photo]);

  const imgSrc = useProxy && photo && (photo.startsWith('http://') || photo.startsWith('https://'))
    ? `/api/storage/proxy?url=${encodeURIComponent(photo)}`
    : photo;

  return (
    <div className={`${sizeClass} rounded-full bg-[#181630] border border-white/10 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden shadow-inner`}>
      {imgSrc && !loadError ? (
        <img
          src={imgSrc}
          alt={name || 'Applicant'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
            if (!useProxy && photo && (photo.startsWith('http://') || photo.startsWith('https://'))) {
              setUseProxy(true);
            } else {
              setLoadError(true);
            }
          }}
        />
      ) : (
        <User size={iconSize} className="text-slate-400" />
      )}
    </div>
  );
};

export const ContractsTabsView: React.FC<ContractsTabsViewProps> = ({
  contracts,
  activeSubTab,
  initialCountryFilter = 'all',
  initialSearchTerm = '',
  onSearchTermChange,
  officeCounters,
  onIncrementOfficeCounter,
  onSubTabChange,
  onBackToHome,
  onOpenContract,
  onPreviewCV,
  onSubmitNewContract,
  onDeleteContract,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState(initialCountryFilter || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
    if (onSearchTermChange) onSearchTermChange(val);
  };

  useEffect(() => {
    if (initialCountryFilter) {
      setSelectedCountry(initialCountryFilter);
    }
  }, [initialCountryFilter]);

  // Categorization counts
  const availableContracts = useMemo(() => {
    return contracts.filter(c => !c.visaArrivedDate && !c.departureDate);
  }, [contracts]);

  const pendingContracts = useMemo(() => {
    return contracts.filter(c => Boolean(c.visaArrivedDate) && !c.departureDate);
  }, [contracts]);

  const completedContracts = useMemo(() => {
    return contracts.filter(c => Boolean(c.departureDate));
  }, [contracts]);

  const specialCaseContracts = useMemo(() => {
    return contracts.filter(c => Boolean(c.isSpecialCase));
  }, [contracts]);

  // Filtered list based on active tab
  const currentList = useMemo(() => {
    let baseList: Contract[] = [];
    if (activeSubTab === 'available') baseList = availableContracts;
    else if (activeSubTab === 'pending') baseList = pendingContracts;
    else if (activeSubTab === 'completed') baseList = completedContracts;
    else if (activeSubTab === 'special-cases') baseList = specialCaseContracts;
    else baseList = contracts;

    return baseList.filter(item => {
      const matchesSearch = 
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.laborId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.passportNumber && item.passportNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.refNumber && item.refNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.phoneNumber && item.phoneNumber.includes(searchTerm));

      const matchesOffice = selectedOffice === 'all' || item.office === selectedOffice;
      const matchesCountry = selectedCountry === 'all' || 
        (item.preferredCountry && item.preferredCountry.toLowerCase() === selectedCountry.toLowerCase()) ||
        (offices.find(o => o.name === item.office)?.country.toLowerCase() === selectedCountry.toLowerCase());

      return matchesSearch && matchesOffice && matchesCountry;
    });
  }, [
    activeSubTab, 
    contracts, 
    availableContracts, 
    pendingContracts, 
    completedContracts, 
    specialCaseContracts, 
    searchTerm, 
    selectedOffice, 
    selectedCountry
  ]);

  // Check if matches exist across other tabs
  const matchesInOtherTabs = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    return contracts.filter(c => {
      const matchesSearch =
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.laborId && c.laborId.toLowerCase().includes(q)) ||
        (c.passportNumber && c.passportNumber.toLowerCase().includes(q)) ||
        (c.refNumber && c.refNumber.toLowerCase().includes(q)) ||
        (c.phoneNumber && c.phoneNumber.includes(q));

      if (!matchesSearch) return false;

      const cSubTab: ContractsSubTab = c.isSpecialCase
        ? 'special-cases'
        : c.departureDate
        ? 'completed'
        : c.visaArrivedDate
        ? 'pending'
        : 'available';

      return cSubTab !== activeSubTab;
    });
  }, [contracts, searchTerm, activeSubTab]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(currentList.length / itemsPerPage));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentList.slice(start, start + itemsPerPage);
  }, [currentList, currentPage, itemsPerPage]);

  const handleTabChange = (tab: ContractsSubTab) => {
    onSubTabChange(tab);
    setCurrentPage(1);
  };

  const getSubTabTitle = () => {
    switch (activeSubTab) {
      case 'new-contract':
        return 'Register New Applicant Contract';
      case 'available':
        return 'Available Applicants (Visa Not Issued)';
      case 'pending':
        return 'Pending Deployment (Visa Issued)';
      case 'completed':
        return 'Completed Contracts (Ticket Booked)';
      case 'special-cases':
        return 'Special Cases (Priority Flagged)';
      default:
        return 'Contracts Directory';
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* RENDER NEW CONTRACT FORM OR TABLES */}
      {activeSubTab === 'new-contract' ? (
        <NewContractForm
          onSubmitContract={onSubmitNewContract}
          onCancel={() => handleTabChange('available')}
          officeCounters={officeCounters}
          onIncrementOfficeCounter={onIncrementOfficeCounter}
        />
      ) : (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* Search Input and optional Back Button */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="p-2.5 rounded-2xl bg-[#110f29] border border-white/10 text-slate-300 hover:text-white hover:border-pink-500/40 active:scale-95 transition shrink-0 flex items-center justify-center"
                  title="Back to Home Dashboard"
                >
                  <ArrowLeft size={16} className="text-pink-400" />
                </button>
              )}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, Labor ID, passport, phone..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full bg-[#110f29] border border-white/10 rounded-2xl py-3 pl-11 pr-10 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Office & Country Filters */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3">
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-[#110f29] border border-white/10 rounded-2xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold text-slate-300 focus:ring-2 focus:ring-pink-500 outline-none uppercase"
              >
                <option value="all">All Countries</option>
                <option value="jordan">Jordan</option>
                <option value="kuwait">Kuwait</option>
                <option value="saudi">Saudi Arabia</option>
              </select>

              <select
                value={selectedOffice}
                onChange={(e) => {
                  setSelectedOffice(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-[#110f29] border border-white/10 rounded-2xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold text-slate-300 focus:ring-2 focus:ring-pink-500 outline-none truncate"
              >
                <option value="all">All Offices</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info pill about current status category */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing <strong className="text-white">{currentList.length}</strong> applicants in{' '}
              <strong className="text-pink-400 uppercase">{activeSubTab.replace('-', ' ')}</strong>
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              {activeSubTab === 'available' && '• Candidates without issued visa'}
              {activeSubTab === 'pending' && '• Visa issued, flight booking pending'}
              {activeSubTab === 'completed' && '• Flight ticket confirmed & scheduled'}
              {activeSubTab === 'special-cases' && '• Flagged for special attention'}
            </span>
          </div>

          {/* Table / Cards Container */}
          <div className="bg-[#0e0c24] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
            {/* MOBILE CARDS VIEW (VISIBLE ON MOBILE ONLY) */}
            <div className="md:hidden divide-y divide-white/5">
              {paginatedList.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  {matchesInOtherTabs.length > 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-xs mx-auto">
                      <div className="w-10 h-10 bg-pink-500/10 text-pink-400 rounded-2xl border border-pink-500/20 flex items-center justify-center">
                        <Search size={18} />
                      </div>
                      <p className="text-white font-bold text-sm">
                        No matches in <span className="text-pink-400 uppercase">{activeSubTab.replace('-', ' ')}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Found <strong className="text-pink-400">{matchesInOtherTabs.length}</strong> in other sections:
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                        {matchesInOtherTabs.slice(0, 3).map(other => {
                          const otherSubTab: ContractsSubTab = other.isSpecialCase
                            ? 'special-cases'
                            : other.departureDate
                            ? 'completed'
                            : other.visaArrivedDate
                            ? 'pending'
                            : 'available';
                          return (
                            <button
                              key={other.id}
                              onClick={() => {
                                handleTabChange(otherSubTab);
                                onOpenContract(other);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white font-mono flex items-center gap-1"
                            >
                              <span>{other.name.split(' ')[0]}</span>
                              <span className="text-pink-400">({otherSubTab})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">No applicants found</p>
                      <p className="text-xs text-slate-500">
                        Try adjusting your filters or search keywords
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                paginatedList.map((contract) => {
                  const isAvailable = !contract.visaArrivedDate && !contract.departureDate;
                  const showOffice = !isAvailable && Boolean(contract.office);

                  return (
                    <div
                      key={contract.id}
                      className="p-4 space-y-3 hover:bg-white/[0.02] transition"
                    >
                      <div 
                        className="flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => onOpenContract(contract)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ApplicantAvatar
                            photo={contract.facePhoto}
                            name={contract.name}
                            sizeClass="w-11 h-11"
                            iconSize={18}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-sm text-white truncate">
                                {contract.name}
                              </h4>
                              {contract.isSpecialCase && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase flex items-center gap-0.5">
                                  <Star size={9} className="fill-orange-400" /> Special
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                              <span className="text-[#4e8cff] font-bold">{contract.laborId || 'No ID'}</span>
                              {contract.passportNumber && (
                                <>
                                  <span>•</span>
                                  <span>{contract.passportNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {showOffice && (
                          <span className="text-[10px] font-bold text-slate-300 bg-[#191f36] px-2 py-0.5 rounded-md border border-white/5 shrink-0">
                            {contract.office}
                          </span>
                        )}
                      </div>

                      {/* Card Bottom Meta & Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-xs">
                        <span className="text-[11px] font-mono text-slate-400">
                          {contract.departureDate ? `Flight: ${formatDate(contract.departureDate)}` : contract.date ? formatDate(contract.date) : '2026-03-25'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPreviewCV(contract)}
                            className="p-1.5 px-2.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-xs font-bold transition flex items-center gap-1"
                            title="Preview CV"
                          >
                            <Eye size={13} />
                            <span>CV</span>
                          </button>

                          <button
                            onClick={() => onOpenContract(contract)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white uppercase tracking-wider transition"
                          >
                            OPEN
                          </button>

                          {(activeSubTab === 'available' || isAvailable) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteContract?.(contract);
                              }}
                              className="border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 p-1.5 rounded-lg text-xs font-bold transition"
                              title="Delete candidate"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      APPLICANT
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      LABOR ID
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      OFFICE
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      DATE
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        {matchesInOtherTabs.length > 0 ? (
                          <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                            <div className="w-12 h-12 bg-pink-500/10 text-pink-400 rounded-2xl border border-pink-500/20 flex items-center justify-center">
                              <Search size={22} />
                            </div>
                            <p className="text-white font-bold text-sm">
                              No matching applicants in <span className="text-pink-400 uppercase font-extrabold">{activeSubTab.replace('-', ' ')}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              Found <strong className="text-pink-400">{matchesInOtherTabs.length}</strong> applicant(s) matching &quot;{searchTerm}&quot; in other sections:
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                              {matchesInOtherTabs.slice(0, 4).map(other => {
                                const otherSubTab: ContractsSubTab = other.isSpecialCase
                                  ? 'special-cases'
                                  : other.departureDate
                                  ? 'completed'
                                  : other.visaArrivedDate
                                  ? 'pending'
                                  : 'available';
                                return (
                                  <button
                                    key={other.id}
                                    type="button"
                                    onClick={() => handleTabChange(otherSubTab)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-pink-500/20 text-xs font-semibold text-slate-200 hover:text-white border border-white/10 hover:border-pink-500/30 transition"
                                  >
                                    <span>{other.name}</span>
                                    <span className="text-[10px] text-pink-400 uppercase font-mono">({other.laborId})</span>
                                    <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">→ {otherSubTab}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSearchChange('')}
                              className="text-xs text-slate-400 hover:text-white underline pt-2"
                            >
                              Clear search filter
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center text-slate-600">
                              <Search size={26} />
                            </div>
                            <p className="text-slate-300 font-bold text-sm">No applicants found in this view</p>
                            <p className="text-xs text-slate-500">Try changing your search terms, labor ID, or add a new candidate</p>
                            <button
                              onClick={() => handleTabChange('new-contract')}
                              className="mt-2 px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-pink-600 transition"
                            >
                              + Add New Contract
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((contract) => {
                      // Office is left empty if a lady is available (not issued visa yet or no office assigned)
                      const isAvailable = !contract.visaArrivedDate && !contract.departureDate;
                      const showOffice = !isAvailable && Boolean(contract.office);

                      return (
                        <tr
                          key={contract.id}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition"
                        >
                          {/* APPLICANT */}
                          <td className="py-4 px-6">
                            <div
                              className="flex items-center gap-3.5 cursor-pointer group"
                              onClick={() => onOpenContract(contract)}
                            >
                              <ApplicantAvatar
                                photo={contract.facePhoto}
                                name={contract.name}
                                sizeClass="w-9 h-9"
                                iconSize={16}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white group-hover:text-pink-400 transition">
                                    {contract.name}
                                  </span>
                                  {contract.isSpecialCase && (
                                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase flex items-center gap-0.5">
                                      <Star size={9} className="fill-orange-400" /> Special
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block font-mono">
                                  {contract.passportNumber || contract.refNumber || ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* LABOR ID */}
                          <td className="py-4 px-6">
                            <span className="text-sm text-[#4e8cff] font-medium tracking-tight">
                              {contract.laborId || 'N/A'}
                            </span>
                          </td>

                          {/* OFFICE (Left empty if a lady is available) */}
                          <td className="py-4 px-6">
                            {showOffice ? (
                              <span className="text-xs font-medium text-slate-300 bg-[#191f36] px-3 py-1 rounded-md border border-white/5 inline-block">
                                {contract.office}
                              </span>
                            ) : null}
                          </td>

                          {/* DATE */}
                          <td className="py-4 px-6">
                            <span className="text-xs font-mono text-slate-400">
                              {contract.departureDate || contract.date || '2026-03-25'}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onOpenContract(contract)}
                                className="border border-white/10 hover:border-white/30 hover:bg-white/5 px-4 py-1.5 rounded-lg text-xs font-bold text-white uppercase tracking-wider transition"
                              >
                                OPEN
                              </button>
                              {/* Delete trashcan button in available contracts actions section */}
                              {(activeSubTab === 'available' || isAvailable) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteContract?.(contract);
                                  }}
                                  className="border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 p-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center"
                                  title="Delete candidate data"
                                  aria-label="Delete candidate"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-white/10 text-xs font-bold uppercase disabled:opacity-30 hover:bg-white/5 transition"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-white/10 text-xs font-bold uppercase disabled:opacity-30 hover:bg-white/5 transition"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
