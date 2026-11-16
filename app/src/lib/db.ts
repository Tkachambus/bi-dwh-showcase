import fs from 'node:fs';
import path from 'node:path';
import type { Snapshot } from './types';

let cached: Snapshot | null = null;

function snapshotPath(): string {
  const candidates = [
    path.join(process.cwd(), 'public', 'data', 'snapshot.json'),
    path.join(process.cwd(), 'app', 'public', 'data', 'snapshot.json'),
  ];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) {
    throw new Error(
      'snapshot.json not found. Run `npm run snapshot` (with the database up) before starting the app.',
    );
  }
  return found;
}

export function loadSnapshot(): Snapshot {
  if (cached) return cached;
  const file = snapshotPath();
  cached = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
  return cached;
}

export function resetSnapshotCache(): void {
  cached = null;
}
