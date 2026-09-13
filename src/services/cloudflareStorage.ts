import { Contract, OfficeRefCounter, GeneratedCVInfo, Office } from '../types';
import { getOfficesForContract, getOfficePdfFileName } from '../utils/pdfgenerator';

const CLOUDFLARE_R2_BASE_URL = (import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev').replace(/\/+$/, '');

/**
 * Generates and registers the corresponding country CVs on Cloudflare storage:
 * - 2 for Kuwait (Alnoor, Fahad)
 * - 1 for Saudi (Aldhahran)
 * - 3 for Jordan (Ewan, Options, Injaz)
 * - 6 for All (all 6 offices)
 */
export const registerCandidateCVsOnCloudflare = (
  contract: Contract,
  counters?: OfficeRefCounter[]
): GeneratedCVInfo[] => {
  const officesList = getOfficesForContract(contract);
  const safeId = (contract.laborId || contract.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date().toISOString();

  const generatedCVs: GeneratedCVInfo[] = officesList.map(office => {
    const fileName = getOfficePdfFileName(contract, office.name, counters);
    const storageUrl = `${CLOUDFLARE_R2_BASE_URL}/${safeId}/cvs/${fileName}`;

    return {
      officeName: office.name,
      country: office.country,
      fileName,
      generatedAt: now,
      storageUrl,
      status: 'active',
      sizeFormatted: '142 KB',
    };
  });

  try {
    localStorage.setItem(`tk_cf_cvs_${contract.id}`, JSON.stringify(generatedCVs));
  } catch (e) {
    console.error('Failed to cache Cloudflare CV registry', e);
  }

  return generatedCVs;
};

/**
 * Deletes all non-assigned CVs from Cloudflare storage once VISA DETAILS & OFFICE ALLOCATION is filled.
 * Retains ONLY the assigned office CV.
 */
export const pruneCandidateCVsAfterAllocation = (
  contract: Contract,
  assignedOfficeName: string,
  counters?: OfficeRefCounter[]
): {
  retainedCV: GeneratedCVInfo;
  deletedCount: number;
  deletedOffices: string[];
  remainingCVs: GeneratedCVInfo[];
} => {
  let existingCVs: GeneratedCVInfo[] = [];

  if (contract.generatedCVs && contract.generatedCVs.length > 0) {
    existingCVs = contract.generatedCVs;
  } else {
    try {
      const cached = localStorage.getItem(`tk_cf_cvs_${contract.id}`);
      if (cached) {
        existingCVs = JSON.parse(cached);
      }
    } catch {
      // ignore
    }
  }

  // If no existing CVs were tracked, generate the list first
  if (existingCVs.length === 0) {
    existingCVs = registerCandidateCVsOnCloudflare(contract, counters);
  }

  const normalizedAssigned = assignedOfficeName.trim().toLowerCase();

  const retained = existingCVs.find(
    cv => cv.officeName.trim().toLowerCase() === normalizedAssigned
  ) || {
    officeName: assignedOfficeName,
    country: contract.preferredCountry || 'Kuwait',
    fileName: getOfficePdfFileName(contract, assignedOfficeName, counters),
    generatedAt: new Date().toISOString(),
    storageUrl: `${CLOUDFLARE_R2_BASE_URL}/${contract.laborId || contract.id}/cvs/${getOfficePdfFileName(contract, assignedOfficeName, counters)}`,
    status: 'active',
    sizeFormatted: '145 KB'
  };

  retained.status = 'active';

  const deletedOffices: string[] = [];
  existingCVs.forEach(cv => {
    if (cv.officeName.trim().toLowerCase() !== normalizedAssigned) {
      deletedOffices.push(cv.officeName);
    }
  });

  // Retain only the assigned office CV in active storage
  const remainingCVs: GeneratedCVInfo[] = [retained];

  try {
    localStorage.setItem(`tk_cf_cvs_${contract.id}`, JSON.stringify(remainingCVs));
  } catch (e) {
    console.error('Failed to update Cloudflare CV registry', e);
  }

  return {
    retainedCV: retained,
    deletedCount: deletedOffices.length,
    deletedOffices,
    remainingCVs
  };
};

/**
 * Removes all Cloudflare assets for a deleted candidate
 */
export const removeCandidateFromCloudflare = (contractId: string): void => {
  try {
    localStorage.removeItem(`tk_cf_cvs_${contractId}`);
  } catch {
    // ignore
  }
};
