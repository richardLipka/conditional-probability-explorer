# Conditional Probability Explorer

An interactive, bilingual (English / Čeština) teaching tool for the **base-rate fallacy**:

> A highly accurate test does not make a positive result reliable. What a positive
> result *means* depends on how common the condition is.

Everything runs client-side. No backend.

**Live:** https://richardlipka.github.io/conditional-probability-explorer/
**Repository:** https://github.com/richardLipka/conditional-probability-explorer

## Running it

```bash
npm install
npm run dev      # http://localhost:5183
npm test         # unit tests for the probability model
npm run build    # production bundle
```

## What is inside

| Area | What it does |
| --- | --- |
| **Simulation** | Individuals **move**. Everybody starts as a dot in the population pool, travels through the Test 1 gate along a curve, and lands in the bin for the outcome they got — their colour only resolving as they clear the gate. With confirmatory testing the positive bin sets off again through a second gate. Once the run settles, the same result is restated as a proportional stream. Random and expected-value modes sit side by side so randomness and theory can be compared. |
| **Theory** | An **interactive contingency table** — click a row or a column to condition on it and watch the group become 100 % — a Sankey-style **stream** of the whole flow at expected values — one band whose thickness is head-count, split by what is actually true, then divided by each test gate into true/false positive and negative ribbons, with a magnified panel for the (usually hairline) positive branch. Then natural frequencies (100 / 1,000 / 10,000 people), a weighted probability tree, a contingency table, the full derivation — with `P(+ \| D)` and `P(D \| +)` deliberately shown as two different numbers — and a **Bayes update chain** (prior → one positive → two positives) that stays live whether or not confirmatory testing is switched on for the simulation. |
| **Compare prevalence** | The same test applied to two populations, side by side, plus a PPV-versus-prevalence curve on a log axis. |

## Teaching conditional probability, not just the fallacy

Conditioning is an *operation*: restrict the sample space, throw away everything
outside it, rescale what is left to 1. The app shows the operation, not only its
result:

- **Click a row or a column of the contingency table** and that group becomes the
  whole population. Picking the *positive* column gives `P(D | +)`; picking the
  *condition present* row gives `P(+ | D)`. Same numerator, different
  denominator — the asymmetry falls out of one object instead of being asserted.
- **Condition on a positive result in the simulation** and everyone else fades
  out of the picture while the positive group expands to fill the frame. At the
  default population every individual is drawn, so the dots are countable.
- **Point at any term in a formula** and the matching branch of the probability
  tree and cell of the table light up.
- **A note on reference classes**: `P(D | +) = 9 %` is a statement about
  everybody who tests positive, not about any one person being 9 % ill.

Formulas are typeset with [KaTeX](https://katex.org/) and recompute as you move
the sliders — including the ones inside the probability tree, which live in SVG
`foreignObject` elements. Czech gets decimal commas inside the maths.

## When the two tests are not independent

Textbook chaining assumes conditional independence. Real confirmatory tests share
failure modes, so the **shared failure modes** slider sets the probability ρ that
test 2 simply repeats test 1's verdict:

```text
se₂' = ρ + (1 − ρ)·se₂        sp₂' = (1 − ρ)·sp₂
```

At ρ = 0 this is the independent case. At ρ = 1 the likelihood ratio of a second
positive collapses to exactly 1 and the posterior does not move at all — the
confirmation tells you nothing. The app warns whenever ρ > 0.

## Model

```text
D  = the condition is actually present
+  = the test result is positive

prevalence  = P(D)
sensitivity = P(+ | D)
specificity = P(− | ¬D)

P(+)    = P(+|D)·P(D) + P(+|¬D)·P(¬D)
PPV     = P(D|+) = P(+|D)·P(D) / P(+)
```

Two-stage testing retests only the test-1 positives, so the second stage is
Bayes applied again with `PPV₁` as its prior:

```text
                      P(D)·se₁·se₂
P(D | +₁ ∩ +₂) = ──────────────────────────────────────
                 P(D)·se₁·se₂ + P(¬D)·(1−sp₁)·(1−sp₂)
```

### The cost of confirming

A second test can only take people *out* of the positive pile, so every genuine
case it clears stops being a true positive and becomes a **new missed case**.
The app splits the negatives into the three groups this creates:

```text
negative on test 1     (never retested)      → missed at stage 1
positive then cleared  (by test 2)           → missed at stage 2
both together          (finally declared negative)
```

Being in the *cleared by test 2* group is far riskier than being in the
test-1-negative group — everybody there was flagged once already — and the
panel shows both miss rates side by side, plus a ledger of where every real
case ended up: found, missed by test 1, or cleared by test 2. Chain sensitivity
is `se₁ × se₂`.

**This assumes the two tests are conditionally independent given the true
condition status.** Real confirmatory tests often share failure modes, in which
case the true joint probability is less favourable than the app shows. The app
states this assumption wherever the two-stage number appears.

## Code layout

```text
src/
  lib/                 the model — no React in here
    probability.ts       exact/expected probabilities, PPV, NPV, likelihood ratios
    simulation.ts        seeded PRNG + per-individual random draws
    expectedPopulation.ts a deterministic population matching the expected counts
    *.test.ts            37 unit tests over the above
  i18n/                en.ts, cs.ts, and the provider (every string is keyed)
  presets/             *.json scenario presets + validating loader
  components/          controls, canvas population view, funnel, dashboard,
                       theory, comparison, prediction quiz, scenario artwork
```

The maths is deliberately kept out of the components: `lib/` is pure functions,
tested directly, and the UI only formats what it returns.

## Verification

`npm test` runs 109 tests. Beyond unit tests of each function, the model is
checked against two independent references in `src/lib/verification.test.ts`:

- **Brute-force enumeration** of the whole sample space over (condition, test 1,
  test 2), built from first principles rather than from any formula the app
  uses. Every posterior, every negative group and every cell is compared against
  it across eight parameter regimes including the degenerate ones.
- **Monte Carlo**: 400,000-person runs of the actual simulation compared against
  the closed form, so the animation and the arithmetic can never drift apart.
- **A published worked example**: the cancer-screening problem from the Czech
  secondary-school text at <https://publi.cz/books/201/13.html> (3 in 1,000
  prevalence, 5 % false alarms, 2 % missed cases) is reproduced digit for digit,
  0.00294 / 0.05279 = 5.6 %.
- **Formula escaping**: TeX commands have to survive the JavaScript string layer
  they are written in. A test walks every formula in the source and fails if a
  backslash count would silently eat a command.

Every bundled scenario is also checked for internal consistency — counts adding
up, probabilities in range, no NaN.

## Reproducibility

The seed is random by default, so every run draws a fresh population. Switch the
seed control to **Fixed** (or just type a number, which fixes it) and the same
seed replays exactly the same run — useful for teaching from a prepared example
or for reporting a specific outcome. The ⟳ button draws a new seed on demand.

## Scenarios

A scenario is the whole teaching unit, not just numbers: the story, the labels
for the two groups, a plain-language reading of a positive and a negative
result, and **what each of the four outcomes means for a real person**. They
live as JSON in `src/presets/`, so a new one needs no code:

- `rare-disease.json` — 0.1 % prevalence, 99 %/99 % test
- `common-disease.json` — the same test at 10 % prevalence
- `roadside-drug-test.json` — 0.5 % prevalence, 95 %/98 % field test
- `confirmatory-testing.json` — field test screens, 99 %/99.9 % lab test confirms
- `mass-screening.json` — 1-in-2,000 condition screened across a whole city
- `airport-ai.json` — AI pattern screening of 100,000 travellers a day, 1 in 10,000 genuinely involved
- `lazy-test.json` — a test that always answers negative: 99.9 % accurate and completely useless

**Export JSON** downloads the whole scenario with the current parameters;
**Import JSON** loads such a file back, with every value validated and clamped
and missing translations falling back to English.

## Sharing

The address bar always holds a link to exactly what is on screen:
`?scenario=<file id>` plus only the parameters that were changed from the
scenario's own, plus the language. **Copy shareable link** puts it on the
clipboard. A teacher can therefore hand out a link that opens a specific
scenario, at specific settings, in Czech.

## Images

Every visualisation has a **Download image** button. The PNG contains the
picture, a legend with shapes as well as colours and the counts, and the
parameters it was produced with — so it still explains itself once pasted into
a report. The stream export stacks the true-scale flow and its magnified detail
panel into one image.

## Accessibility

Outcomes are distinguished by shape as well as colour (disc + tick, square +
cross, triangle, diamond), every control is labelled, the canvas has hover
readouts, and `prefers-reduced-motion` disables the animation.

## Deployment

Every push to `master` runs the test suite and, if it passes, builds and
publishes to GitHub Pages via `.github/workflows/deploy.yml`. The build sets
Vite's `base` to the project sub-path; the dev server keeps the root.

## Licence

MIT — see [LICENSE](LICENSE). Free to use, adapt and share in schools.

© 2026 [Richard Lipka](https://home.zcu.cz/~lipka/) &lt;lipka@fav.zcu.cz&gt;
Department of Computer Science and Engineering, Faculty of Applied Sciences,
University of West Bohemia.
