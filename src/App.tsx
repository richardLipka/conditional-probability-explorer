/*
 * Conditional Probability Explorer - page shell, scenario state and shareable links
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n';
import { BrandMark, ScenarioArt } from './components/Art';
import { Controls } from './components/Controls';
import { Simulation } from './components/Simulation';
import { Theory } from './components/Theory';
import { Compare } from './components/Compare';
import { PredictionInput, PredictionReveal } from './components/Prediction';
import { scenarios, defaultScenario, scenarioById } from './presets';
import { applyOverrides, buildQuery, readQuery, type Scenario } from './lib/scenario';
import type { ModelParams } from './lib/types';
import favLogo from './assets/fav-logo.svg';

type Tab = 'simulation' | 'theory' | 'compare';

const randomSeed = () => Math.floor(Math.random() * 2147483646) + 1;

/** A link carries the scenario file to load plus any parameter the sender changed. */
const initial = readQuery(typeof location === 'undefined' ? '' : location.search);
const initialScenario = scenarioById(initial.scenario) ?? defaultScenario;
const initialParams = applyOverrides(initialScenario.params, initial.params);

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [params, setParams] = useState<ModelParams>(initialParams);
  const [tab, setTab] = useState<Tab>('simulation');
  const [seed, setSeed] = useState(randomSeed);
  // Unlocked, every run draws a fresh seed; locked, the same seed replays.
  const [seedLocked, setSeedLocked] = useState(false);
  const [about, setAbout] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const loadScenario = (s: Scenario) => {
    setScenario(s);
    setParams(s.params);
  };

  // Keep the address bar in step, so the link is always shareable as it stands.
  const query = useMemo(
    () => buildQuery(scenario.id, params, scenario.params, lang),
    [scenario, params, lang],
  );
  useEffect(() => {
    history.replaceState(null, '', query);
  }, [query]);

  const share = async () => {
    const url = `${location.origin}${location.pathname}${query}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the address bar already holds the same link */
    }
  };

  const credit = (
    <>
      <p className="footer-credit">
        © 2026{' '}
        <a href="https://home.zcu.cz/~lipka/" rel="noopener" target="_blank">
          Richard Lipka
        </a>
        <span aria-hidden="true">·</span>
        <a href="mailto:lipka@fav.zcu.cz">lipka@fav.zcu.cz</a>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/richardLipka/conditional-probability-explorer"
          rel="noopener"
          target="_blank"
        >
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <span>{t('footer.license')}</span>
      </p>
      <p className="footer-affiliation">
        <a
          className="footer-logo"
          href="https://www.kiv.zcu.cz/cs"
          rel="noopener"
          target="_blank"
          title="Katedra informatiky a výpočetní techniky, FAV ZČU"
        >
          <img src={favLogo} alt="Fakulta aplikovaných věd ZČU" />
        </a>
        <span>{t('footer.affiliation')}</span>
      </p>
    </>
  );

  const tabs: { id: Tab; label: string; desc: string }[] = useMemo(
    () => [
      { id: 'simulation', label: t('nav.simulation'), desc: t('nav.simulation.desc') },
      { id: 'theory', label: t('nav.theory'), desc: t('nav.theory.desc') },
      { id: 'compare', label: t('nav.compare'), desc: t('nav.compare.desc') },
    ],
    [t],
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <BrandMark />
            <div>
              <h1>{t('app.title')}</h1>
              <p>{t('app.subtitle')}</p>
            </div>
          </div>

          <div className="header-group">
            <span className="header-label">{t('scenario.label')}</span>
            <select
              className="scenario-select"
              value={scenario.id}
              aria-label={t('scenario.label')}
              onChange={(e) => {
                const next = scenarios.find((s) => s.id === e.target.value);
                if (next) loadScenario(next);
              }}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name[lang]}
                </option>
              ))}
            </select>
            <button className="btn small ghost" onClick={share} title={t('scenario.share')}>
              {copied ? `✓ ${t('scenario.shared')}` : t('scenario.share')}
            </button>
          </div>

          <div className="seg lang" role="group" aria-label={t('app.language')}>
            <button
              aria-pressed={lang === 'cs'}
              onClick={() => setLang('cs')}
              title="Čeština"
              lang="cs"
            >
              CZ
            </button>
            <button
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
              title="English"
              lang="en"
            >
              GB
            </button>
          </div>

          <button className="btn small ghost" onClick={() => setAbout(true)}>
            {t('app.about')}
          </button>
        </div>
      </header>

      <div className="shell">
        <div className="intro">
          <ScenarioArt art={scenario.art} />
          <div>
            <h2>{scenario.name[lang]}</h2>
            <p>{scenario.description[lang]}</p>
            <p className="question">{scenario.question[lang]}</p>
            {scenario.disclaimer && <p className="disclaimer">{scenario.disclaimer[lang]}</p>}
          </div>
        </div>

        <nav className="tabs" role="tablist" aria-label={t('app.title')}>
          {tabs.map((tb) => (
            <button
              key={tb.id}
              className="tab"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
            >
              <strong>{tb.label}</strong>
              <span>{tb.desc}</span>
            </button>
          ))}
        </nav>

        <div className="layout">
          <div className="sticky">
            <Controls
              params={params}
              onChange={setParams}
              onReset={() => setParams(scenario.params)}
              onImport={loadScenario}
              scenario={scenario}
              seed={seed}
              onSeed={(v) => {
                setSeed(v);
                setSeedLocked(true);
              }}
              seedLocked={seedLocked}
              onSeedLocked={(locked) => {
                setSeedLocked(locked);
                if (!locked) setSeed(randomSeed());
              }}
              onReroll={() => setSeed(randomSeed())}
            />
          </div>

          {/* All three stay mounted: stepping over to the theory and back
              should not throw away a simulation run you just watched. */}
          <main role="tabpanel">
            <div style={{ display: tab === 'simulation' ? undefined : 'none' }}>
              <PredictionInput params={params} guess={guess} onGuess={setGuess} />
              <div style={{ height: 16 }} />
              <Simulation
                params={params}
                scenario={scenario}
                seed={seed}
                onNewSeed={() => {
                  if (!seedLocked) setSeed(randomSeed());
                }}
                reveal={<PredictionReveal params={params} guess={guess} />}
              />
            </div>
            <div style={{ display: tab === 'theory' ? undefined : 'none' }}>
              <Theory params={params} scenario={scenario} />
            </div>
            <div style={{ display: tab === 'compare' ? undefined : 'none' }}>
              <Compare params={params} />
            </div>
          </main>
        </div>

        <footer className="footer">
          <p className="footer-tagline">
            P(D | +) ≠ P(+ | D) <span aria-hidden="true">·</span> {t('footer.made')}
          </p>
          {credit}
        </footer>
      </div>

      {about && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('about.title')}
          onClick={() => setAbout(false)}
        >
          <div className="panel modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('about.title')}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{t('about.body')}</p>
            <p className="field-sub">{t('theory.independence')}</p>
            <h4 style={{ fontSize: 13, marginBottom: 4 }}>{t('theory.refclass')}</h4>
            <p className="field-sub" style={{ marginTop: 0 }}>{t('theory.refclass.note')}</p>
            <div className="about-credit">{credit}</div>
            <button className="btn" onClick={() => setAbout(false)}>
              {t('about.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
