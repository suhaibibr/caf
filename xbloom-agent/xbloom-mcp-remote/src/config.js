import path from "node:path";

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const defaultSessionFile =
  process.env.VERCEL || process.env.LAMBDA_TASK_ROOT
    ? "/tmp/xbloom-session.json"
    : "./session.json";
const resolvedSessionFile = path.resolve(process.cwd(), process.env.SESSION_FILE || defaultSessionFile);

export const config = {
  port: parsePositiveInt(process.env.PORT, 8787),
  logLevel: process.env.LOG_LEVEL || "info",
  sessionFile: resolvedSessionFile,
  sessionTtlSeconds: parsePositiveInt(process.env.SESSION_TTL_SECONDS, 60 * 60 * 24 * 30),
  sessionEncryptionSecret: process.env.SESSION_ENCRYPTION_SECRET || "dev-local-secret-change-me",
  sessionEncryptionSalt: process.env.SESSION_ENCRYPTION_SALT || "xbloom-local-session-v1",
  xbloomApiBase: process.env.XBLOOM_API_BASE || "https://client-api.xbloom.com",
  xbloomShareBase: process.env.XBLOOM_SHARE_BASE || "https://share-h5.xbloom.com"
};
