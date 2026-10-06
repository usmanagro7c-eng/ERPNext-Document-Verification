/**
 * Local-only record of the post-verification rating popup. Ratings are not
 * sent anywhere yet — the store exists so the popup shows at most once per
 * document, and so a backend can be attached later without touching the UI.
 */

const KEY_PREFIX = "verification:rating:";

export interface RatingRecord {
  /** 1-5 when submitted, null when the visitor skipped. */
  rating: number | null;
  comment: string;
  at: string;
}

export function readRating(hash: string): RatingRecord | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + hash);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatingRecord;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRating(hash: string, rating: number | null, comment: string): void {
  try {
    const record: RatingRecord = { rating, comment, at: new Date().toISOString() };
    localStorage.setItem(KEY_PREFIX + hash, JSON.stringify(record));
  } catch {
    /* private mode etc. — the popup simply shows again next time */
  }
}
