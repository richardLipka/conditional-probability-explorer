/*
 * Conditional Probability Explorer - the palette has to survive colour blindness
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTCOME_COLORS } from '../components/Art';
import {
  contrastRatio,
  deltaE76,
  parseHex,
  relativeLuminance,
  separation,
  simulate,
  srgbToLinear,
  linearToSrgb,
  type RGB,
  type Vision,
} from './palette';

const VISIONS: Vision[] = ['normal', 'deuteranopia', 'protanopia'];
const DICHROMAT: Vision[] = ['deuteranopia', 'protanopia'];
const OUTCOMES = ['truePositive', 'falsePositive', 'falseNegative', 'trueNegative'] as const;

/**
 * Floors, and why they sit where they sit.
 *
 * At the default population of 10,000 the packer lands on a 2.6 px cell, below
 * the radius where the canvas bothers drawing a disc, so every person is a
 * 2.6 px block. No shape reads at that size. Colour is the entire signal and it
 * has to hold up for a dichromat — roughly one boy in a classroom of twelve.
 *
 * Two of the six pairs carry the lesson, because those two end up packed side
 * by side inside one bin: the positive pile splits into true and false
 * positives, the negative pile into true negatives and missed cases. Those get
 * the stricter floor.
 */
const MIN_DELTA_E = 35;
const MIN_DELTA_E_WITHIN_BIN = 40;
const WITHIN_BIN: [(typeof OUTCOMES)[number], (typeof OUTCOMES)[number]][] = [
  ['truePositive', 'falsePositive'],
  ['falseNegative', 'trueNegative'],
];

const css = readFileSync(join('src', 'styles.css'), 'utf8');

/** Read a custom property out of the stylesheet, so CSS and TS cannot drift. */
function cssVar(name: string): string {
  const token = `--${name}:`;
  for (const line of css.split('\n')) {
    const i = line.indexOf(token);
    if (i === -1) continue;
    const m = line.slice(i + token.length).match(/#[0-9a-fA-F]{3,8}/);
    if (m) return m[0];
  }
  throw new Error(`${token} not found in styles.css`);
}

describe('the colour maths itself', () => {
  it('round-trips the sRGB transfer function', () => {
    for (const v of [0, 0.02, 0.2, 0.5, 0.9, 1]) {
      expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6);
    }
  });

  it('leaves a neutral grey alone, because grey carries no red/green signal', () => {
    for (const vision of VISIONS) {
      for (const ch of simulate([128, 128, 128], vision)) {
        expect(ch).toBeCloseTo(128, 0);
      }
    }
  });

  it('collapses the red and green channels onto one response', () => {
    // This is the whole of dichromacy in one line: whatever goes in, the red
    // and green outputs come back equal. Everything else in this file follows.
    const samples: RGB[] = [
      [255, 0, 0],
      [0, 255, 0],
      [17, 200, 90],
      [240, 120, 40],
      ...OUTCOMES.map((k) => parseHex(OUTCOME_COLORS[k])),
    ];
    for (const vision of DICHROMAT) {
      for (const rgb of samples) {
        const [r, g] = simulate(rgb, vision);
        expect(r).toBeCloseTo(g, 6);
      }
    }
  });

  it('is a projection — simulating twice changes nothing further', () => {
    for (const vision of VISIONS) {
      for (const key of OUTCOMES) {
        const once = simulate(parseHex(OUTCOME_COLORS[key]), vision);
        expect(deltaE76(once, simulate(once, vision))).toBeLessThan(1);
      }
    }
  });
});

describe('the outcome palette', () => {
  it.each(VISIONS)('keeps every pair apart for %s', (vision) => {
    const tooClose: string[] = [];
    for (let i = 0; i < OUTCOMES.length; i++) {
      for (let j = i + 1; j < OUTCOMES.length; j++) {
        const a = OUTCOMES[i];
        const b = OUTCOMES[j];
        const within = WITHIN_BIN.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
        const floor = within ? MIN_DELTA_E_WITHIN_BIN : MIN_DELTA_E;
        const { deltaE } = separation(OUTCOME_COLORS[a], OUTCOME_COLORS[b], vision);
        if (deltaE < floor) tooClose.push(`${a}/${b}: ΔE ${deltaE.toFixed(1)} < ${floor}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('stays visible against the page background', () => {
    const bg = parseHex(cssVar('bg'));
    for (const key of OUTCOMES) {
      // 3:1 is the WCAG floor for a graphical object that carries meaning.
      expect(contrastRatio(parseHex(OUTCOME_COLORS[key]), bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it('leaves the true negatives as the quiet one', () => {
    // They are 95 % of a rare-disease screen. If they shout, nothing else reads.
    const tn = relativeLuminance(parseHex(OUTCOME_COLORS.trueNegative));
    for (const key of ['truePositive', 'falsePositive', 'falseNegative'] as const) {
      expect(relativeLuminance(parseHex(OUTCOME_COLORS[key]))).toBeGreaterThan(tn);
    }
  });

  it('matches the CSS custom properties', () => {
    const pairs: [string, string][] = [
      ['tp', OUTCOME_COLORS.truePositive],
      ['fp', OUTCOME_COLORS.falsePositive],
      ['fn', OUTCOME_COLORS.falseNegative],
      ['tn', OUTCOME_COLORS.trueNegative],
    ];
    for (const [name, expected] of pairs) {
      expect(cssVar(name).toLowerCase()).toBe(expected.toLowerCase());
    }
  });

  it('documents the pair that forced the change', () => {
    // The palette used to be #34d399 against #fb7185. To anyone with the usual
    // form of colour blindness those were one colour, and they were the two
    // halves of the positive pile — the split the whole app is about.
    const before = separation('#34d399', '#fb7185', 'deuteranopia').deltaE;
    const after = separation(
      OUTCOME_COLORS.truePositive,
      OUTCOME_COLORS.falsePositive,
      'deuteranopia',
    ).deltaE;
    expect(before).toBeLessThan(15);
    expect(after).toBeGreaterThan(before * 3);
  });
});
