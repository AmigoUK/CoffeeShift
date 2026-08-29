/**
 * Dev/test-only time scale for the game clock (1 = real time). The playthrough
 * bot speeds the simulation up; production never sets it. All game-clock
 * consumers (brew, steam, patience, elapsed scoring) scale consistently.
 */
let scale = 1;

export function setTimeScale(value: number): void {
  scale = Math.max(0.1, Math.min(10, value));
}

export function getTimeScale(): number {
  return scale;
}
