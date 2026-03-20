"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

interface GrantRow {
  id: string;
  resourceType: "COURSE" | "KNOWLEDGE_BASE" | "AI_CHAT";
  resourceId: string | null;
  resourceTitle: string | null;
  grantedVia: string;
  tier: string | null;
  tariffName: string | null;
  isActive: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface CourseOption {
  id: string;
  title: string;
}

interface UserAccessGrantsProps {
  userId: string;
  courses: CourseOption[];
}

const RESOURCE_LABELS: Record<string, string> = {
  COURSE: "Курс",
  KNOWLEDGE_BASE: "База знаний",
  AI_CHAT: "AI-чат",
};

const SOURCE_LABELS: Record<string, string> = {
  ADMIN_GRANT: "Вручную",
  PURCHASE: "Покупка",
  PROMO_CODE: "Промокод",
};

export function UserAccessGrants({ userId, courses }: UserAccessGrantsProps) {
  const router = useRouter();
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New grant form
  const [resourceType, setResourceType] = useState<"COURSE" | "KNOWLEDGE_BASE" | "AI_CHAT">("COURSE");
  const [courseId, setCourseId] = useState("");
  const [tier, setTier] = useState("");

  const fetchGrants = useCallback(async () => {
    const result = await apiClient<{ grants: GrantRow[] }>(
      `/api/admin/access-grants?userId=${userId}`,
    );
    if (result.ok) {
      setGrants(result.data.grants);
    }
    setLoadingGrants(false);
  }, [userId]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      userId,
      resourceType,
    };
    if (resourceType === "COURSE") {
      if (!courseId) {
        setError("Выберите курс");
        setActionLoading(false);
        return;
      }
      payload.resourceId = courseId;
    }
    if (resourceType === "KNOWLEDGE_BASE" && tier) {
      payload.tier = tier;
    }

    const result = await apiClient("/api/admin/access-grants", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setActionLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setCourseId("");
    setTier("");
    await fetchGrants();
    router.refresh();
  }

  async function handleRevoke(grantId: string) {
    if (!window.confirm("Отозвать этот доступ?")) return;
    setActionLoading(true);
    setError(null);

    const result = await apiClient("/api/admin/access-grants", {
      method: "DELETE",
      body: JSON.stringify({ grantId }),
    });

    setActionLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    await fetchGrants();
    router.refresh();
  }

  const activeGrants = grants.filter((g) => g.isActive);
  const revokedGrants = grants.filter((g) => !g.isActive);

  return (
    <div className={actionLoading ? "opacity-50 pointer-events-none" : ""}>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Grant form */}
      <form onSubmit={handleGrant} className="flex flex-wrap gap-2 mb-4">
        <select
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value as typeof resourceType);
            setCourseId("");
            setTier("");
          }}
          className={SELECT}
        >
          <option value="COURSE">Курс</option>
          <option value="KNOWLEDGE_BASE">База знаний</option>
          <option value="AI_CHAT">AI-чат</option>
        </select>

        {resourceType === "COURSE" && (
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={SELECT}>
            <option value="">Выберите курс...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}

        {resourceType === "KNOWLEDGE_BASE" && (
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={SELECT}>
            <option value="">Без tier</option>
            <option value="BASIC">Basic</option>
            <option value="STANDARD">Standard</option>
            <option value="PARTNER">Partner</option>
          </select>
        )}

        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Выдать доступ
        </button>
      </form>

      {/* Active grants */}
      {loadingGrants ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : activeGrants.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">Нет активных доступов</p>
      ) : (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Активные</p>
          {activeGrants.map((g) => (
            <GrantItem key={g.id} grant={g} onRevoke={() => handleRevoke(g.id)} />
          ))}
        </div>
      )}

      {/* Revoked grants */}
      {revokedGrants.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs font-medium text-gray-400 cursor-pointer">
            Отозванные ({revokedGrants.length})
          </summary>
          <div className="space-y-2 mt-2">
            {revokedGrants.map((g) => (
              <GrantItem key={g.id} grant={g} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function GrantItem({
  grant,
  onRevoke,
}: {
  grant: GrantRow;
  onRevoke?: () => void;
}) {
  const label =
    grant.resourceType === "COURSE"
      ? grant.resourceTitle ?? grant.resourceId ?? "Курс"
      : RESOURCE_LABELS[grant.resourceType];

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={grant.isActive ? "success" : "neutral"}>
          {RESOURCE_LABELS[grant.resourceType]}
        </Badge>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {grant.tier && (
          <Badge variant="info">{grant.tier}</Badge>
        )}
        <span className="text-xs text-gray-400">
          {SOURCE_LABELS[grant.grantedVia] ?? grant.grantedVia}
        </span>
        {grant.tariffName && (
          <span className="text-xs text-gray-400">· {grant.tariffName}</span>
        )}
        {grant.expiresAt && (
          <span className="text-xs text-gray-400">
            до {new Date(grant.expiresAt).toLocaleDateString("ru-RU")}
          </span>
        )}
        {grant.revokedAt && (
          <span className="text-xs text-red-400">
            отозван {new Date(grant.revokedAt).toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>
      {grant.isActive && onRevoke && (
        <button
          onClick={onRevoke}
          className="text-xs text-red-600 hover:text-red-800 whitespace-nowrap ml-2"
        >
          Отозвать
        </button>
      )}
    </div>
  );
}

const SELECT =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";
