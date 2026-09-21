/*
 * Conditional Probability Explorer - keep the answer back until a guess exists
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

export interface RevealGateProps {
  revealed: boolean;
  onReveal: () => void;
  children: ReactNode;
}

/**
 * Predicting before you look is the one thing that makes a base rate stick, and
 * it only works while the answer is still unknown. Anything that prints the
 * posterior waits behind this.
 *
 * There is always a way through. A gate the reader cannot open is a wall, and a
 * teacher demonstrating from the front of a room should not have to play along.
 */
export function RevealGate({ revealed, onReveal, children }: RevealGateProps) {
  const { t } = useI18n();
  if (revealed) return <>{children}</>;
  return (
    <section className="panel locked">
      <h3>{t('reveal.title')}</h3>
      <p>{t('reveal.body')}</p>
      <button className="btn small ghost" onClick={onReveal}>
        {t('reveal.show')}
      </button>
    </section>
  );
}
