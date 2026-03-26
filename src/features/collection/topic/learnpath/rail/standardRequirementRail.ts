export const RAIL_STATES = [
  'intro',
  'explain_core',
  'explain_detail',
  'check_short',
  'reinforce',
  'check_final',
  'requirement_complete',
] as const;

export type RailState = (typeof RAIL_STATES)[number];

export const RAIL_STATE_LABELS: Record<RailState, string> = {
  intro: 'Einfuehrung',
  explain_core: 'Kernidee',
  explain_detail: 'Details',
  check_short: 'Zwischenabfrage',
  reinforce: 'Vertiefung',
  check_final: 'Abschlussfrage',
  requirement_complete: 'Abgeschlossen',
};

export const STANDARD_REQUIREMENT_RAIL: Record<RailState, RailState[]> = {
  intro: ['explain_core'],
  explain_core: ['explain_core', 'explain_detail'],
  explain_detail: ['explain_detail', 'check_short'],
  check_short: ['check_short', 'reinforce'],
  reinforce: ['reinforce', 'check_final'],
  check_final: ['check_final', 'requirement_complete'],
  requirement_complete: [],
};

const USER_INPUT_STATES = new Set<RailState>(['check_short', 'check_final']);

export function getAllowedNextRailStates(state: RailState): RailState[] {
  return STANDARD_REQUIREMENT_RAIL[state];
}

export function isRailState(value: unknown): value is RailState {
  return typeof value === 'string' && RAIL_STATES.includes(value as RailState);
}

export function isUserInputRailState(state: RailState): boolean {
  return USER_INPUT_STATES.has(state);
}

export function getRailStepNumber(state: RailState): number {
  return RAIL_STATES.indexOf(state) + 1;
}
