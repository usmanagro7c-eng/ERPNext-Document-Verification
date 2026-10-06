import { z } from "zod";

/** Submissions faster than this are treated as automated. */
export const MIN_FILL_MS = 1500;

/**
 * Shared by the browser and the Worker so the two can never disagree about what
 * a valid query looks like.
 */
export const createQuerySchema = z.object({
  hash: z.string().trim().min(1).max(200),
  siteId: z.string().trim().max(60).optional(),
  doctype: z.string().trim().min(1).max(140),
  docname: z.string().trim().min(1).max(140),
  customer: z.string().trim().max(140).optional(),
  description: z
    .string()
    .trim()
    .min(10, "Please describe your query in at least a few words.")
    .max(5000, "Description is too long."),
  pageUrl: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(),
  fillMs: z.number().optional(),
});

export type CreateQueryForm = z.infer<typeof createQuerySchema>;
