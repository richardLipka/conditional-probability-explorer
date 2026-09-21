/*
 * Conditional Probability Explorer - colour science for the outcome palette
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */

/**
 * The simulation draws one dot per person. At ten thousand people the cell is
 * about 2.6 px across, far too small for a shape to read, so colour carries the
 * whole distinction between a true positive and a missed case. That only works
 * if the four colours stay apart for a viewer with colour vision deficiency —
 * roughly one boy in twelve. This module measures whether they do.
 */

export type RGB = readonly [number, number, number];

/** Dichromat types the simulation covers. Tritanopia is left out: it is rarer
 *  than 1 in 10,000 and the Viénot reduction is not reliable for it. */
export type Vision = 'normal' | 'deuteranopia' | 'protanopia';

export function parseHex(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function toHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((v) => clamp255(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** sRGB transfer function, both directions, on 0..1 values. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** WCAG relative luminance. */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Viénot, Brettel & Mollon (1999), the linear-RGB reduction for sRGB primaries.
 * A protanope and a deuteranope both lose the red/green opponent signal, which
 * is why the first two rows of each matrix are identical: the two channels
 * collapse onto one response.
 */
const MATRICES: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protanopia: [
    [0.11238, 0.88762, 0.0],
    [0.11238, 0.88762, 0.0],
    [0.00401, -0.00401, 1.0],
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0.0],
    [0.29275, 0.70725, 0.0],
    [-0.02234, 0.02234, 1.0],
  ],
};

/** What `rgb` looks like to the given viewer. */
export function simulate(rgb: RGB, vision: Vision): RGB {
  if (vision === 'normal') return rgb;
  const m = MATRICES[vision];
  const lin = rgb.map((v) => srgbToLinear(v / 255));
  const out = m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return [
    linearToSrgb(out[0]) * 255,
    linearToSrgb(out[1]) * 255,
    linearToSrgb(out[2]) * 255,
  ];
}

/** CIE L*a*b* under D65. */
export function toLab(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map((v) => srgbToLinear(v / 255));
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const d = 6 / 29;
  const f = (t: number) => (t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. Crude next to ΔE2000, and enough to catch a clash. */
export function deltaE76(a: RGB, b: RGB): number {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** How far apart two colours stay for a given viewer. */
export function separation(a: string, b: string, vision: Vision) {
  const sa = simulate(parseHex(a), vision);
  const sb = simulate(parseHex(b), vision);
  return { deltaE: deltaE76(sa, sb), contrast: contrastRatio(sa, sb) };
}
