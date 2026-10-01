import { createContext, use, useMemo, useState, type ReactNode } from "react";

/**
 * Shown instead of the company name when no issuer is known — the portal has
 * not matched a document yet, or the lookup failed. Wording stays neutral so
 * the portal never implies a verifier it cannot name.
 *
 * This is the *default* state, not a fallback: the portal verifies documents
 * from several ERPNext sites belonging to different companies, so until a site
 * answers there is no company to name. Naming the first configured site instead
 * would tell a visitor that a document issued by one company was checked
 * against another's records.
 */
export const BRAND_FALLBACK = "the issuing organisation";

type CompanyContextValue = {
  /** Null until a site has answered a verification, and null again on leaving. */
  companyName: string | null;
  /** Company name or the neutral fallback, trimmed for use mid-sentence. */
  brand: string;
  /** Publishes the issuer of a verified document, or null to clear it. */
  setCompanyName: (name: string | null) => void;
};

const CompanyContext = createContext<CompanyContextValue>({
  companyName: null,
  brand: BRAND_FALLBACK,
  setCompanyName: () => {},
});

export function useCompanyName(): CompanyContextValue {
  return use(CompanyContext);
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState<string | null>(null);

  const value = useMemo<CompanyContextValue>(
    () => ({ companyName, brand: companyName ?? BRAND_FALLBACK, setCompanyName }),
    [companyName],
  );

  return <CompanyContext value={value}>{children}</CompanyContext>;
}
