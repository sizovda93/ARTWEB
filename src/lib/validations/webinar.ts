import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export const createWebinarSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  slug: z.string().min(1).max(200).regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис"),
  description: z.string().max(5000).optional(),
  scheduledAt: z.string().datetime(),
  streamUrl: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  courseId: z.string().uuid().nullable().optional(),
  coverPath: z.string().max(500).optional(),
  maxAttendees: z.number().int().min(1).nullable().optional(),
});

export const updateWebinarSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис").optional(),
  description: z.string().max(5000).nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
  streamUrl: z.string().max(1000).nullable().optional(),
  recordingPath: z.string().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
  courseId: z.string().uuid().nullable().optional(),
  coverPath: z.string().max(500).nullable().optional(),
  maxAttendees: z.number().int().min(1).nullable().optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]),
});
