import { z } from "zod";

// ── Checklists ──────────────────────────────────────────────────

export const createChecklistSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  items: z.array(z.string().min(1).max(500)).min(1, "Добавьте хотя бы один пункт"),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  items: z.array(
    z.object({
      id: z.string().uuid().optional(),
      text: z.string().min(1).max(500),
    }),
  ).optional(),
});

// ── Assignments ─────────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(["TEXT", "FILE_UPLOAD", "TEST"]),
  maxScore: z.number().int().min(1).max(1000).default(100),
  isRequired: z.boolean().default(false),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  isRequired: z.boolean().optional(),
});

// ── Test questions ──────────────────────────────────────────────

export const createQuestionSchema = z.object({
  text: z.string().min(1).max(2000),
  explanation: z.string().max(2000).optional(),
  isMultiSelect: z.boolean().default(false),
  options: z.array(
    z.object({
      text: z.string().min(1).max(500),
      isCorrect: z.boolean(),
    }),
  ).min(2, "Минимум 2 варианта ответа"),
});

export const updateQuestionSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  explanation: z.string().max(2000).nullable().optional(),
  isMultiSelect: z.boolean().optional(),
  options: z.array(
    z.object({
      id: z.string().uuid().optional(),
      text: z.string().min(1).max(500),
      isCorrect: z.boolean(),
    }),
  ).min(2).optional(),
});

// ── Student submissions ─────────────────────────────────────────

export const textSubmissionSchema = z.object({
  textAnswer: z.string().min(1, "Ответ обязателен").max(10000),
});

export const testSubmissionSchema = z.object({
  answers: z.record(
    z.string().uuid(),
    z.array(z.string().uuid()),
  ),
});
