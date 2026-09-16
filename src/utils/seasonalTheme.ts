export type SeasonalTheme = 'auto' | 'standard' | 'christmas' | 'new_year' | 'enkutatash' | 'fasika';

export interface SeasonalEventInfo {
  theme: SeasonalTheme;
  title: string;
  badge: string;
  description: string;
}

// Timeline configuration based on agency seasonal schedule
// Rule: Active 5 days before, 2 days after the holiday date
interface HolidayDate {
  month: number; // 0-indexed: 0 = Jan, 8 = Sep, 11 = Dec
  day: number;
}

interface YearHolidays {
  gregorianNewYear: HolidayDate;   // Jan 1
  gregorianChristmas: HolidayDate; // Dec 25
  fasika: HolidayDate;             // Orthodox Easter
  enkutatash: HolidayDate;         // Sep 11 / Sep 12
  ethiopianChristmas: HolidayDate; // Jan 7 / Jan 8
}

// Master calendar lookup matching the provided schedule
export const HOLIDAY_CALENDAR: Record<number, YearHolidays> = {
  2025: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 20 },
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2026: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 12 },
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2027: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 4, day: 2 }, // May 2
    enkutatash: { month: 8, day: 12 }, // Sep 12
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2028: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 16 }, // Apr 16
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 8 }, // Jan 8 (Leap year)
  },
  2029: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 8 }, // Apr 8
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2030: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 28 }, // Apr 28
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2031: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 13 }, // Apr 13
    enkutatash: { month: 8, day: 12 }, // Sep 12
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2032: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 4, day: 2 }, // May 2
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 8 }, // Jan 8
  },
  2033: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 24 }, // Apr 24
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2034: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 9 }, // Apr 9
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  },
  2035: {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 29 }, // Apr 29
    enkutatash: { month: 8, day: 12 }, // Sep 12
    ethiopianChristmas: { month: 0, day: 7 },
  },
};

/**
 * Check if a date falls within a window: [holiday - 5 days, holiday + 2 days]
 */
function isDateInWindow(current: Date, targetYear: number, holiday: HolidayDate): boolean {
  const targetDate = new Date(targetYear, holiday.month, holiday.day, 12, 0, 0);
  
  // 5 days before (start of day)
  const startDate = new Date(targetDate);
  startDate.setDate(targetDate.getDate() - 5);
  startDate.setHours(0, 0, 0, 0);

  // 2 days after (end of day)
  const endDate = new Date(targetDate);
  endDate.setDate(targetDate.getDate() + 2);
  endDate.setHours(23, 59, 59, 999);

  return current >= startDate && current <= endDate;
}

/**
 * Detect the active seasonal theme based on the current calendar date
 * Timeline rule: 5 days before, 2 days after
 */
export function getAutoSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  const year = now.getFullYear();
  const schedule = HOLIDAY_CALENDAR[year] || {
    gregorianNewYear: { month: 0, day: 1 },
    gregorianChristmas: { month: 11, day: 25 },
    fasika: { month: 3, day: 15 },
    enkutatash: { month: 8, day: 11 },
    ethiopianChristmas: { month: 0, day: 7 },
  };

  // 1. Gregorian Christmas (Dec 20 to Dec 27)
  if (isDateInWindow(now, year, schedule.gregorianChristmas)) {
    return 'christmas';
  }

  // 2. Gregorian New Year (Dec 27 to Jan 3)
  // Check current year's Jan 1
  if (isDateInWindow(now, year, schedule.gregorianNewYear)) {
    return 'new_year';
  }
  // Also check if we are in late December looking forward to next year's Jan 1 (Dec 27 - Dec 31)
  const nextYearSchedule = HOLIDAY_CALENDAR[year + 1] || schedule;
  if (isDateInWindow(now, year + 1, nextYearSchedule.gregorianNewYear)) {
    return 'new_year';
  }

  // 3. Ethiopian Christmas / Genna (Jan 2/3 to Jan 9/10)
  if (isDateInWindow(now, year, schedule.ethiopianChristmas)) {
    return 'christmas';
  }

  // 4. Fasika / Orthodox Easter (Spring, 5 days before to 2 days after)
  if (isDateInWindow(now, year, schedule.fasika)) {
    return 'fasika';
  }

  // 5. Enkutatash / Ethiopian New Year (Sep 6 to Sep 13/14)
  if (isDateInWindow(now, year, schedule.enkutatash)) {
    return 'enkutatash';
  }

  return 'standard';
}

/**
 * Metadata for each seasonal theme option
 */
export const SEASONAL_OPTIONS: { id: SeasonalTheme; label: string; icon: string; subtitle: string; period: string }[] = [
  {
    id: 'auto',
    label: 'Auto (Calendar Timeline)',
    icon: '⚡',
    subtitle: 'Switches automatically 5 days before & 2 days after holidays',
    period: 'Full year dynamic automation',
  },
  {
    id: 'standard',
    label: 'Standard',
    icon: '✨',
    subtitle: 'Classic brand typography with signature pink dot',
    period: 'Regular days',
  },
  {
    id: 'enkutatash',
    label: 'Enkutatash',
    icon: '🌸',
    subtitle: 'Adey Abeba / Sunflowers crowning the letters',
    period: 'Sep 6 – Sep 13 (Ethiopian New Year)',
  },
  {
    id: 'christmas',
    label: 'Christmas / Genna',
    icon: '🎅',
    subtitle: 'Festive Santa Hat perched over the "T"',
    period: 'Dec 20 – Dec 27 & Jan 2 – Jan 9',
  },
  {
    id: 'new_year',
    label: 'Gregorian New Year',
    icon: '🎉',
    subtitle: 'Celebration confetti & radiant sparkles',
    period: 'Dec 27 – Jan 3',
  },
  {
    id: 'fasika',
    label: 'Fasika (Easter)',
    icon: '🥚',
    subtitle: 'Pastel Easter eggs nestled alongside the letters',
    period: 'April / May (Easter window)',
  },
];

const STORAGE_KEY = 'tk_seasonal_logo_theme';

export function getSavedSeasonalTheme(): SeasonalTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['auto', 'standard', 'christmas', 'new_year', 'enkutatash', 'fasika'].includes(saved)) {
      return saved as SeasonalTheme;
    }
  } catch {
    // ignore
  }
  return 'auto';
}

export function saveSeasonalTheme(theme: SeasonalTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
