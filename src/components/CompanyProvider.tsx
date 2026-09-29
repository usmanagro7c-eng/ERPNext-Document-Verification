import { useQuery } from "@tanstack/react-query";
import { createContext, use, type ReactNode } from "react";
import { companyProfileServer } from "@/services/companyProxy";

/**
 * Shown instead of the company name when it cannot be read — the ERP is down,
 * unconfigured, or the API user cannot see the Company doctype. Wording stays
 * neutral so the portal never implies a verifier it cannot name.
 */
export const BRAND_FALLBACK = "the issuing organisation";

type CompanyContextValue = {
  /** Null until resolved, and permanently null if the lookup fails. */
  companyName: string | null;
  /** Company name or the neutral fallback, trimmed for use mid-sentence. */
  brand: string;
};

const CompanyContext = createContext<CompanyContextValue>({
  companyName: null,
  brand: BRAND_FALLBACK,
});

export function useCompanyName(): CompanyContextValue {
  return use(CompanyContext);
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  // The company name changes rarely and the server caches it too, so a long
  // staleTime keeps this off the critical path for every visitor.
  const { data } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => companyProfileServer({ data: {} }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const companyName = data?.companyName?.trim() || null;
  const value: CompanyContextValue = {
    companyName,
    brand: companyName ?? BRAND_FALLBACK,
  };

  return <CompanyContext value={value}>{children}</CompanyContext>;
}
