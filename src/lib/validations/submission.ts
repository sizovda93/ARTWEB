import { z } from "zod";

export const reviewSubmissionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  finalScore: z.number().int().min(0).max(1000).nullable().optional(),
  finalComment: z.string().max(5000).nullable().optional(),
});
