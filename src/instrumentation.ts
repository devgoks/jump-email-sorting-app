export async function register() {
  if (process.env.INTERNAL_SYNC_CRON_ENABLED !== "true") return;

  // This file is loaded once per server process at startup.
  // We lazy import to keep the default startup path minimal.
  const { startInternalSyncCron } = await import("./lib/internal-sync-cron");
  startInternalSyncCron();
}




