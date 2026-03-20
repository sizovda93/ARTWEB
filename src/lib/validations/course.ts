import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export const createCourseSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис"),
  description: z.string().max(5000).optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(SLUG_REGEX, "Slug: только a-z, 0-9, дефис")
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  coverPath: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const publishToggleSchema = z.object({
  isPublished: z.boolean(),
});

export const createModuleSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
});

export const updateModuleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1, "Название обязательно").max(200),
  type: z.enum(["VIDEO", "TEXT", "MIXED"]).default("MIXED"),
});

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(["VIDEO", "TEXT", "MIXED"]).optional(),
  content: z.string().nullable().optional(),
  videoPath: z.string().max(500).nullable().optional(),
  videoDuration: z.number().int().min(0).nullable().optional(),
  isFree: z.boolean().optional(),
  requiresAssignment: z.boolean().optional(),
  coverPath: z.string().max(500).nullable().optional(),
});

export const lessonReorderSchema = z.object({
  moduleId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});
