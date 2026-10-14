/**
 * Centralized, deterministic department color mapping for Slotify.
 * All palette values follow a cohesive soft blue/cool-tone brand aesthetic.
 */

export interface DepartmentColorScheme {
  code: string;
  name: string;
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const DEPARTMENT_PALETTES: Record<string, DepartmentColorScheme> = {
  ENG: {
    code: "ENG",
    name: "Engineering",
    bg: "#DBEAFE",
    border: "#93C5FD",
    text: "#1D4ED8",
    badgeBg: "#EFF6FF",
    badgeBorder: "#BFDBFE",
    badgeText: "#1E40AF",
  },
  FE: {
    code: "FE",
    name: "Frontend Development",
    bg: "#E0E7FF",
    border: "#A5B4FC",
    text: "#3730A3",
    badgeBg: "#EEF2FF",
    badgeBorder: "#C7D2FE",
    badgeText: "#312E81",
  },
  BE: {
    code: "BE",
    name: "Backend Development",
    bg: "#EDE9FE",
    border: "#C4B5FD",
    text: "#5B21B6",
    badgeBg: "#F5F3FF",
    badgeBorder: "#DDD6FE",
    badgeText: "#4C1D95",
  },
  MOBILE: {
    code: "MOBILE",
    name: "Mobile Development",
    bg: "#E0F2FE",
    border: "#7DD3FC",
    text: "#0369A1",
    badgeBg: "#F0F9FF",
    badgeBorder: "#BAE6FD",
    badgeText: "#075985",
  },
  IT: {
    code: "IT",
    name: "IT Support",
    bg: "#CFFAFE",
    border: "#67E8F9",
    text: "#155E75",
    badgeBg: "#ECFEFF",
    badgeBorder: "#A5F3FC",
    badgeText: "#164E63",
  },
  HR: {
    code: "HR",
    name: "Human Resources",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    text: "#1E40AF",
    badgeBg: "#DBEAFE",
    badgeBorder: "#93C5FD",
    badgeText: "#1D4ED8",
  },
};

export const UNASSIGNED_PALETTE: DepartmentColorScheme = {
  code: "UNASSIGNED",
  name: "Unassigned / Legacy",
  bg: "#F1F5F9",
  border: "#CBD5E1",
  text: "#475569",
  badgeBg: "#F8FAFC",
  badgeBorder: "#E2E8F0",
  badgeText: "#334155",
};

/**
 * Returns deterministic department color scheme based on department code or name.
 */
export function getDepartmentColorScheme(
  code?: string | null,
  name?: string | null
): DepartmentColorScheme {
  if (!code && !name) {
    return UNASSIGNED_PALETTE;
  }

  // 1. Match by code uppercase
  if (code) {
    const upperCode = code.trim().toUpperCase();
    if (DEPARTMENT_PALETTES[upperCode]) {
      return DEPARTMENT_PALETTES[upperCode];
    }
  }

  // 2. Match by department name keyword
  if (name) {
    const lowerName = name.trim().toLowerCase();
    if (lowerName.includes("frontend")) return DEPARTMENT_PALETTES.FE;
    if (lowerName.includes("backend")) return DEPARTMENT_PALETTES.BE;
    if (lowerName.includes("mobile")) return DEPARTMENT_PALETTES.MOBILE;
    if (lowerName.includes("engineer")) return DEPARTMENT_PALETTES.ENG;
    if (lowerName.includes("support") || lowerName.includes("it")) return DEPARTMENT_PALETTES.IT;
    if (lowerName.includes("human") || lowerName.includes("hr")) return DEPARTMENT_PALETTES.HR;
  }

  return UNASSIGNED_PALETTE;
}
