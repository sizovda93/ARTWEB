import { prisma } from "./prisma";
import type { AccessResourceType, AccessTier } from "@/generated/prisma/client";

// ─── Tier ordering for KB access checks ──────────────────────────

const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PARTNER: 2,
};

/** Active + not expired filter fragment. */
function activeGrantWhere() {
  return {
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

// ─── Resource Access Checks ──────────────────────────────────────

/**
 * Check if user has an active AccessGrant for a resource.
 * This is the lowest-level check — all other checks delegate here.
 */
export async function checkResourceAccess(
  userId: string,
  resourceType: AccessResourceType,
  resourceId?: string | null,
): Promise<boolean> {
  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId,
      resourceType,
      resourceId: resourceId ?? null,
      ...activeGrantWhere(),
    },
    select: { id: true },
  });
  return grant !== null;
}

/**
 * Check access to a specific course.
 */
export async function checkCourseAccess(
  userId: string,
  courseId: string,
): Promise<boolean> {
  return checkResourceAccess(userId, "COURSE", courseId);
}

/**
 * Check access to a lesson.
 * lesson.isFree = true → accessible without AccessGrant.
 * Otherwise → requires AccessGrant on parent course.
 */
export async function checkLessonAccess(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isFree: true,
      module: { select: { courseId: true } },
    },
  });
  if (!lesson) return false;
  if (lesson.isFree) return true;
  return checkCourseAccess(userId, lesson.module.courseId);
}

/**
 * Check access to a knowledge base item.
 * Requires AccessGrant(KNOWLEDGE_BASE) with tier >= item.minAccessTier.
 */
export async function checkKnowledgeBaseAccess(
  userId: string,
  knowledgeItemId: string,
): Promise<boolean> {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: knowledgeItemId },
    select: { minAccessTier: true, isPublished: true },
  });
  if (!item || !item.isPublished) return false;

  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId,
      resourceType: "KNOWLEDGE_BASE",
      resourceId: null,
      ...activeGrantWhere(),
    },
    select: { tier: true },
  });
  if (!grant?.tier) return false;

  return TIER_ORDER[grant.tier] >= TIER_ORDER[item.minAccessTier];
}

/**
 * Check access to AI chat.
 */
export async function checkAiChatAccess(userId: string): Promise<boolean> {
  return checkResourceAccess(userId, "AI_CHAT");
}

// ─── AI Embedding Filter ─────────────────────────────────────────
// CRITICAL RULE: AI/RAG retrieval must NEVER return embeddings
// the user doesn't have access to — even in general chat scope.

/**
 * Get course IDs the user currently has access to.
 */
export async function getAccessibleCourseIds(
  userId: string,
): Promise<string[]> {
  const grants = await prisma.accessGrant.findMany({
    where: {
      userId,
      resourceType: "COURSE",
      ...activeGrantWhere(),
    },
    select: { resourceId: true },
  });
  return grants
    .map((g) => g.resourceId)
    .filter((id): id is string => id !== null);
}

/**
 * Build a Prisma WHERE filter for ai_embeddings that respects user's access.
 *
 * Rules:
 * - LESSON embeddings: only for courses the user has access to
 * - KNOWLEDGE_ITEM embeddings: only if user has KB access + tier matches
 * - If courseId provided: scope to that course only (must have access)
 * - General chat (no courseId): accessible lessons + accessible KB items
 * - No access at all → returns impossible filter (matches nothing)
 *
 * Usage:
 *   const filter = await getAiEmbeddingFilter(userId, courseId);
 *   const chunks = await prisma.aiEmbedding.findMany({ where: filter });
 */
export async function getAiEmbeddingFilter(
  userId: string,
  courseId?: string,
): Promise<Record<string, unknown>> {
  const accessibleCourseIds = await getAccessibleCourseIds(userId);

  // If specific course requested, verify access
  const courseIds = courseId
    ? accessibleCourseIds.filter((id) => id === courseId)
    : accessibleCourseIds;

  // Get lesson IDs for accessible courses
  const lessons =
    courseIds.length > 0
      ? await prisma.lesson.findMany({
          where: { module: { courseId: { in: courseIds } } },
          select: { id: true },
        })
      : [];

  const orConditions: Array<Record<string, unknown>> = [];

  if (lessons.length > 0) {
    orConditions.push({
      sourceType: "LESSON",
      sourceId: { in: lessons.map((l) => l.id) },
    });
  }

  // KB embeddings only in general chat (not course-scoped)
  if (!courseId) {
    const grant = await prisma.accessGrant.findFirst({
      where: {
        userId,
        resourceType: "KNOWLEDGE_BASE",
        resourceId: null,
        ...activeGrantWhere(),
      },
      select: { tier: true },
    });

    if (grant?.tier) {
      const accessibleTiers = Object.entries(TIER_ORDER)
        .filter(([, order]) => order <= TIER_ORDER[grant.tier!])
        .map(([tier]) => tier) as AccessTier[];

      const kbItems = await prisma.knowledgeItem.findMany({
        where: { isPublished: true, minAccessTier: { in: accessibleTiers } },
        select: { id: true },
      });

      if (kbItems.length > 0) {
        orConditions.push({
          sourceType: "KNOWLEDGE_ITEM",
          sourceId: { in: kbItems.map((i) => i.id) },
        });
      }
    }
  }

  // No access → impossible filter (matches nothing)
  if (orConditions.length === 0) {
    return { id: "00000000-0000-0000-0000-000000000000" };
  }

  return { OR: orConditions };
}
