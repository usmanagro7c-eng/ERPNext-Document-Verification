import { useCompanyName } from "@/components/CompanyProvider";

/**
 * Copyright line for the site footers.
 *
 * The holder is the company the portal is operated for, read from the ERP's
 * Global Defaults, so renaming the company updates this without a redeploy.
 * It deliberately does not use `brand`: that falls back to the phrase "the
 * issuing organisation", which reads wrongly in a copyright notice because a
 * copyright belongs to a legal entity.
 *
 * The year is rendered rather than baked in, so the line never goes stale.
 * `&copy;` is used instead of a literal © because this codebase already has
 * one non-ASCII comment that got mangled, and a pure-ASCII source file is
 * easier to keep that way.
 */
export function CopyrightLine() {
  const { companyName } = useCompanyName();
  const holder = companyName || "Document Verification Portal";

  return (
    <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
      &copy; {new Date().getFullYear()} {holder}. All rights reserved.
    </p>
  );
}
