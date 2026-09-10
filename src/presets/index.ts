/*
 * Conditional Probability Explorer - bundled scenario files
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import rareDisease from './rare-disease.json';
import commonDisease from './common-disease.json';
import roadsideDrugTest from './roadside-drug-test.json';
import confirmatoryTesting from './confirmatory-testing.json';
import massScreening from './mass-screening.json';
import airportAi from './airport-ai.json';
import lazyTest from './lazy-test.json';
import { parseScenario, type Scenario } from '../lib/scenario';

const files: unknown[] = [
  rareDisease,
  commonDisease,
  roadsideDrugTest,
  confirmatoryTesting,
  massScreening,
  airportAi,
  lazyTest,
];

/** Every bundled scenario, validated on the way in. */
export const scenarios: Scenario[] = files
  .map(parseScenario)
  .filter((s): s is Scenario => s !== null);

export const defaultScenario = scenarios[0];

export function scenarioById(id: string | undefined): Scenario | undefined {
  return id ? scenarios.find((s) => s.id === id) : undefined;
}

export type { Scenario };
