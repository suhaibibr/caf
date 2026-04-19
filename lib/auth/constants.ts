export const AUTH_COOKIE_NAME = "caf_admin_auth";

export const AUTH_ROLE_ADMIN = "admin";
export const AUTH_ROLE_USER = "user";
export type AuthRole = typeof AUTH_ROLE_ADMIN | typeof AUTH_ROLE_USER;

export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
export const REMEMBER_ME_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const SESSION_IDLE_TIMEOUT_SECONDS = 60 * 60 * 4; // 4 hours

export const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = 20;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL = 10;

export const ACCOUNT_LOCK_MAX_FAILED_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MINUTES = 15;
export const AUTH_MAX_EMAIL_LENGTH = 191;
export const AUTH_MAX_PASSWORD_LENGTH = 128;
export const AUTH_MIN_PASSWORD_LENGTH = 10;
export const LOGIN_ATTEMPTS_RETENTION_DAYS = 30;
export const SECURITY_EVENTS_RETENTION_DAYS = 90;
export const ADMIN_AUDIT_RETENTION_DAYS = 180;

export const SECURITY_EVENT_INFO = "info";
export const SECURITY_EVENT_WARNING = "warning";
export const SECURITY_EVENT_CRITICAL = "critical";
export type SecurityEventSeverity =
  | typeof SECURITY_EVENT_INFO
  | typeof SECURITY_EVENT_WARNING
  | typeof SECURITY_EVENT_CRITICAL;

export const ADMIN_COOKIE_PATH = "/";

export type AuthTokenPayload = {
  uid: number;
  role: AuthRole;
  sid: string;
  iat: number;
  exp: number;
};

export function getAuthTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET is required.");
  }
  return secret;
}
