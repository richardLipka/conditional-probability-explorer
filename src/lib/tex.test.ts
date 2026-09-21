/*
 * Conditional Probability Explorer - formula rendering guards
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { texNum } from '../components/Math';

const COMPONENTS = join(import.meta.dirname ?? 'src/components', '..', 'components');
const files = readdirSync(COMPONENTS).filter((f) => f.endsWith('.tsx'));
const sources = files.map((f) => [f, readFileSync(join(COMPONENTS, f), 'utf8')] as const);

const BS = '\\';

/**
 * A TeX command has to survive the JavaScript string layer it is written in.
 * Template literals and quoted strings process escapes, so `\mid` there needs
 * a doubled backslash; a JSX attribute takes backslashes literally and needs
 * exactly one. Get it wrong and the command is silently eaten — KaTeX then
 * renders "Dmid+" instead of a conditional bar, which is exactly the kind of
 * wrong that nobody notices in a screenshot.
 */
describe('TeX strings survive their JavaScript escaping', () => {
  it('template literals double every backslash', () => {
    const problems: string[] = [];
    for (const [name, src] of sources) {
      for (const m of src.matchAll(/tex=\{([`'])([\s\S]*?)\1\}/g)) {
        const body = m[2];
        for (let i = 0; i < body.length; i++) {
          if (body[i] !== BS) continue;
          if (body[i + 1] === BS) {
            i++;
            continue;
          }
          if (/[a-zA-Z]/.test(body[i + 1] ?? '')) {
            problems.push(`${name}: single-escaped \\${body.slice(i + 1).match(/[a-zA-Z]+/)?.[0]}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('JSX attributes use exactly one backslash', () => {
    const problems: string[] = [];
    for (const [name, src] of sources) {
      for (const m of src.matchAll(/tex="([^"]*)"/g)) {
        if (m[1].includes(BS + BS)) problems.push(`${name}: doubled backslash in "${m[1]}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every literal formula in the app parses', () => {
    const failures: string[] = [];
    for (const [name, src] of sources) {
      for (const m of src.matchAll(/tex="([^"]*)"/g)) {
        try {
          katex.renderToString(m[1], { throwOnError: true, strict: false });
        } catch (e) {
          failures.push(`${name}: ${m[1]} — ${(e as Error).message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('numbers reaching a formula', () => {
  it('escapes the percent sign, which would otherwise start a TeX comment', () => {
    expect(texNum('9,02 %')).toBe('9,02 \\%');
    expect(texNum('1 in 1,000')).toBe('1 in 1,000');
  });

  it('a percent left unescaped really does swallow the rest of the line', () => {
    // Compare what a reader would see, not the surrounding markup.
    const visible = (tex: string) =>
      katex
        .renderToString(tex, { throwOnError: false, output: 'html' })
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, '');
    expect(visible('x = 5 % of y')).not.toContain('y');
    expect(visible(`x = 5 ${texNum('%')} of y`)).toContain('y');
  });

  it('renders a Czech-formatted number without complaint', () => {
    const html = katex.renderToString(`P(D) = ${texNum('0,100 %')}`, { throwOnError: true });
    expect(html).toContain('katex');
  });
});
