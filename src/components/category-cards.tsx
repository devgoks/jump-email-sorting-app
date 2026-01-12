"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type CategoryCardItem = {
  id: string;
  name: string;
  description: string;
};

function formatBadgeCount(n: number) {
  if (n > 99) return "99+";
  return String(n);
}

export function CategoryCards({ categories }: { categories: CategoryCardItem[] }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Read per-category "last seen" timestamps from localStorage.
      const lastSeenByCategoryId: Record<string, string | null> = {};
      try {
        for (const id of categoryIds) {
          lastSeenByCategoryId[id] =
            localStorage.getItem(`jump:lastSeenCategory:${id}`) ?? null;
        }
      } catch {
        // If storage is unavailable, fall back to counting all as "unread".
        for (const id of categoryIds) lastSeenByCategoryId[id] = null;
      }

      const res = await fetch("/api/categories/unread-counts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryIds, lastSeenByCategoryId }),
      }).catch(() => null);

      const json = await res?.json().catch(() => null);
      if (cancelled) return;

      if (!res?.ok) return;
      if (!json || typeof json !== "object") return;

      setCounts((json as any).counts ?? {});
    }

    if (categoryIds.length > 0) run();

    return () => {
      cancelled = true;
    };
  }, [categoryIds]);

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      {categories.length === 0 ? (
        <div className="text-sm text-zinc-600">
          No categories yet. Create your first one below.
        </div>
      ) : (
        categories.map((c) => {
          const n = counts[c.id] ?? 0;
          return (
            <Link
              key={c.id}
              href={`/dashboard/categories/${c.id}`}
              className="relative rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
            >
              {n > 0 ? (
                <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  {formatBadgeCount(n)} new
                </div>
              ) : null}

              <div className="text-sm font-semibold text-zinc-900">{c.name}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">
                {c.description}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}


