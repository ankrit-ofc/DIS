// DISTRO Design System
// Primary: #2563EB  |  Slogan: Wholesale, made simple.

export const colors = {
  // Primary
  blue: "#2563EB",
  blueDark: "#1D4ED8",
  blueDarker: "#1E40AF",
  blueLight: "#EFF6FF",
  blueMid: "#BFDBFE",
  bluePale: "#DBEAFE",

  // Success
  green: "#00C46F",
  greenDark: "#00A05A",
  greenLight: "#D1FAE5",

  // Warning
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  amberDark: "#D97706",

  // Error
  red: "#EF4444",
  redLight: "#FEE2E2",

  // Neutrals
  ink: "#0D1120",
  ink80: "#1E293B",
  offWhite: "#F7F9FF",
  white: "#FFFFFF",

  // Grays
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E0E4F0",
  gray300: "#CBD5E1",
  gray400: "#9BA3BF",
  gray500: "#64748B",
  gray600: "#5C6480",
  gray700: "#334155",
  gray800: "#1E293B",

  // Dark mode surfaces
  dark: {
    bg: "#0A0F1E",
    surface: "#111827",
    surfaceElevated: "#1A2236",
    border: "#1E293B",
    text: "#F1F5F9",
    textSecondary: "#94A3B8",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const typography = {
  heading: "SpaceGrotesk_700Bold",
  headingMedium: "SpaceGrotesk_600SemiBold",
  headingLight: "SpaceGrotesk_500Medium",
  body: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemiBold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
};

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  splash: 600,
  spring: { damping: 18, stiffness: 200, mass: 1 },
  springBouncy: { damping: 12, stiffness: 180, mass: 0.8 },
};

// Status → color mapping
export const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:    { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  CONFIRMED:  { bg: "#EFF6FF", text: "#1D4ED8", dot: "#2563EB" },
  PROCESSING: { bg: "#EDE9FE", text: "#5B21B6", dot: "#7C3AED" },
  PACKED:     { bg: "#F0FDF4", text: "#166534", dot: "#16A34A" },
  SHIPPED:    { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  IN_TRANSIT: { bg: "#F0F9FF", text: "#0C4A6E", dot: "#0284C7" },
  DELIVERED:  { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
  CANCELLED:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};
