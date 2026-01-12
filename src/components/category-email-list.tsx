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
  importStatus: "IMPORTED" | "ARCHIVED" | "TRASHED" | "UNSUBSCRIBED";
};

export function CategoryEmailList({
  items,
}: {
  items: CategoryEmailListItem[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<null | "unsubscribe" | "trash">(
    null
  );

  const itemById = useMemo(() => {
    const m = new Map<string, CategoryEmailListItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

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
    setActiveAction("trash");
    startTransition(async () => {
      try {
        const json = await post("/api/emails/bulk-trash");
        setLastResult(`Trash done: ${JSON.stringify(json.results)}`);
        setSelected({});
        window.location.reload();
      } catch (e) {
        setLastResult(`Trash failed: ${String(e)}`);
      } finally {
        setActiveAction(null);
      }
    });
  }

  function bulkUnsubscribe() {
    setLastResult(null);
    setActiveAction("unsubscribe");
    startTransition(async () => {
      try {
        const json = await post("/api/emails/bulk-unsubscribe");
        // Full results are useful for debugging; keep UI concise.
        // eslint-disable-next-line no-console
        console.log("bulk-unsubscribe response:", json);

        const results: Array<{ id: string; ok: boolean }> = Array.isArray(
          json?.results
        )
          ? json.results
          : [];

        const okIds = results.filter((r) => r?.ok === true).map((r) => r.id);
        const failedIds = results.filter((r) => r?.ok === false).map((r) => r.id);
        const success = okIds.length;
        const failed = failedIds.length;

        const okSubjects = okIds.map(
          (id) => itemById.get(id)?.subject ?? "(no subject)"
        );
        const failedSubjects = failedIds.map(
          (id) => itemById.get(id)?.subject ?? "(no subject)"
        );

        setLastResult(
          [
            `Unsubscribe Mail Processing Done — successful: ${success}, failed: ${failed}`,
            "",
            "Successful Unsubscribed Emails (subjects):",
            okSubjects.length ? okSubjects.map((s) => `- ${s}`).join("\n") : "- (none)",
            "",
            "Failed Unsubscribed Emails (subjects):",
            failedSubjects.length
              ? failedSubjects.map((s) => `- ${s}`).join("\n")
              : "- (none)",
          ].join("\n")
        );
        setSelected({});
      } catch (e) {
        setLastResult(`Unsubscribe failed: ${String(e)}`);
      } finally {
        setActiveAction(null);
      }
    });
  }

  function statusLabel(s: CategoryEmailListItem["importStatus"]) {
    switch (s) {
      case "IMPORTED":
        return "Imported";
      case "ARCHIVED":
        return "Archived";
      case "TRASHED":
        return "Trashed";
      case "UNSUBSCRIBED":
        return "Unsubscribed";
      default:
        return s;
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-white hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 disabled:opacity-50"
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
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 disabled:opacity-50"
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

      {isPending && activeAction === "unsubscribe" ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <svg
            className="h-4 w-4 animate-spin text-blue-700"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <div className="font-medium">Unsubscribe is processing…</div>
          <div className="text-xs text-blue-800/80">
            Please keep this tab open.
          </div>
        </div>
      ) : null}

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
                    <span className="text-zinc-400">·</span>
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {statusLabel(e.importStatus)}
                    </span>
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



