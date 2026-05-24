/**
 * Design tokens — the visual constitution.
 *
 * Every color, size, and motion value used in the UI comes from here.
 * Do NOT hardcode values in components.
 *
 * Two consumers:
 *   1. CSS variables in globals.css (used by Tailwind classes)
 *   2. TypeScript imports (used by Framer Motion springs, JS animations)
 */

// ─────────────────────────────────────────────────────────────
// MOTION
// ─────────────────────────────────────────────────────────────

export const spring = {
  /** Snappy — buttons, taps, micro-interactions */
  snappy: { type: "spring", stiffness: 400, damping: 30 } as const,
  /** Smooth — page transitions, layout shifts */
  smooth: { type: "spring", stiffness: 300, damping: 30 } as const,
  /** Gentle — hero reveals, large compositions */
  gentle: { type: "spring", stiffness: 200, damping: 40 } as const,
} as const;

export const ease = {
  /** Default ease for non-spring tweens (sharp out, soft land) */
  default: [0.16, 1, 0.3, 1] as const,
  /** Use sparingly — for progress, loaders */
  linear: [0, 0, 1, 1] as const,
} as const;

export const duration = {
  micro: 0.15, // 150ms
  short: 0.2, // 200ms
  base: 0.3, // 300ms
  medium: 0.4, // 400ms
  long: 0.6, // 600ms
  hero: 0.8, // 800ms
} as const;

// ─────────────────────────────────────────────────────────────
// SPACING (8px base)
// ─────────────────────────────────────────────────────────────

export const space = {
  px: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
  24: 96,
  32: 128,
  48: 192,
} as const;

// ─────────────────────────────────────────────────────────────
// TYPOGRAPHY SCALE
// ─────────────────────────────────────────────────────────────

export const fontSize = {
  xs: { size: 12, lineHeight: 1.5, tracking: 0 },
  sm: { size: 14, lineHeight: 1.5, tracking: 0 },
  base: { size: 16, lineHeight: 1.5, tracking: 0 },
  md: { size: 18, lineHeight: 1.5, tracking: 0 },
  lg: { size: 22, lineHeight: 1.3, tracking: -0.01 },
  xl: { size: 28, lineHeight: 1.2, tracking: -0.01 },
  "2xl": { size: 36, lineHeight: 1.15, tracking: -0.02 },
  "3xl": { size: 48, lineHeight: 1.1, tracking: -0.02 },
  "4xl": { size: 64, lineHeight: 1.05, tracking: -0.02 },
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// ─────────────────────────────────────────────────────────────
// RADIUS
// ─────────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  sm: 4,
  base: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────────────────────
// Z-INDEX SCALE
// ─────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700,
} as const;

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────

export type Spring = (typeof spring)[keyof typeof spring];
export type FontSizeKey = keyof typeof fontSize;
export type SpaceKey = keyof typeof space;
