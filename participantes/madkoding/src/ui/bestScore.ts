// ─── Best score (per-browser convenience; storage may be unavailable) ───────

const KEY = 'foxstar.best';

export function getBestScore(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Stores the score if it beats the record. Returns true on a new record. */
export function submitScore(score: number): boolean {
  if (score <= getBestScore()) return false;
  try {
    localStorage.setItem(KEY, String(score));
  } catch {
    // Private mode / blocked storage: the record just won't persist.
  }
  return true;
}
