/**
 * Utility functions for passport date calculations.
 *
 * Rules:
 * - Passports starting with EP, EQ (or standard 5-yr): Validity = 5 years - 1 day
 *   Issue Date = Expiry Date - 5 years + 1 day
 *   Expiry Date = Issue Date + 5 years - 1 day
 *
 * - E-formatted passports (e.g. E1234567):
 *   Instead of unconditionally subtracting 10y, subtract 5 years (+1 day).
 *   If the calculated issue date is in the future compared to the current date,
 *   subtract 5 more years (-10 years + 1 day total).
 */

export const isEFormattedPassport = (passportNumber?: string): boolean => {
  if (!passportNumber) return false;
  const clean = passportNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^E\d/.test(clean) || (clean.startsWith('E') && !clean.startsWith('EP') && !clean.startsWith('EQ') && !clean.startsWith('ER'));
};

export const getPassportValidityYears = (passportNumber?: string, expiryDateStr?: string): number => {
  if (!passportNumber) return 5;
  const isE = isEFormattedPassport(passportNumber);
  if (!isE) return 5;

  if (expiryDateStr) {
    const parts = expiryDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const now = new Date();
        const currentY = now.getFullYear();
        const currentM = String(now.getMonth() + 1).padStart(2, '0');
        const currentD = String(now.getDate()).padStart(2, '0');
        const currentDateStr = `${currentY}-${currentM}-${currentD}`;

        const target5y = new Date(Date.UTC(year - 5, month - 1, day + 1));
        const y5 = target5y.getUTCFullYear();
        const m5 = String(target5y.getUTCMonth() + 1).padStart(2, '0');
        const d5 = String(target5y.getUTCDate()).padStart(2, '0');
        const issueDate5y = `${y5}-${m5}-${d5}`;

        if (issueDate5y > currentDateStr) {
          return 10;
        }
      }
    }
  }

  return 5;
};

export const calculateIssueDateFromExpiry = (expiryDateStr: string, passportNumber?: string): string => {
  if (!expiryDateStr) return '';
  const parts = expiryDateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

  const isE = isEFormattedPassport(passportNumber);

  // Current date string YYYY-MM-DD
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = String(now.getMonth() + 1).padStart(2, '0');
  const currentD = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${currentY}-${currentM}-${currentD}`;

  // 1. Subtract 5 years + 1 day
  const target5y = new Date(Date.UTC(year - 5, month - 1, day + 1));
  const y5 = target5y.getUTCFullYear();
  const m5 = String(target5y.getUTCMonth() + 1).padStart(2, '0');
  const d5 = String(target5y.getUTCDate()).padStart(2, '0');
  const issueDate5y = `${y5}-${m5}-${d5}`;

  // In E-formatted passports: instead of subtracting 10y, subtract 5,
  // but after subtracting 5 and the passport issue date is in future than current date, subtract 5 more
  if (isE && issueDate5y > currentDateStr) {
    const target10y = new Date(Date.UTC(year - 10, month - 1, day + 1));
    const y10 = target10y.getUTCFullYear();
    const m10 = String(target10y.getUTCMonth() + 1).padStart(2, '0');
    const d10 = String(target10y.getUTCDate()).padStart(2, '0');
    return `${y10}-${m10}-${d10}`;
  }

  return issueDate5y;
};

export const calculateExpiryDateFromIssue = (issueDateStr: string, passportNumber?: string, customYears?: number): string => {
  if (!issueDateStr) return '';
  const parts = issueDateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

  const years = customYears || getPassportValidityYears(passportNumber);
  const target = new Date(Date.UTC(year + years, month - 1, day - 1));
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
