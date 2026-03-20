import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export const createKnowledgeItemSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  slug: z.string().min(1).max(200).regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис"),
  type: z.enum(["DOCUMENT", "TEMPLATE", "WEBINAR_RECORDING"]),
  description: z.string().max(5000).optional(),
  content: z.string().optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).default([]),
  minAccessTier: z.enum(["BASIC", "STANDARD", "PARTNER"]).default("BASIC"),
  filePath: z.string().max(500).optional(),
  videoPath: z.string().max(500).optional(),
});

export const updateKnowledgeItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис").optional(),
  type: z.enum(["DOCUMENT", "TEMPLATE", "WEBINAR_RECORDING"]).optional(),
  description: z.string().max(5000).nullable().optional(),
  content: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  minAccessTier: z.enum(["BASIC", "STANDARD", "PARTNER"]).optional(),
  filePath: z.string().max(500).nullable().optional(),
  videoPath: z.string().max(500).nullable().optional(),
});

export const publishKnowledgeItemSchema = z.object({
  isPublished: z.boolean(),
});
