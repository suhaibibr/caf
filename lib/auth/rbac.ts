import type { AuthRole } from "@/lib/auth/constants";

export const RBAC_PERMISSIONS = {
  ADMIN_DASHBOARD_READ: "admin:dashboard:read",
  ADMIN_ROASTERS_MANAGE: "admin:roasters:manage",
  ADMIN_RECIPES_MANAGE: "admin:recipes:manage",
  ADMIN_ANALYTICS_READ: "admin:analytics:read",
  ADMIN_SETTINGS_MANAGE: "admin:settings:manage",
  ADMIN_USERS_MANAGE: "admin:users:manage",
  ADMIN_REPORTS_READ: "admin:reports:read",
  ADMIN_ACCOUNTS_MANAGE: "admin:accounts:manage",
} as const;

export type RbacPermission = (typeof RBAC_PERMISSIONS)[keyof typeof RBAC_PERMISSIONS];

const ADMIN_PERMISSION_SET = new Set<RbacPermission>(Object.values(RBAC_PERMISSIONS));
const USER_PERMISSION_SET = new Set<RbacPermission>();

export function hasPermission(role: AuthRole, permission: RbacPermission) {
  if (role === "admin") {
    return ADMIN_PERMISSION_SET.has(permission);
  }
  return USER_PERMISSION_SET.has(permission);
}
