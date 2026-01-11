"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

export type CategoryEmailListItem = {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  createdAtIso: string;
  summary: string | null;
  snippet: string | null;
};

export function CategoryEmailList({
  items,
}: {
  items: CategoryEmailListItem[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  function toggleAll() {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const i of items) next[i.id] = true;
    setSelected(next);
  }

  async function post(path: string) {
    setLastResult(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailIds: selectedIds }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "request_failed");
    return json;
  }

  function bulkTrash() {
    startTransition(async () => {
      try {
        const json = await post("/api/emails/bulk-trash");
        setLastResult(`Trash done: ${JSON.stringify(json.results)}`);
        setSelected({});
        window.location.reload();
      } catch (e) {
        setLastResult(`Trash failed: ${String(e)}`);
      }
    });
  }

  function bulkUnsubscribe() {
    startTransition(async () => {
      try {
        const json = await post("/api/emails/bulk-unsubscribe");
        setLastResult(`Unsubscribe done: ${JSON.stringify(json.results)}`);
        setSelected({});
      } catch (e) {
        setLastResult(`Unsubscribe failed: ${String(e)}`);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            onClick={toggleAll}
            disabled={items.length === 0 || isPending}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
          <div className="text-xs text-zinc-600">
            Selected: {selectedIds.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            disabled={selectedIds.length === 0 || isPending}
            onClick={bulkUnsubscribe}
          >
            Unsubscribe
          </button>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={selectedIds.length === 0 || isPending}
            onClick={bulkTrash}
          >
            Delete (Trash)
          </button>
        </div>
      </div>

      {lastResult ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
          {lastResult}
        </pre>
      ) : null}

      <div className="mt-4 divide-y divide-zinc-100">
        {items.map((e) => {
          const checked = !!selected[e.id];
          return (
            <div key={e.id} className="py-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checked}
                  onChange={() =>
                    setSelected((s) => ({ ...s, [e.id]: !checked }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/emails/${e.id}`}
                    className="block truncate text-sm font-semibold text-zinc-900 hover:underline"
                  >
                    {e.subject ?? "(no subject)"}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
                    <span>{e.fromEmail ?? "unknown sender"}</span>
                    <span className="text-zinc-400">·</span>
                    <span>{e.createdAtIso}</span>
                  </div>
                  <div className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700">
                    {e.summary ?? e.snippet ?? ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



