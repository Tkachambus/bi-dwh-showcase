import { loadSnapshot } from './db';
import { buildOverview, parseState } from './engine';
import type { DashboardState, OverviewData, Snapshot } from './types';

export interface OverviewResult {
  snapshot: Snapshot;
  state: DashboardState;
  data: OverviewData;
}

export function getOverview(searchParams: URLSearchParams): OverviewResult {
  const snapshot = loadSnapshot();
  const state = parseState(searchParams, snapshot);
  const data = buildOverview(snapshot, state);
  return { snapshot, state, data };
}
