import { doctypeForPrefix } from "@/config/doctypePrefixes";

/**
 * Verification code format accepted from QR codes / manual entry, shared with
 * the server-side check so both ends agree on what a valid code is:
 *
 *   <32 hex>            legacy code, stored bare in `verification_data`
 *   <32 hex>            MD5-length / truncated HMAC
 *   <64 hex>            HMAC-SHA-256
 *   SIN-<32 hex>        prefixed — PREFIX names the doctype
 *
 * The prefix is what the printed QR carries. ERPNext stores the whole prefixed
 * string in `verification_data`, so a prefixed code only ever matches in its
 * full, upper-case-prefix form — see parseVerificationCode.
 *
 * The prefix is letters-only and the hash is hex-only, so neither can contain
 * the hyphen and splitting on it is unambiguous.
 */
const HASH_BODY = "[0-9a-f]{32}|[0-9a-f]{64}";
const CODE_PATTERN = new RegExp(`^(?:([A-Za-z]{1,10})-)?(${HASH_BODY})$`, "i");

export interface VerificationCode {
  /**
   * Normalised code, byte-for-byte the value ERPNext stores in
   * `verification_data` — prefix upper-cased, hash lower-cased. Always send
   * THIS, never the raw scan text, to the ERP filter.
   */
  code: string;
  /** Upper-cased prefix, or null for a legacy bare hash. */
  prefix: string | null;
  /** The doctype this prefix names, or undefined when absent/unrecognised. */
  doctype: string | undefined;
}

/**
 * Parses and normalises a verification code from any source.
 *
 * Normalisation is what makes the round trip safe: a visitor pasting
 * `sin-E006E6DC…` and one pasting `SIN-e006e6dc…` must both produce the single
 * string ERPNext actually holds, or the lookup would quietly miss. Returns null
 * when the text is not a code at all.
 */
export function parseVerificationCode(value: string): VerificationCode | null {
  const match = CODE_PATTERN.exec((value ?? "").trim());
  if (!match) return null;

  const prefix = match[1] ? match[1].toUpperCase() : null;
  const hash = match[2]?.toLowerCase();
  if (!hash) return null;

  return {
    code: prefix ? `${prefix}-${hash}` : hash,
    prefix,
    doctype: doctypeForPrefix(prefix),
  };
}

export function isLikelyHash(value: string): boolean {
  return CODE_PATTERN.test((value ?? "").trim());
}

/**
 * Extract a verification code from arbitrary QR content.
 * Supports:
 *   https://example.com/verify/SIN-<hash>
 *   https://example.com/verify?hash=SIN-<hash>
 *   SIN-<hash>
 * Returns null when nothing usable is found.
 */
export function extractVerificationHash(qrContent: string): string | null {
  const raw = (qrContent ?? "").trim();
  if (!raw) return null;

  /** Normalised code, or null when this fragment is not a code. */
  const codeOf = (value: string) => parseVerificationCode(value)?.code ?? null;

  // Try a real URL first.
  try {
    const url = new URL(raw);
    const queryHash =
      url.searchParams.get("hash") ??
      url.searchParams.get("verification_data") ??
      url.searchParams.get("code");
    const fromQuery = queryHash ? codeOf(queryHash) : null;
    if (fromQuery) return fromQuery;

    const segments = url.pathname.split("/").filter(Boolean);
    const verifyIndex = segments.lastIndexOf("verify");
    const candidate =
      verifyIndex >= 0 && segments[verifyIndex + 1]
        ? segments[verifyIndex + 1]
        : segments[segments.length - 1];
    if (candidate) {
      const fromPath = codeOf(safeDecode(candidate));
      if (fromPath) return fromPath;
    }
    return null;
  } catch {
    // Not a URL — fall through.
  }

  // Path-like or query-like fragment without a scheme.
  const queryMatch = raw.match(/[?&](?:hash|code|verification_data)=([^&\s]+)/i);
  if (queryMatch?.[1]) {
    const fromQuery = codeOf(safeDecode(queryMatch[1]));
    if (fromQuery) return fromQuery;
  }

  const pathMatch = raw.match(/verify\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    const fromPath = codeOf(safeDecode(pathMatch[1]));
    if (fromPath) return fromPath;
  }

  return codeOf(raw);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/** SIN-••••••••82fe */
export function maskHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 4)}${"•".repeat(8)}${hash.slice(-4)}`;
}
