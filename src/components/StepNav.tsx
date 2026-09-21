/*
 * Conditional Probability Explorer - where you are in a long derivation
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useEffect, useRef, useState } from 'react';

export interface Step {
  /** DOM id of the section this chip points at. */
  id: string;
  label: string;
  /** Numbered steps of the derivation. The rest are stops along the way. */
  n?: number;
}

export interface StepNavProps {
  steps: Step[];
  label: string;
  progress: (current: number, total: number) => string;
}

/**
 * The theory runs to four thousand pixels. Without this you scroll into the
 * middle of a Bayes derivation with no idea how much sits behind you or how
 * much is still coming.
 *
 * It hides nothing and gates nothing. It answers one question: where am I.
 */
export function StepNav({ steps, label, progress }: StepNavProps) {
  const [active, setActive] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {

    /**
     * Whichever section has most recently crossed the line under the sticky
     * bars is the one you are reading.
     *
     * An IntersectionObserver band is the obvious tool and the wrong one here:
     * these panels are taller than any sensible band, so three of them report
     * as intersecting at once and there is no way to tell from the callback
     * which one the reader is actually looking at.
     */
    let frame = 0;
    const measure = () => {
      frame = 0;
      const nav = navRef.current;
      if (!nav || nav.offsetHeight === 0) return; // tab is hidden
      const els = steps
        .map((s) => document.getElementById(s.id))
        .filter((el): el is HTMLElement => el !== null);
      if (!els.length) return;

      const header = document.querySelector('.header') as HTMLElement | null;
      // Below the sticky bars, but never off the bottom of a short window.
      const line = Math.min(
        (header?.offsetHeight ?? 78) + nav.offsetHeight + 16,
        Math.round(window.innerHeight * 0.4),
      );
      let idx = 0;
      for (let i = 0; i < els.length; i++) {
        // A heading sitting within a pixel of the line counts as reached.
        if (els[i].getBoundingClientRect().top - line <= 1) idx = i;
      }
      // The last section is usually short. Without this it can never win,
      // because the page runs out of scroll before its top reaches the line.
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      setActive(atBottom ? els.length - 1 : idx);
    };
    // Cancel and reschedule rather than dropping events while one is pending.
    // Dropping loses the LAST event of a gesture, which is precisely the one
    // that matters: it is where the reader stopped and looked.
    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [steps]);

  // On a narrow screen the rail scrolls sideways, so drag the current chip back
  // into view rather than letting it drift off the edge.
  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.children[active] as HTMLElement | undefined;
    if (!rail || !chip) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({
      left: chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [active]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Land the heading below both sticky bars instead of underneath them.
    const header = document.querySelector('.header') as HTMLElement | null;
    const offset = (header?.offsetHeight ?? 78) + (navRef.current?.offsetHeight ?? 0) + 12;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  };

  return (
    <nav className="step-nav" aria-label={label} ref={navRef}>
      <div className="step-nav-rail" ref={railRef}>
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`step-chip${i === active ? ' on' : i < active ? ' past' : ''}`}
            aria-current={i === active ? 'step' : undefined}
            onClick={() => jump(s.id)}
          >
            <i aria-hidden="true">{s.n ?? '·'}</i>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="step-nav-foot">
        <div className="step-nav-bar" aria-hidden="true">
          <span style={{ width: `${((active + 1) / Math.max(steps.length, 1)) * 100}%` }} />
        </div>
        <span className="step-nav-count">{progress(Math.min(active + 1, steps.length), steps.length)}</span>
      </div>
    </nav>
  );
}
