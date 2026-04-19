import { acquireMaintenanceTaskRun } from "@/lib/maintenance-db";
import {
  cleanupAuthLogs,
  cleanupExpiredAuthSessions,
  logSecurityEvent,
} from "@/lib/auth-db";
import { SECURITY_EVENT_WARNING } from "@/lib/auth/constants";

const LOG_CLEANUP_TASK_NAME = "log_cleanup";
const LOG_CLEANUP_INTERVAL_MINUTES = 60 * 6; // every 6 hours

let inProcessRun: Promise<void> | null = null;

export async function runPeriodicLogCleanup() {
  if (inProcessRun) {
    return inProcessRun;
  }

  inProcessRun = (async () => {
    try {
      const canRun = await acquireMaintenanceTaskRun(
        LOG_CLEANUP_TASK_NAME,
        LOG_CLEANUP_INTERVAL_MINUTES,
      );
      if (!canRun) {
        return;
      }

      await cleanupExpiredAuthSessions();
      await cleanupAuthLogs();
    } catch (error) {
      try {
        await logSecurityEvent({
          eventType: "maintenance.log_cleanup_failed",
          severity: SECURITY_EVENT_WARNING,
          details: {
            message: error instanceof Error ? error.message : "Unknown cleanup error",
          },
        });
      } catch (logError) {
        console.error("Failed to record maintenance cleanup failure.", {
          cleanupError: error instanceof Error ? error.message : String(error),
          logError: logError instanceof Error ? logError.message : String(logError),
        });
      }
    }
  })().finally(() => {
    inProcessRun = null;
  });

  return inProcessRun;
}
