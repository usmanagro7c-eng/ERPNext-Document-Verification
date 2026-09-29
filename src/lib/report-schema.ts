import { z } from "zod";

/** 4 MB — base64 inflates by ~4/3, so ~5.4 MB travels through the server fn. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * Frappe's own upload allowlist is narrow ("You can only upload JPG, PNG, GIF,
 * PDF, TXT, CSV or Microsoft documents"), so we restrict the picker to a
 * conservative subset instead of letting ERPNext reject it with a raw error.
 */
export const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;

/** Submissions faster than this are treated as automated. */
export const MIN_FILL_MS = 2000;

const MOBILE_PATTERN = /^[0-9+\s()-]+$/;

/**
 * Shared by the browser and the Worker so the two can never disagree about what
 * a valid submission looks like. Deliberately excludes the base64 payload: a
 * character-by-character check over a multi-megabyte string is not worth running
 * twice, so `reportProxy` validates that on its own.
 */
export const reportQuerySchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(140, "Name is too long."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address.")
    .max(254, "Email address is too long."),
  mobile: z
    .string()
    .trim()
    .min(7, "Please enter a contact number.")
    .max(20, "Contact number is too long.")
    .regex(MOBILE_PATTERN, "Please enter a valid contact number."),
  hash: z.string().trim().max(200),
  reason: z.string().trim().max(60),
  pageUrl: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(),
  fillMs: z.number().optional(),
  attachment: z
    .object({
      base64: z.string().min(1, "The file appears to be empty."),
      fileName: z.string().trim().min(1).max(180, "File name is too long."),
      mimeType: z.enum(ALLOWED_ATTACHMENT_TYPES, {
        errorMap: () => ({ message: "Only PDF, JPG and PNG files are accepted." }),
      }),
      size: z
        .number()
        .int()
        .positive()
        .max(MAX_ATTACHMENT_BYTES, "The file must be 4 MB or smaller."),
    })
    .nullish(),
});

export type ReportQueryForm = z.infer<typeof reportQuerySchema>;

/** Maps the first failing field onto the field key the UI understands. */
export function firstInvalidField(
  issues: z.ZodIssue[],
): "name" | "email" | "mobile" | "attachment" | undefined {
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key === "name" || key === "email" || key === "mobile" || key === "attachment") {
      return key;
    }
  }
  return undefined;
}
