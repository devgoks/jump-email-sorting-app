import { syncAllUsersInboxes } from "@/lib/sync-all-users";

declare global {
  // eslint-disable-next-line no-var
  var __jumpInternalSyncCron:
    | {
        started: boolean;
        running: boolean;
        stop: () => void;
      }
    | undefined;
}

function readIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function startInternalSyncCron() {
  if (process.env.INTERNAL_SYNC_CRON_ENABLED !== "true") {
    return;
  }

  if (globalThis.__jumpInternalSyncCron?.started) {
    return;
  }

  const intervalMs = readIntEnv("INTERNAL_SYNC_CRON_INTERVAL_MS", 5000);
  const maxPerInbox = readIntEnv("INTERNAL_SYNC_CRON_MAX_PER_INBOX", 10);

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const state = {
    started: true,
    running: false,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
  globalThis.__jumpInternalSyncCron = state;

  async function tick() {
    if (stopped) return;
    if (state.running) {
      timer = setTimeout(tick, intervalMs);
      return;
    }

    state.running = true;
    try {
      const results = await syncAllUsersInboxes({ maxPerInbox });
      const ok = results.filter((r) => "inboxes" in r).length;
      const failed = results.filter((r) => "error" in r).length;
      console.log("[internal-sync-cron] tick", { ok, failed });
    } catch (e) {
      console.error("[internal-sync-cron] tick failed", e);
    } finally {
      state.running = false;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  }

  // Run once immediately, then keep scheduling.
  void tick();
}


