/** Whole-number completion percentage. Only 100 when everything is done. */
export function percentOf(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((completed / total) * 100));
}
