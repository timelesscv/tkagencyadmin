import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  Download,
  Printer,
  Loader2,
  FileCheck2,
  Layers,
  ExternalLink,
  FileText,
  UserCheck
} from 'lucide-react';
import { Contract, Office, OfficeRefCounter } from '../types';
import { offices } from '../constants';
import {
  getOfficesForContract,
  generateCVPdfBlob,
  downloadSingleOfficeCVPdf,
  downloadCandidateCVsForCountry,
  getOfficePdfSlug,
  getOfficePdfFileName
} from '../utils/pdfgenerator';
import { fetchOfficeCountersFromSupabase } from '../services/dataService';
import { toast } from 'sonner';

interface CVPreviewModalProps {
  contract: Contract;
  officeCounters?: OfficeRefCounter[];
  onClose: () => void;
}

export const CVPreviewModal: React.FC<CVPreviewModalProps> = ({ contract, officeCounters, onClose }) => {
  // If candidate has VISA DETAILS & OFFICE ALLOCATION completed, only preview the assigned office CV
  const isAllocated = Boolean(contract.office && (contract.visaArrivedDate || contract.status === 'Pending' || contract.status === 'Completed'));

  const officesList = useMemo(() => {
    if (isAllocated && contract.office) {
      const matched = offices.find(o => o.name.toLowerCase() === contract.office!.toLowerCase());
      if (matched) return [matched];
      return [{
        id: 'allocated',
        name: contract.office,
        country: contract.preferredCountry || 'Kuwait',
        color: 'border-pink-500'
      }];
    }
    return getOfficesForContract(contract);
  }, [contract, isAllocated]);
  
  // Choose initial office
  const initialOffice = officesList.find(
    o => contract.office && o.name.toLowerCase() === contract.office.toLowerCase()
  ) || officesList[0] || { id: '0', name: 'Injaz', country: 'Jordan', color: 'border-red-500' };

  const [selectedOffice, setSelectedOffice] = useState<Office>(initialOffice);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [liveCounters, setLiveCounters] = useState<OfficeRefCounter[]>(officeCounters || []);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync latest office counters from Supabase when modal opens so reference numbers are always live across devices
  useEffect(() => {
    let isMounted = true;
    fetchOfficeCountersFromSupabase().then((latest) => {
      if (latest && latest.length > 0 && isMounted) {
        setLiveCounters(latest);
      }
    });

    const handleCountersUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<OfficeRefCounter[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail) && isMounted) {
        setLiveCounters(customEvent.detail);
      }
    };
    window.addEventListener('tk_office_counters_updated', handleCountersUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('tk_office_counters_updated', handleCountersUpdated);
    };
  }, []);

  // Generate PDF Blob whenever selected office or counters change
  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    const renderPdf = async () => {
      setIsLoading(true);
      try {
        const result = await generateCVPdfBlob(contract, selectedOffice, liveCounters);
        if (isMounted) {
          createdUrl = result.url;
          setPdfUrl(result.url);
          setPdfFileName(result.fileName);
        }
      } catch (err) {
        console.error('Failed to generate CV preview:', err);
        if (isMounted) {
          toast.error(`Could not generate CV preview for ${selectedOffice.name}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [contract, selectedOffice, liveCounters]);

  // Download single office PDF
  const handleDownloadSingle = async () => {
    try {
      toast.loading(`Downloading ${pdfFileName}...`, { id: 'single-download' });
      await downloadSingleOfficeCVPdf(contract, selectedOffice, liveCounters);
      toast.success(`Downloaded ${pdfFileName}`, { id: 'single-download' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF', { id: 'single-download' });
    }
  };

  // Download all corresponding offices PDFs
  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      const toastId = toast.loading(`Generating & downloading ${officesList.length} office PDFs...`);
      
      await downloadCandidateCVsForCountry(contract, (current, total, fileName) => {
        setDownloadProgress(`Downloading (${current}/${total}): ${fileName}`);
        toast.loading(`Downloading (${current}/${total}): ${fileName}`, { id: toastId });
      }, liveCounters);

      toast.success(`All ${officesList.length} office PDF CVs downloaded successfully!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download all PDFs');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress('');
    }
  };

  // Print PDF
  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else if (pdfUrl) {
      const printWin = window.open(pdfUrl, '_blank');
      if (printWin) {
        printWin.focus();
        printWin.print();
      }
    }
  };

  // Open PDF in a brand-new browser tab
  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6">
      <div className="bg-[#12122B] w-full max-w-6xl h-[94vh] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button
              onClick={onClose}
              type="button"
              className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 text-pink-400 border border-white/10 transition flex items-center justify-center cursor-pointer shrink-0"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
              <FileCheck2 size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight truncate">
                  Official CV Preview
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-400 border border-pink-500/30 shrink-0">
                  PDF Doc
                </span>
                {contract.facePhoto && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <UserCheck size={11} /> Photo Loaded
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {contract.name} • Office: <strong className="text-slate-200">{getOfficePdfSlug(selectedOffice.name)}</strong> ({pdfFileName || getOfficePdfFileName(contract, selectedOffice.name, liveCounters)})
              </p>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
            {/* Open in New Window */}
            {pdfUrl && (
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                title="Open PDF in a new tab"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}

            {/* Print */}
            <button
              onClick={handlePrint}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
              title="Print Active PDF"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Download Current Office PDF */}
            <button
              onClick={handleDownloadSingle}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 shadow-sm cursor-pointer"
              title={`Download ${pdfFileName}`}
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>

            {/* Download All Offices PDFs */}
            {officesList.length > 1 && (
              <button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-pink-500/20 disabled:opacity-50 cursor-pointer"
                title="Download all partner offices PDFs sequentially"
              >
                {isDownloadingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Layers size={14} />
                )}
                <span>
                  {isDownloadingAll ? 'Downloading...' : `Download All (${officesList.length})`}
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition ml-1 cursor-pointer"
              title="Close Preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Office Selection Tabs (if candidate covers multiple partner offices) */}
        {officesList.length > 1 && (
          <div className="px-4 py-2.5 bg-[#0a0a1a] border-b border-white/5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1.5">
              <Layers size={13} className="text-pink-500" />
              Offices ({officesList.length}):
            </span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              {officesList.map((off) => {
                const slug = getOfficePdfSlug(off.name);
                const isSelected = selectedOffice.name.toLowerCase() === off.name.toLowerCase();
                return (
                  <button
                    key={off.id || off.name}
                    onClick={() => setSelectedOffice(off)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25 ring-1 ring-pink-400'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span>{slug}</span>
                    <span className="text-[10px] opacity-70">({off.country})</span>
                  </button>
                );
              })}
            </div>
            {downloadProgress && (
              <span className="ml-auto text-xs font-bold text-pink-400 animate-pulse whitespace-nowrap">
                {downloadProgress}
              </span>
            )}
          </div>
        )}

        {/* Allocation & Storage Status Banner */}
        {isAllocated ? (
          <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>Visa & Office Allocated:</strong> {contract.office} ({contract.preferredCountry || 'Partner Office'})
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                • Non-assigned CVs deleted from Cloudflare storage. Official CV retained.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              Cloudflare Retained
            </span>
          </div>
        ) : (
          <div className="px-5 py-2 bg-pink-500/5 border-b border-pink-500/15 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-pink-400" />
              <span>
                <strong>Available Candidate:</strong> {officesList.length} CVs generated & stored on Cloudflare.
              </span>
              <span className="text-slate-500 hidden md:inline">
                (When Visa Details & Office Allocation is filled, remaining CVs are automatically deleted).
              </span>
            </div>
            <span className="text-[10px] text-pink-400/80 uppercase font-mono">
              Draft Storage
            </span>
          </div>
        )}

        {/* CV Viewer Container */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-auto relative flex flex-col items-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center my-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 animate-pulse">
                  <FileCheck2 size={32} />
                </div>
                <Loader2 size={24} className="animate-spin text-pink-500 absolute -top-1 -right-1" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Rendering PDF Document...
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Generating official manpower CV for {getOfficePdfSlug(selectedOffice.name)}
                </p>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl relative flex flex-col">
              <iframe
                ref={iframeRef}
                key={pdfUrl}
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                title={`CV Preview - ${selectedOffice.name}`}
                className="w-full flex-1 border-0 bg-slate-900"
              />
              <div className="p-2 bg-[#09081f] border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span>Official PDF Document view for <strong>{getOfficePdfSlug(selectedOffice.name)}</strong>.</span>
                <button
                  onClick={handleOpenInNewTab}
                  className="text-pink-400 hover:text-pink-300 font-bold underline flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink size={12} /> Open in New Tab
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 text-slate-400 text-sm my-auto">
              Failed to load PDF preview. Please try downloading directly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
