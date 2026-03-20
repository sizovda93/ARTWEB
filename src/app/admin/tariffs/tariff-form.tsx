"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface TariffFeatureInput {
  feature: "KNOWLEDGE_BASE_ACCESS" | "AI_CHAT_ACCESS";
  config?: Record<string, unknown>;
}

export interface TariffFormData {
  id?: string;
  name: string;
  slug: string;
  tier: "BASIC" | "STANDARD" | "PARTNER";
  description: string;
  price: number;
  oldPrice: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  features: TariffFeatureInput[];
}

const EMPTY: TariffFormData = {
  name: "",
  slug: "",
  tier: "BASIC",
  description: "",
  price: 0,
  oldPrice: null,
  currency: "RUB",
  isActive: true,
  sortOrder: 0,
  features: [],
};

interface TariffFormProps {
  initial?: TariffFormData;
  mode: "create" | "edit";
}

export function TariffForm({ initial, mode }: TariffFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TariffFormData>(initial ?? EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TariffFormData>(key: K, value: TariffFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/g, "-")
      .replace(/^-|-$/g, "")
      .replace(/[а-яё]/g, "");
  }

  function toggleFeature(feature: TariffFeatureInput["feature"]) {
    setForm((prev) => {
      const exists = prev.features.find((f) => f.feature === feature);
      if (exists) {
        return { ...prev, features: prev.features.filter((f) => f.feature !== feature) };
      }
      return { ...prev, features: [...prev.features, { feature }] };
    });
  }

  function updateFeatureConfig(
    feature: TariffFeatureInput["feature"],
    key: string,
    value: number,
  ) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((f) =>
        f.feature === feature ? { ...f, config: { ...f.config, [key]: value } } : f,
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...form,
      oldPrice: form.oldPrice || undefined,
      features: form.features.map((f) => ({
        feature: f.feature,
        config: f.config && Object.keys(f.config).length > 0 ? f.config : undefined,
      })),
    };

    const url =
      mode === "create"
        ? "/api/admin/tariffs"
        : `/api/admin/tariffs/${form.id}`;

    const result = await apiClient(url, {
      method: mode === "create" ? "POST" : "PUT",
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    if (mode === "create") {
      const data = result.data as { tariff: { id: string } };
      router.push(`/admin/tariffs/${data.tariff.id}`);
    } else {
      router.refresh();
    }
  }

  const hasKb = form.features.some((f) => f.feature === "KNOWLEDGE_BASE_ACCESS");
  const hasAi = form.features.some((f) => f.feature === "AI_CHAT_ACCESS");
  const aiConfig = form.features.find((f) => f.feature === "AI_CHAT_ACCESS")?.config as
    | { dailyLimit?: number; monthlyLimit?: number }
    | undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Название" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (mode === "create") set("slug", autoSlug(e.target.value));
            }}
            className={INPUT}
            required
          />
        </Field>
        <Field label="Slug" required>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            className={INPUT}
            pattern="^[a-z0-9-]+$"
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Тариф (tier)" required>
          <select
            value={form.tier}
            onChange={(e) => set("tier", e.target.value as TariffFormData["tier"])}
            className={INPUT}
          >
            <option value="BASIC">Basic</option>
            <option value="STANDARD">Standard</option>
            <option value="PARTNER">Partner</option>
          </select>
        </Field>
        <Field label="Цена" required>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => set("price", Number(e.target.value))}
            className={INPUT}
            required
          />
        </Field>
        <Field label="Старая цена">
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.oldPrice ?? ""}
            onChange={(e) =>
              set("oldPrice", e.target.value ? Number(e.target.value) : null)
            }
            className={INPUT}
            placeholder="опционально"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Валюта">
          <input
            type="text"
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Сортировка">
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="Статус">
          <select
            value={form.isActive ? "active" : "inactive"}
            onChange={(e) => set("isActive", e.target.value === "active")}
            className={INPUT}
          >
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </Field>
      </div>

      <Field label="Описание">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={INPUT}
        />
      </Field>

      {/* Features */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-gray-700 px-2">Фичи тарифа</legend>
        <div className="space-y-3 mt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasKb}
              onChange={() => toggleFeature("KNOWLEDGE_BASE_ACCESS")}
              className="rounded border-gray-300"
            />
            База знаний (KNOWLEDGE_BASE_ACCESS)
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasAi}
              onChange={() => toggleFeature("AI_CHAT_ACCESS")}
              className="rounded border-gray-300"
            />
            AI-чат (AI_CHAT_ACCESS)
          </label>

          {hasAi && (
            <div className="ml-6 grid grid-cols-2 gap-3">
              <Field label="Дневной лимит AI">
                <input
                  type="number"
                  min={0}
                  value={aiConfig?.dailyLimit ?? ""}
                  onChange={(e) =>
                    updateFeatureConfig(
                      "AI_CHAT_ACCESS",
                      "dailyLimit",
                      Number(e.target.value),
                    )
                  }
                  className={INPUT}
                  placeholder="0 = без лимита"
                />
              </Field>
              <Field label="Месячный лимит AI">
                <input
                  type="number"
                  min={0}
                  value={aiConfig?.monthlyLimit ?? ""}
                  onChange={(e) =>
                    updateFeatureConfig(
                      "AI_CHAT_ACCESS",
                      "monthlyLimit",
                      Number(e.target.value),
                    )
                  }
                  className={INPUT}
                  placeholder="0 = без лимита"
                />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading
            ? "Сохранение..."
            : mode === "create"
              ? "Создать тариф"
              : "Сохранить изменения"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
