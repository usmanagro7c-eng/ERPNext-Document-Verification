/**
 * Hash format accepted from QR codes / manual entry, and shared with the
 * server-side check so both ends agree on what a valid code is:
 *   32 hex chars (MD5-length / truncated HMAC) or 64 hex chars (HMAC-SHA-256).
 */
const HASH_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/;

export function isLikelyHash(value: string): boolean {
  return HASH_PATTERN.test(value.trim().toLowerCase());
}

/**
 * Extract a verification hash from arbitrary QR content.
 * Supports:
 *   https://example.com/verify/<hash>
 *   https://example.com/verify?hash=<hash>
 *   <hash>
 * Returns null when nothing usable is found.
 */
export function extractVerificationHash(qrContent: string): string | null {
  const raw = (qrContent ?? "").trim();
  if (!raw) return null;

  // Try a real URL first.
  try {
    const url = new URL(raw);
    const queryHash =
      url.searchParams.get("hash") ??
      url.searchParams.get("verification_data") ??
      url.searchParams.get("code");
    if (queryHash && isLikelyHash(queryHash)) return queryHash.trim();

    const segments = url.pathname.split("/").filter(Boolean);
    const verifyIndex = segments.lastIndexOf("verify");
    const candidate =
      verifyIndex >= 0 && segments[verifyIndex + 1]
        ? segments[verifyIndex + 1]
        : segments[segments.length - 1];
    if (candidate) {
      const decoded = safeDecode(candidate);
      if (isLikelyHash(decoded)) return decoded;
    }
    return null;
  } catch {
    // Not a URL — fall through.
  }

  // Path-like or query-like fragment without a scheme.
  const queryMatch = raw.match(/[?&](?:hash|code|verification_data)=([^&\s]+)/i);
  if (queryMatch?.[1]) {
    const decoded = safeDecode(queryMatch[1]);
    if (isLikelyHash(decoded)) return decoded;
  }

  const pathMatch = raw.match(/verify\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    const decoded = safeDecode(pathMatch[1]);
    if (isLikelyHash(decoded)) return decoded;
  }

  return isLikelyHash(raw) ? raw : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/** a91f••••••••7c42 */
export function maskHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 4)}${"•".repeat(8)}${hash.slice(-4)}`;
}
