/*
 * Conditional Probability Explorer - LaTeX formula rendering
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useMemo } from 'react';
import katex from 'katex';

/**
 * KaTeX wrapper. `trust` is enabled so formulas can tag their own sub-terms
 * with \htmlClass, which is what lets hovering a symbol light up the matching
 * cell of the contingency table.
 */
function render(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: (ctx) => ctx.command === '\\htmlClass',
      output: 'html',
    });
  } catch {
    return tex;
  }
}

export function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  return (
    <span
      className={display ? 'math-block' : 'math-inline'}
      // KaTeX output is generated here from our own strings, never from input.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Terms a formula can tag so the rest of the page can highlight along. */
export type TermKey = 'tp' | 'fp' | 'fn' | 'tn' | 'cond' | 'nocond' | 'pos' | 'neg';

export const TERM_CLASS: Record<TermKey, string> = {
  tp: 'term-tp',
  fp: 'term-fp',
  fn: 'term-fn',
  tn: 'term-tn',
  cond: 'term-cond',
  nocond: 'term-nocond',
  pos: 'term-pos',
  neg: 'term-neg',
};

/** Wrap a TeX fragment so it becomes hoverable and linked to the diagrams. */
export function term(key: TermKey, tex: string): string {
  return `\\htmlClass{math-term ${TERM_CLASS[key]}}{${tex}}`;
}

/** Read the term a hovered element belongs to, if any. */
export function termFromEvent(target: EventTarget | null): TermKey | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('.math-term');
  if (!el) return null;
  for (const [key, cls] of Object.entries(TERM_CLASS)) {
    if (el.classList.contains(cls)) return key as TermKey;
  }
  return null;
}
