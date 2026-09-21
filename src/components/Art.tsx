/*
 * Conditional Probability Explorer - outcome glyphs and scenario artwork
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import type { ArtKey } from '../lib/scenario';
import type { Outcome } from '../lib/types';

export const OUTCOME_COLORS: Record<Outcome | 'cond' | 'nocond' | 'unknown', string> = {
  truePositive: '#6ee7b7',
  falsePositive: '#ef4444',
  trueNegative: '#5b678f',
  falseNegative: '#fbbf24',
  cond: '#c084fc',
  nocond: '#47527a',
  unknown: '#3a4468',
};

/**
 * Shape glyphs. Every outcome gets its own SILHOUETTE as well as its own colour,
 * so the visualisation stays readable without colour vision.
 *   true positive  = disc with a tick
 *   false positive = square with a cross
 *   false negative = triangle
 *   true negative  = small diamond
 */
export function Glyph({
  kind,
  size = 14,
}: {
  kind: Outcome | 'cond' | 'nocond' | 'unknown';
  size?: number;
}) {
  const c = OUTCOME_COLORS[kind];
  const s = size;
  const common = { fill: c, stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.8 };
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true">
      {kind === 'truePositive' && (
        <>
          <circle cx="8" cy="8" r="7" {...common} />
          <path d="M4.6 8.3 7 10.6l4.4-5" fill="none" stroke="#06281c" strokeWidth="1.9" />
        </>
      )}
      {kind === 'falsePositive' && (
        <>
          <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" {...common} />
          <path d="M5 5l6 6M11 5l-6 6" fill="none" stroke="#3c0c17" strokeWidth="1.9" />
        </>
      )}
      {kind === 'falseNegative' && (
        <>
          <path d="M8 1.2 15 14.4H1z" {...common} />
          <path d="M8 6v3.4" stroke="#3a2601" strokeWidth="1.8" />
          <circle cx="8" cy="11.7" r="1" fill="#3a2601" />
        </>
      )}
      {kind === 'trueNegative' && <path d="M8 3.5 12.5 8 8 12.5 3.5 8z" {...common} />}
      {kind === 'cond' && <circle cx="8" cy="8" r="6" {...common} />}
      {kind === 'nocond' && <circle cx="8" cy="8" r="4.2" fill={c} />}
      {kind === 'unknown' && (
        <circle cx="8" cy="8" r="5" fill="none" stroke={c} strokeWidth="2" />
      )}
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c8cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#bm)" opacity="0.16" />
      <rect x="2" y="2" width="44" height="44" rx="13" fill="none" stroke="url(#bm)" opacity="0.6" />
      <circle cx="15" cy="24" r="5" fill="#7c8cff" />
      <path d="M20 24h8" stroke="#5c6ba8" strokeWidth="1.6" />
      <circle cx="33" cy="15" r="4" fill="#6ee7b7" />
      <circle cx="33" cy="33" r="4" fill="#ef4444" />
      <path d="M28 24 33 15M28 24 33 33" stroke="#5c6ba8" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** Per-preset / per-scenario artwork used in the intro strip and the simulation stage. */
export function ScenarioArt({ art, className = 'intro-art' }: { art: ArtKey; className?: string }) {
  switch (art) {
    case 'virus':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <defs>
            <radialGradient id="vg" cx="0.4" cy="0.3">
              <stop offset="0" stopColor="#d8b4fe" />
              <stop offset="1" stopColor="#7e22ce" />
            </radialGradient>
          </defs>
          <circle cx="66" cy="46" r="40" fill="#1a2246" />
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return (
              <g key={i}>
                <line
                  x1={66 + Math.cos(a) * 20}
                  y1={46 + Math.sin(a) * 20}
                  x2={66 + Math.cos(a) * 29}
                  y2={46 + Math.sin(a) * 29}
                  stroke="#a855f7"
                  strokeWidth="2.4"
                />
                <circle cx={66 + Math.cos(a) * 31} cy={46 + Math.sin(a) * 31} r="3" fill="#c084fc" />
              </g>
            );
          })}
          <circle cx="66" cy="46" r="20" fill="url(#vg)" />
          <circle cx="59" cy="40" r="4" fill="#f3e8ff" opacity="0.55" />
          <circle cx="72" cy="52" r="2.5" fill="#f3e8ff" opacity="0.4" />
        </svg>
      );
    case 'clinic':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <rect x="14" y="24" width="104" height="54" rx="8" fill="#1a2246" stroke="#33406c" />
          <path d="M14 40h104" stroke="#33406c" />
          <circle cx="24" cy="32" r="3" fill="#ef4444" />
          <circle cx="34" cy="32" r="3" fill="#fbbf24" />
          <circle cx="44" cy="32" r="3" fill="#6ee7b7" />
          <path
            d="M24 62h14l6-12 8 24 7-16 5 8h44"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="88" y="8" width="26" height="26" rx="6" fill="#7c8cff" opacity="0.25" />
          <path d="M101 13v16M93 21h16" stroke="#a5b4ff" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      );
    case 'roadside':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <path d="M0 78h132" stroke="#33406c" strokeWidth="6" />
          <path d="M6 78h16M34 78h16M62 78h16M90 78h16M118 78h14" stroke="#5b678f" strokeWidth="2" />
          <rect x="22" y="46" width="62" height="22" rx="7" fill="#26305c" stroke="#3d4a86" />
          <path d="M32 46l8-12h26l9 12z" fill="#1b2444" stroke="#3d4a86" />
          <circle cx="38" cy="70" r="7" fill="#131a35" stroke="#4b5786" strokeWidth="2.5" />
          <circle cx="70" cy="70" r="7" fill="#131a35" stroke="#4b5786" strokeWidth="2.5" />
          <rect x="94" y="30" width="26" height="10" rx="4" fill="#1a2246" stroke="#3d4a86" />
          <circle cx="101" cy="35" r="3.2" fill="#ef4444">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="113" cy="35" r="3.2" fill="#60a5fa">
            <animate
              attributeName="opacity"
              values="0.2;1;0.2"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>
          <rect x="105" y="40" width="4" height="30" fill="#33406c" />
        </svg>
      );
    case 'lab':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <path
            d="M54 12v22L34 74a6 6 0 0 0 5 9h54a6 6 0 0 0 5-9L78 34V12z"
            fill="#16203f"
            stroke="#3d4a86"
            strokeWidth="2"
          />
          <path d="M48 12h36" stroke="#7c8cff" strokeWidth="4" strokeLinecap="round" />
          <path d="M41 62h50l7 12a6 6 0 0 1-5 9H39a6 6 0 0 1-5-9z" fill="#22d3ee" opacity="0.45" />
          <circle cx="55" cy="72" r="3" fill="#a5f3fc" opacity="0.8">
            <animate attributeName="cy" values="78;62;78" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="74" cy="76" r="2.2" fill="#a5f3fc" opacity="0.7">
            <animate attributeName="cy" values="80;64;80" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="66" cy="70" r="1.8" fill="#e0f2fe" opacity="0.6" />
        </svg>
      );
    case 'airport':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <rect x="8" y="14" width="116" height="64" rx="9" fill="#16203f" stroke="#33406c" />
          <path d="M8 62h116" stroke="#33406c" />
          {/* scanner arch */}
          <path
            d="M46 62V38a20 20 0 0 1 40 0v24"
            fill="none"
            stroke="#4c5bb0"
            strokeWidth="3"
          />
          <circle cx="66" cy="30" r="4" fill="#22d3ee">
            <animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <path d="M66 34v6" stroke="#22d3ee" strokeWidth="1.6" />
          {/* travellers, one flagged */}
          {[22, 34, 66, 96, 110].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={52} r="4" fill={i === 2 ? '#ef4444' : '#3b4670'} />
              <path
                d={`M${x - 5} 62 q5 -7 10 0`}
                fill={i === 2 ? '#ef4444' : '#2c3560'}
              />
            </g>
          ))}
          <rect x="56" y="68" width="20" height="4" rx="2" fill="#ef4444" opacity="0.7" />
        </svg>
      );
    case 'lazy':
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          <rect x="26" y="20" width="80" height="54" rx="8" fill="#16203f" stroke="#33406c" />
          <rect x="38" y="34" width="56" height="16" rx="4" fill="#5b678f" opacity="0.35" />
          <text
            x="66"
            y="46"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#8b93b5"
            fontFamily="system-ui, sans-serif"
          >
            NEGATIVE
          </text>
          <text x="66" y="64" textAnchor="middle" fontSize="9" fill="#5b678f">
            99.9 %
          </text>
          <circle cx="104" cy="26" r="3" fill="#5b678f" opacity="0.6" />
          <path d="M112 18q6 4 0 8" stroke="#5b678f" strokeWidth="1.6" fill="none" />
          <path d="M118 12q9 6 0 12" stroke="#5b678f" strokeWidth="1.4" fill="none" opacity="0.6" />
        </svg>
      );
    case 'crowd':
    default:
      return (
        <svg className={className} viewBox="0 0 132 92" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => {
            const x = 12 + (i % 8) * 15;
            const y = 24 + Math.floor(i / 8) * 22;
            const hit = i === 9 || i === 18;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4.6" fill={hit ? '#c084fc' : '#3b4670'} />
                <path
                  d={`M${x - 6} ${y + 14} q6 -8 12 0`}
                  fill={hit ? '#a855f7' : '#2c3560'}
                  opacity="0.9"
                />
              </g>
            );
          })}
        </svg>
      );
  }
}
