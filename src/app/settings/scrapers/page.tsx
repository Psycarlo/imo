"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

type Config = Doc<"scraperConfigs">;
type PropertyType = "moradia" | "apartamento";
type Transaction = "comprar" | "arrendar";

interface Draft {
  enabled: boolean;
  transaction: Transaction;
  propertyTypes: PropertyType[];
  location: string;
  ownerType: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  pages: string;
}

function toDraft(c: Config): Draft {
  return {
    enabled: c.enabled,
    transaction: c.transaction,
    propertyTypes: c.propertyTypes,
    location: c.location.join(", "),
    ownerType: c.ownerType ?? "",
    priceMin: c.priceMin?.toString() ?? "",
    priceMax: c.priceMax?.toString() ?? "",
    areaMin: c.areaMin?.toString() ?? "",
    areaMax: c.areaMax?.toString() ?? "",
    pages: c.pages?.toString() ?? "",
  };
}

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export default function ScraperSettingsPage() {
  const configs = useQuery(api.scraperConfigs.list, {});
  const seed = useMutation(api.scraperConfigs.seed);
  const update = useMutation(api.scraperConfigs.update);
  const setEnabled = useMutation(api.scraperConfigs.setEnabled);

  const [drafts, setDrafts] = useState<Record<Id<"scraperConfigs">, Draft>>({});

  useEffect(() => {
    if (!configs) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const c of configs) {
        if (!next[c._id]) next[c._id] = toDraft(c);
      }
      return next;
    });
  }, [configs]);

  const sorted = useMemo(
    () => (configs ? [...configs].sort((a, b) => a.source.localeCompare(b.source)) : []),
    [configs]
  );

  function setDraft(id: Id<"scraperConfigs">, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(id: Id<"scraperConfigs">) {
    const d = drafts[id];
    if (!d) return;
    await update({
      id,
      enabled: d.enabled,
      transaction: d.transaction,
      propertyTypes: d.propertyTypes,
      location: d.location
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ownerType: d.ownerType.trim() || undefined,
      priceMin: parseNum(d.priceMin),
      priceMax: parseNum(d.priceMax),
      areaMin: parseNum(d.areaMin),
      areaMax: parseNum(d.areaMax),
      pages: parseNum(d.pages),
    });
  }

  function togglePropertyType(id: Id<"scraperConfigs">, type: PropertyType) {
    const d = drafts[id];
    if (!d) return;
    const has = d.propertyTypes.includes(type);
    setDraft(id, {
      propertyTypes: has
        ? d.propertyTypes.filter((t) => t !== type)
        : [...d.propertyTypes, type],
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Scraper Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Configure which sources run and their filters. Cron runs daily.
          </p>
        </div>
        {configs && configs.length === 0 && (
          <button
            onClick={() => seed({})}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Seed defaults
          </button>
        )}
      </div>

      {configs === undefined ? (
        <div className="py-20 text-center text-muted-foreground">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No configs yet. Click &ldquo;Seed defaults&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((c) => {
            const d = drafts[c._id];
            if (!d) return null;
            return (
              <div
                key={c._id}
                className="rounded-lg border bg-card p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => {
                          setDraft(c._id, { enabled: e.target.checked });
                          void setEnabled({ id: c._id, enabled: e.target.checked });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-lg font-semibold">{c.source}</span>
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        d.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {d.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSave(c._id)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Transaction">
                    <select
                      value={d.transaction}
                      onChange={(e) =>
                        setDraft(c._id, {
                          transaction: e.target.value as Transaction,
                        })
                      }
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="comprar">comprar</option>
                      <option value="arrendar">arrendar</option>
                    </select>
                  </Field>

                  <Field label="Property types">
                    <div className="flex gap-3">
                      {(["moradia", "apartamento"] as PropertyType[]).map((t) => (
                        <label
                          key={t}
                          className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={d.propertyTypes.includes(t)}
                            onChange={() => togglePropertyType(c._id, t)}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field
                    label="Location (comma-separated path segments)"
                    full
                  >
                    <input
                      value={d.location}
                      onChange={(e) =>
                        setDraft(c._id, { location: e.target.value })
                      }
                      placeholder="leiria, leiria"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>

                  <Field label="Owner type (imovirtual only)">
                    <input
                      value={d.ownerType}
                      onChange={(e) =>
                        setDraft(c._id, { ownerType: e.target.value })
                      }
                      placeholder="ALL | PRIVATE | AGENCY"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>

                  <Field label="Pages per type">
                    <input
                      type="number"
                      value={d.pages}
                      onChange={(e) =>
                        setDraft(c._id, { pages: e.target.value })
                      }
                      placeholder="3"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>

                  <Field label="Price min">
                    <input
                      type="number"
                      value={d.priceMin}
                      onChange={(e) =>
                        setDraft(c._id, { priceMin: e.target.value })
                      }
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field label="Price max">
                    <input
                      type="number"
                      value={d.priceMax}
                      onChange={(e) =>
                        setDraft(c._id, { priceMax: e.target.value })
                      }
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field label="Area min (m²)">
                    <input
                      type="number"
                      value={d.areaMin}
                      onChange={(e) =>
                        setDraft(c._id, { areaMin: e.target.value })
                      }
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field label="Area max (m²)">
                    <input
                      type="number"
                      value={d.areaMax}
                      onChange={(e) =>
                        setDraft(c._id, { areaMax: e.target.value })
                      }
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
