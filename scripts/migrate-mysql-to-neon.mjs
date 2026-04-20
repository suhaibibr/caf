import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { Pool as PgPool } from "pg";

function loadEnvFiles() {
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const index = line.indexOf("=");
      if (index <= 0) {
        continue;
      }
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseBooleanEnv(value) {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseArgBoolean(name) {
  const prefixed = `--${name}=`;
  const exact = process.argv.find((arg) => arg === `--${name}`);
  if (exact) {
    return true;
  }
  const withValue = process.argv.find((arg) => arg.startsWith(prefixed));
  if (!withValue) {
    return false;
  }
  return parseBooleanEnv(withValue.slice(prefixed.length)) ?? false;
}

function parseArgValue(name) {
  const prefixed = `--${name}=`;
  const withValue = process.argv.find((arg) => arg.startsWith(prefixed));
  if (withValue) {
    return withValue.slice(prefixed.length).trim();
  }

  const exactIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (exactIndex === -1) {
    return "";
  }
  return String(process.argv[exactIndex + 1] ?? "").trim();
}

function normalizeSslMode(mode) {
  return String(mode ?? "").trim().toUpperCase();
}

function getMysqlSslConfig(modeInput, caInput, rejectUnauthorizedInput) {
  const mode = normalizeSslMode(modeInput);
  if (!mode || ["DISABLED", "OFF", "NONE"].includes(mode)) {
    return undefined;
  }

  const explicitRejectUnauthorized = parseBooleanEnv(rejectUnauthorizedInput);
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? (mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY");
  const ca = caInput ? String(caInput).replace(/\\n/g, "\n") : undefined;

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

function maskValue(value) {
  if (!value) {
    return "";
  }
  const raw = String(value);
  if (raw.length <= 4) {
    return "*".repeat(raw.length);
  }
  return `${"*".repeat(Math.max(3, raw.length - 4))}${raw.slice(-4)}`;
}

function quoteMysqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function toSmallIntFlag(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return numberValue ? 1 : 0;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toDateOrNow(value) {
  if (value instanceof Date) {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return new Date();
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const utcParsed = new Date(value.replace(" ", "T") + "Z");
    if (!Number.isNaN(utcParsed.getTime())) {
      return utcParsed;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function toDateOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const utcParsed = new Date(value.replace(" ", "T") + "Z");
    if (!Number.isNaN(utcParsed.getTime())) {
      return utcParsed;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function createTableSpec(definition) {
  const conflictSql = definition.conflictColumns?.length
    ? definition.updateColumns?.length
      ? `ON CONFLICT (${definition.conflictColumns
          .map(quotePgIdentifier)
          .join(", ")}) DO UPDATE SET ${definition.updateColumns
          .map((column) => `${quotePgIdentifier(column)} = EXCLUDED.${quotePgIdentifier(column)}`)
          .join(", ")}`
      : `ON CONFLICT (${definition.conflictColumns.map(quotePgIdentifier).join(", ")}) DO NOTHING`
    : "";

  return {
    ...definition,
    conflictSql,
  };
}

const TABLE_SPECS = [
  createTableSpec({
    name: "roasters",
    orderBy: "slug",
    columns: [
      "slug",
      "name",
      "short_name",
      "description",
      "about",
      "location",
      "logo",
      "cover_image",
      "accent",
      "featured",
      "created_at",
      "updated_at",
    ],
    conflictColumns: ["slug"],
    updateColumns: [
      "name",
      "short_name",
      "description",
      "about",
      "location",
      "logo",
      "cover_image",
      "accent",
      "featured",
      "created_at",
      "updated_at",
    ],
    mapRow: (row) => [
      String(row.slug ?? "").trim(),
      String(row.name ?? "").trim(),
      String(row.short_name ?? "").trim(),
      String(row.description ?? ""),
      String(row.about ?? ""),
      String(row.location ?? ""),
      String(row.logo ?? ""),
      String(row.cover_image ?? ""),
      String(row.accent ?? ""),
      toSmallIntFlag(row.featured),
      toDateOrNow(row.created_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "recipes",
    orderBy: "slug",
    columns: [
      "slug",
      "name",
      "author_name",
      "is_roaster_approved",
      "brewer",
      "grams",
      "ice_grams",
      "pour_count",
      "first_pour_temperature",
      "pour_profile_json",
      "ratio_text",
      "water_ml",
      "roaster_slug",
      "roaster_name",
      "merge_group_key",
      "brew_type",
      "xbloom_url",
      "created_at",
      "updated_at",
    ],
    conflictColumns: ["slug"],
    updateColumns: [
      "name",
      "author_name",
      "is_roaster_approved",
      "brewer",
      "grams",
      "ice_grams",
      "pour_count",
      "first_pour_temperature",
      "pour_profile_json",
      "ratio_text",
      "water_ml",
      "roaster_slug",
      "roaster_name",
      "merge_group_key",
      "brew_type",
      "xbloom_url",
      "created_at",
      "updated_at",
    ],
    mapRow: (row) => [
      String(row.slug ?? "").trim(),
      String(row.name ?? "").trim(),
      String(row.author_name ?? "").trim(),
      toSmallIntFlag(row.is_roaster_approved),
      String(row.brewer ?? "").trim(),
      toNumberOrNull(row.grams) ?? 0,
      toIntOrNull(row.ice_grams),
      toIntOrNull(row.pour_count),
      toNumberOrNull(row.first_pour_temperature),
      row.pour_profile_json === null || row.pour_profile_json === undefined
        ? null
        : String(row.pour_profile_json),
      String(row.ratio_text ?? "").trim(),
      toIntOrNull(row.water_ml),
      row.roaster_slug === null || row.roaster_slug === undefined
        ? null
        : String(row.roaster_slug),
      row.roaster_name === null || row.roaster_name === undefined
        ? null
        : String(row.roaster_name),
      row.merge_group_key === null || row.merge_group_key === undefined
        ? null
        : String(row.merge_group_key),
      String(row.brew_type ?? "hot"),
      String(row.xbloom_url ?? ""),
      toDateOrNow(row.created_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "recipe_submissions",
    orderBy: "id",
    serialColumn: "id",
    columns: [
      "id",
      "name",
      "author_name",
      "grams",
      "ice_grams",
      "pour_count",
      "first_pour_temperature",
      "pour_profile_json",
      "brewer",
      "ratio_input",
      "roaster_slug",
      "roaster_name",
      "brew_type",
      "xbloom_url",
      "submitter_ip",
      "status",
      "created_at",
      "reviewed_at",
      "reviewed_by",
    ],
    conflictColumns: ["id"],
    updateColumns: [
      "name",
      "author_name",
      "grams",
      "ice_grams",
      "pour_count",
      "first_pour_temperature",
      "pour_profile_json",
      "brewer",
      "ratio_input",
      "roaster_slug",
      "roaster_name",
      "brew_type",
      "xbloom_url",
      "submitter_ip",
      "status",
      "created_at",
      "reviewed_at",
      "reviewed_by",
    ],
    mapRow: (row) => [
      toIntOrNull(row.id),
      String(row.name ?? "").trim(),
      String(row.author_name ?? "").trim(),
      toNumberOrNull(row.grams) ?? 0,
      toIntOrNull(row.ice_grams),
      toIntOrNull(row.pour_count),
      toNumberOrNull(row.first_pour_temperature),
      row.pour_profile_json === null || row.pour_profile_json === undefined
        ? null
        : String(row.pour_profile_json),
      String(row.brewer ?? "").trim(),
      String(row.ratio_input ?? "").trim(),
      row.roaster_slug === null || row.roaster_slug === undefined
        ? null
        : String(row.roaster_slug),
      row.roaster_name === null || row.roaster_name === undefined
        ? null
        : String(row.roaster_name),
      String(row.brew_type ?? "hot"),
      String(row.xbloom_url ?? ""),
      String(row.submitter_ip ?? "unknown"),
      String(row.status ?? "pending"),
      toDateOrNow(row.created_at),
      toDateOrNull(row.reviewed_at),
      toIntOrNull(row.reviewed_by),
    ],
  }),
  createTableSpec({
    name: "xbloom_recipe_clicks",
    orderBy: "recipe_slug",
    columns: ["recipe_slug", "click_count", "created_at", "updated_at"],
    conflictColumns: ["recipe_slug"],
    updateColumns: ["click_count", "created_at", "updated_at"],
    mapRow: (row) => [
      String(row.recipe_slug ?? "").trim(),
      toIntOrNull(row.click_count) ?? 0,
      toDateOrNow(row.created_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "site_metrics_counter",
    orderBy: "id",
    columns: ["id", "total_visits", "updated_at"],
    conflictColumns: ["id"],
    updateColumns: ["total_visits", "updated_at"],
    mapRow: (row) => [
      toIntOrNull(row.id) ?? 1,
      toIntOrNull(row.total_visits) ?? 0,
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "site_metrics_presence",
    orderBy: "session_id",
    columns: ["session_id", "last_seen", "created_at"],
    conflictColumns: ["session_id"],
    updateColumns: ["last_seen", "created_at"],
    mapRow: (row) => [
      String(row.session_id ?? "").trim(),
      toDateOrNow(row.last_seen),
      toDateOrNow(row.created_at),
    ],
  }),
  createTableSpec({
    name: "site_metrics_visited_sessions",
    orderBy: "session_id",
    columns: ["session_id", "created_at"],
    conflictColumns: ["session_id"],
    updateColumns: ["created_at"],
    mapRow: (row) => [String(row.session_id ?? "").trim(), toDateOrNow(row.created_at)],
  }),
  createTableSpec({
    name: "maintenance_tasks",
    orderBy: "task_name",
    columns: ["task_name", "last_run_at", "updated_at"],
    conflictColumns: ["task_name"],
    updateColumns: ["last_run_at", "updated_at"],
    mapRow: (row) => [
      String(row.task_name ?? "").trim(),
      toDateOrNow(row.last_run_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "auth_users",
    orderBy: "id",
    serialColumn: "id",
    columns: [
      "id",
      "email",
      "password_hash",
      "role",
      "is_active",
      "is_super_admin",
      "must_change_password",
      "failed_login_attempts",
      "locked_until",
      "last_login_at",
      "created_at",
      "updated_at",
    ],
    conflictColumns: ["id"],
    updateColumns: [
      "email",
      "password_hash",
      "role",
      "is_active",
      "is_super_admin",
      "must_change_password",
      "failed_login_attempts",
      "locked_until",
      "last_login_at",
      "created_at",
      "updated_at",
    ],
    mapRow: (row) => [
      toIntOrNull(row.id),
      String(row.email ?? "").trim().toLowerCase(),
      String(row.password_hash ?? ""),
      String(row.role ?? "user"),
      toSmallIntFlag(row.is_active, 1),
      toSmallIntFlag(row.is_super_admin, 0),
      toSmallIntFlag(row.must_change_password, 0),
      toIntOrNull(row.failed_login_attempts) ?? 0,
      toDateOrNull(row.locked_until),
      toDateOrNull(row.last_login_at),
      toDateOrNow(row.created_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "auth_sessions",
    orderBy: "session_id",
    columns: [
      "session_id",
      "user_id",
      "remember_me",
      "ip_address",
      "user_agent",
      "issued_at",
      "last_seen_at",
      "expires_at",
      "revoked_at",
      "revoke_reason",
      "created_at",
      "updated_at",
    ],
    conflictColumns: ["session_id"],
    updateColumns: [
      "user_id",
      "remember_me",
      "ip_address",
      "user_agent",
      "issued_at",
      "last_seen_at",
      "expires_at",
      "revoked_at",
      "revoke_reason",
      "created_at",
      "updated_at",
    ],
    mapRow: (row) => [
      String(row.session_id ?? "").trim(),
      toIntOrNull(row.user_id),
      toSmallIntFlag(row.remember_me, 0),
      String(row.ip_address ?? "unknown"),
      String(row.user_agent ?? ""),
      toDateOrNow(row.issued_at),
      toDateOrNow(row.last_seen_at),
      toDateOrNow(row.expires_at),
      toDateOrNull(row.revoked_at),
      row.revoke_reason === null || row.revoke_reason === undefined
        ? null
        : String(row.revoke_reason),
      toDateOrNow(row.created_at),
      toDateOrNow(row.updated_at),
    ],
  }),
  createTableSpec({
    name: "auth_login_attempts",
    orderBy: "id",
    serialColumn: "id",
    columns: [
      "id",
      "email_normalized",
      "ip_address",
      "user_agent",
      "was_success",
      "reason",
      "created_at",
    ],
    conflictColumns: ["id"],
    updateColumns: [
      "email_normalized",
      "ip_address",
      "user_agent",
      "was_success",
      "reason",
      "created_at",
    ],
    mapRow: (row) => [
      toIntOrNull(row.id),
      row.email_normalized === null || row.email_normalized === undefined
        ? null
        : String(row.email_normalized),
      String(row.ip_address ?? "unknown"),
      String(row.user_agent ?? ""),
      toSmallIntFlag(row.was_success, 0),
      String(row.reason ?? "unknown"),
      toDateOrNow(row.created_at),
    ],
  }),
  createTableSpec({
    name: "security_events",
    orderBy: "id",
    serialColumn: "id",
    columns: [
      "id",
      "user_id",
      "event_type",
      "severity",
      "path",
      "method",
      "ip_address",
      "user_agent",
      "details_json",
      "created_at",
    ],
    conflictColumns: ["id"],
    updateColumns: [
      "user_id",
      "event_type",
      "severity",
      "path",
      "method",
      "ip_address",
      "user_agent",
      "details_json",
      "created_at",
    ],
    mapRow: (row) => [
      toIntOrNull(row.id),
      toIntOrNull(row.user_id),
      String(row.event_type ?? "unknown"),
      String(row.severity ?? "info"),
      row.path === null || row.path === undefined ? null : String(row.path),
      row.method === null || row.method === undefined ? null : String(row.method),
      row.ip_address === null || row.ip_address === undefined ? null : String(row.ip_address),
      row.user_agent === null || row.user_agent === undefined ? null : String(row.user_agent),
      row.details_json === null || row.details_json === undefined
        ? null
        : String(row.details_json),
      toDateOrNow(row.created_at),
    ],
  }),
  createTableSpec({
    name: "admin_audit_logs",
    orderBy: "id",
    serialColumn: "id",
    columns: [
      "id",
      "admin_user_id",
      "action",
      "resource_type",
      "resource_id",
      "path",
      "method",
      "ip_address",
      "user_agent",
      "details_json",
      "created_at",
    ],
    conflictColumns: ["id"],
    updateColumns: [
      "admin_user_id",
      "action",
      "resource_type",
      "resource_id",
      "path",
      "method",
      "ip_address",
      "user_agent",
      "details_json",
      "created_at",
    ],
    mapRow: (row) => [
      toIntOrNull(row.id),
      toIntOrNull(row.admin_user_id),
      String(row.action ?? "unknown"),
      String(row.resource_type ?? "unknown"),
      row.resource_id === null || row.resource_id === undefined ? null : String(row.resource_id),
      row.path === null || row.path === undefined ? null : String(row.path),
      row.method === null || row.method === undefined ? null : String(row.method),
      row.ip_address === null || row.ip_address === undefined ? null : String(row.ip_address),
      row.user_agent === null || row.user_agent === undefined ? null : String(row.user_agent),
      row.details_json === null || row.details_json === undefined
        ? null
        : String(row.details_json),
      toDateOrNow(row.created_at),
    ],
  }),
];

const PG_SCHEMA_SQL = [
  `
    CREATE TABLE IF NOT EXISTS roasters (
      slug VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      short_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      about TEXT NOT NULL,
      location VARCHAR(255) NOT NULL,
      logo VARCHAR(32) NOT NULL,
      cover_image TEXT NOT NULL,
      accent VARCHAR(32) NOT NULL,
      featured SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_roasters_updated_created ON roasters (updated_at, created_at)`,
  `
    CREATE TABLE IF NOT EXISTS recipes (
      slug VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      is_roaster_approved SMALLINT NOT NULL DEFAULT 0,
      brewer VARCHAR(255) NOT NULL,
      grams NUMERIC(8,2) NOT NULL,
      ice_grams INT NULL,
      pour_count INT NULL,
      first_pour_temperature NUMERIC(6,2) NULL,
      pour_profile_json TEXT NULL,
      ratio_text VARCHAR(64) NOT NULL,
      water_ml INT NULL,
      roaster_slug VARCHAR(191) NULL,
      roaster_name VARCHAR(255) NULL,
      merge_group_key VARCHAR(191) NULL,
      brew_type VARCHAR(16) NOT NULL CHECK (brew_type IN ('hot', 'cold', 'filter')),
      xbloom_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_recipes_roaster_slug ON recipes (roaster_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_updated_created ON recipes (updated_at, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes (created_at)`,
  `
    CREATE TABLE IF NOT EXISTS recipe_submissions (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      grams NUMERIC(8,2) NOT NULL,
      ice_grams INT NULL,
      pour_count INT NULL,
      first_pour_temperature NUMERIC(6,2) NULL,
      pour_profile_json TEXT NULL,
      brewer VARCHAR(255) NOT NULL,
      ratio_input VARCHAR(128) NOT NULL,
      roaster_slug VARCHAR(191) NULL,
      roaster_name VARCHAR(255) NULL,
      brew_type VARCHAR(16) NOT NULL CHECK (brew_type IN ('hot', 'cold')),
      xbloom_url TEXT NOT NULL,
      submitter_ip VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reviewed', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMPTZ NULL,
      reviewed_by BIGINT NULL
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_recipe_submissions_status ON recipe_submissions (status)`,
  `CREATE INDEX IF NOT EXISTS idx_recipe_submissions_created_at ON recipe_submissions (created_at)`,
  `
    CREATE TABLE IF NOT EXISTS xbloom_recipe_clicks (
      recipe_slug VARCHAR(191) NOT NULL PRIMARY KEY,
      click_count BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_xbloom_clicks_rank ON xbloom_recipe_clicks (click_count, updated_at)`,
  `
    CREATE TABLE IF NOT EXISTS site_metrics_counter (
      id SMALLINT NOT NULL PRIMARY KEY,
      total_visits BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS site_metrics_presence (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS site_metrics_visited_sessions (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      task_name VARCHAR(64) NOT NULL PRIMARY KEY,
      last_run_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      is_active SMALLINT NOT NULL DEFAULT 1,
      is_super_admin SMALLINT NOT NULL DEFAULT 0,
      must_change_password SMALLINT NOT NULL DEFAULT 0,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ NULL,
      last_login_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_super_admin SMALLINT NOT NULL DEFAULT 0`,
  `ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password SMALLINT NOT NULL DEFAULT 0`,
  `
    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      remember_me SMALLINT NOT NULL DEFAULT 0,
      ip_address VARCHAR(64) NOT NULL,
      user_agent VARCHAR(512) NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL,
      revoke_reason VARCHAR(191) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id) REFERENCES auth_users(id)
        ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked_at ON auth_sessions (revoked_at)`,
  `
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id BIGSERIAL PRIMARY KEY,
      email_normalized VARCHAR(191) NULL,
      ip_address VARCHAR(64) NOT NULL,
      user_agent VARCHAR(512) NOT NULL,
      was_success SMALLINT NOT NULL DEFAULT 0,
      reason VARCHAR(191) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_created_at ON auth_login_attempts (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_created ON auth_login_attempts (ip_address, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_created ON auth_login_attempts (email_normalized, created_at)`,
  `
    CREATE TABLE IF NOT EXISTS security_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NULL,
      event_type VARCHAR(64) NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      path VARCHAR(255) NULL,
      method VARCHAR(16) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      details_json TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events (event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events (user_id)`,
  `
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      admin_user_id BIGINT NOT NULL,
      action VARCHAR(64) NOT NULL,
      resource_type VARCHAR(64) NOT NULL,
      resource_id VARCHAR(191) NULL,
      path VARCHAR(255) NULL,
      method VARCHAR(16) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      details_json TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_admin_audit_logs_user
        FOREIGN KEY (admin_user_id) REFERENCES auth_users(id)
        ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs (admin_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs (action)`,
];

async function ensurePgSchema(pgPool) {
  for (const sql of PG_SCHEMA_SQL) {
    await pgPool.query(sql);
  }
}

async function mysqlTableExists(sourceConn, sourceDatabase, tableName) {
  const [rows] = await sourceConn.execute(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
      LIMIT 1
    `,
    [sourceDatabase, tableName],
  );
  return Boolean(rows?.[0]);
}

function decodeMysqlEscapedChar(char) {
  switch (char) {
    case "0":
      return "\0";
    case "b":
      return "\b";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "Z":
      return "\u001a";
    default:
      return char;
  }
}

function extractInsertStatements(sqlText) {
  const statements = [];
  let searchIndex = 0;

  while (true) {
    const start = sqlText.indexOf("INSERT INTO `", searchIndex);
    if (start === -1) {
      break;
    }

    let inSingleQuote = false;
    let escaped = false;
    let end = -1;

    for (let index = start; index < sqlText.length; index += 1) {
      const char = sqlText[index];

      if (inSingleQuote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "'") {
          inSingleQuote = false;
        }
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        continue;
      }

      if (char === ";") {
        end = index;
        break;
      }
    }

    if (end === -1) {
      throw new Error("Unterminated INSERT statement found in SQL dump.");
    }

    statements.push(sqlText.slice(start, end + 1));
    searchIndex = end + 1;
  }

  return statements;
}

function parseSqlStringLiteral(text, startIndex) {
  let index = startIndex + 1;
  let value = "";

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      const next = text[index + 1];
      if (next === undefined) {
        index += 1;
        break;
      }
      value += decodeMysqlEscapedChar(next);
      index += 2;
      continue;
    }

    if (char === "'") {
      if (text[index + 1] === "'") {
        value += "'";
        index += 2;
        continue;
      }
      return {
        value,
        nextIndex: index + 1,
      };
    }

    value += char;
    index += 1;
  }

  throw new Error("Unterminated SQL string literal in INSERT values.");
}

function parseUnquotedToken(token) {
  const normalized = token.trim();
  if (normalized === "") {
    return "";
  }
  if (normalized.toUpperCase() === "NULL") {
    return null;
  }
  if (/^-?\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  if (/^-?\d+\.\d+$/.test(normalized)) {
    return Number.parseFloat(normalized);
  }
  return normalized;
}

function parseInsertValues(valuesSql) {
  const rows = [];
  let index = 0;

  while (index < valuesSql.length) {
    while (
      index < valuesSql.length &&
      [" ", "\n", "\r", "\t", ","].includes(valuesSql[index])
    ) {
      index += 1;
    }

    if (index >= valuesSql.length) {
      break;
    }

    if (valuesSql[index] !== "(") {
      index += 1;
      continue;
    }

    index += 1;
    const row = [];

    while (index < valuesSql.length) {
      while (
        index < valuesSql.length &&
        [" ", "\n", "\r", "\t"].includes(valuesSql[index])
      ) {
        index += 1;
      }

      if (index >= valuesSql.length) {
        throw new Error("Unexpected end while parsing INSERT row.");
      }

      let value;
      if (valuesSql[index] === "'") {
        const parsed = parseSqlStringLiteral(valuesSql, index);
        value = parsed.value;
        index = parsed.nextIndex;
      } else {
        let tokenEnd = index;
        while (
          tokenEnd < valuesSql.length &&
          valuesSql[tokenEnd] !== "," &&
          valuesSql[tokenEnd] !== ")"
        ) {
          tokenEnd += 1;
        }
        value = parseUnquotedToken(valuesSql.slice(index, tokenEnd));
        index = tokenEnd;
      }

      row.push(value);

      while (
        index < valuesSql.length &&
        [" ", "\n", "\r", "\t"].includes(valuesSql[index])
      ) {
        index += 1;
      }

      if (valuesSql[index] === ",") {
        index += 1;
        continue;
      }
      if (valuesSql[index] === ")") {
        index += 1;
        break;
      }

      throw new Error("Malformed INSERT value list in SQL dump.");
    }

    rows.push(row);
  }

  return rows;
}

function parseSqlDumpInserts(sqlText) {
  const statements = extractInsertStatements(sqlText);
  const rowsByTable = new Map();

  for (const statement of statements) {
    const match = statement.match(
      /^INSERT INTO\s+`([^`]+)`\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*);$/i,
    );
    if (!match) {
      continue;
    }

    const tableName = match[1];
    const columns = [...match[2].matchAll(/`([^`]+)`/g)].map((part) => part[1]);
    const tuples = parseInsertValues(match[3]);

    const current = rowsByTable.get(tableName) ?? [];
    for (const tuple of tuples) {
      const row = {};
      for (let index = 0; index < columns.length; index += 1) {
        row[columns[index]] = tuple[index] ?? null;
      }
      current.push(row);
    }
    rowsByTable.set(tableName, current);
  }

  return rowsByTable;
}

function buildInsertSql(spec, rowCount) {
  const columnSql = spec.columns.map(quotePgIdentifier).join(", ");
  const valuesParts = [];
  let parameterIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const placeholderRow = [];
    for (let columnIndex = 0; columnIndex < spec.columns.length; columnIndex += 1) {
      parameterIndex += 1;
      placeholderRow.push(`$${parameterIndex}`);
    }
    valuesParts.push(`(${placeholderRow.join(", ")})`);
  }

  return `
    INSERT INTO ${quotePgIdentifier(spec.name)} (${columnSql})
    VALUES ${valuesParts.join(", ")}
    ${spec.conflictSql}
  `;
}

async function resetSerialSequence(pgPool, tableName, columnName) {
  const sql = `
    SELECT setval(
      pg_get_serial_sequence('${tableName}', '${columnName}'),
      COALESCE((SELECT MAX(${quotePgIdentifier(columnName)}) FROM ${quotePgIdentifier(tableName)}), 0) + 1,
      false
    )
  `;
  await pgPool.query(sql);
}

async function copyTable({
  sourceConn,
  sourceDatabase,
  pgPool,
  spec,
  batchSize,
  dryRun,
}) {
  const exists = await mysqlTableExists(sourceConn, sourceDatabase, spec.name);
  if (!exists) {
    console.log(`- ${spec.name}: skipped (table not found in source)`);
    return { copied: 0, skipped: true };
  }

  const tableSql = quoteMysqlIdentifier(spec.name);
  const [countRows] = await sourceConn.query(
    `SELECT COUNT(*) AS total FROM ${tableSql}`,
  );
  const total = Number(countRows?.[0]?.total ?? 0);
  if (total === 0) {
    console.log(`- ${spec.name}: 0 rows`);
    return { copied: 0, skipped: false };
  }

  if (dryRun) {
    console.log(`- ${spec.name}: ${total} rows (dry-run)`);
    return { copied: total, skipped: false };
  }

  let copied = 0;
  for (let offset = 0; offset < total; offset += batchSize) {
    const [rows] = await sourceConn.query(
      `SELECT * FROM ${tableSql} ORDER BY ${quoteMysqlIdentifier(spec.orderBy)} LIMIT ? OFFSET ?`,
      [batchSize, offset],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    const mappedRows = rows.map((row) => spec.mapRow(row));
    const values = mappedRows.flat();
    const insertSql = buildInsertSql(spec, mappedRows.length);
    await pgPool.query(insertSql, values);
    copied += mappedRows.length;
  }

  if (spec.serialColumn) {
    await resetSerialSequence(pgPool, spec.name, spec.serialColumn);
  }

  console.log(`- ${spec.name}: copied ${copied}/${total}`);
  return { copied, skipped: false };
}

async function copyTableFromDump({
  dumpRowsByTable,
  pgPool,
  spec,
  batchSize,
  dryRun,
}) {
  const rows = dumpRowsByTable.get(spec.name) ?? [];
  const total = rows.length;

  if (total === 0) {
    console.log(`- ${spec.name}: 0 rows`);
    return { copied: 0, skipped: false };
  }

  if (dryRun) {
    console.log(`- ${spec.name}: ${total} rows (dry-run)`);
    return { copied: total, skipped: false };
  }

  let copied = 0;
  for (let offset = 0; offset < total; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const mappedRows = batch.map((row) => spec.mapRow(row));
    const values = mappedRows.flat();
    const insertSql = buildInsertSql(spec, mappedRows.length);
    await pgPool.query(insertSql, values);
    copied += mappedRows.length;
  }

  if (spec.serialColumn) {
    await resetSerialSequence(pgPool, spec.name, spec.serialColumn);
  }

  console.log(`- ${spec.name}: copied ${copied}/${total}`);
  return { copied, skipped: false };
}

async function main() {
  loadEnvFiles();

  const dryRun = parseArgBoolean("dry-run");
  const truncate = parseArgBoolean("truncate");
  const sourceSqlFileArg = parseArgValue("source-sql-file");
  const sourceSqlFile =
    sourceSqlFileArg ||
    process.env.SOURCE_SQL_FILE?.trim() ||
    "";
  const batchSize = Math.max(
    50,
    Math.min(2_000, Number(process.env.MIGRATION_BATCH_SIZE ?? 400) || 400),
  );

  const sourceDatabase = process.env.SOURCE_DB_NAME ?? process.env.DB_NAME ?? "caf";
  const sourceSsl = getMysqlSslConfig(
    process.env.SOURCE_DB_SSL_MODE ?? process.env.DB_SSL_MODE,
    process.env.SOURCE_DB_SSL_CA ?? process.env.DB_SSL_CA,
    process.env.SOURCE_DB_SSL_REJECT_UNAUTHORIZED ?? process.env.DB_SSL_REJECT_UNAUTHORIZED,
  );

  const sourceConfig = {
    host: process.env.SOURCE_DB_HOST ?? process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.SOURCE_DB_PORT ?? process.env.DB_PORT ?? 3306),
    user: process.env.SOURCE_DB_USER ?? process.env.DB_USER ?? "root",
    password: process.env.SOURCE_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    database: sourceDatabase,
    charset: "utf8mb4",
    ...(sourceSsl ? { ssl: sourceSsl } : {}),
  };

  const targetDatabaseUrl =
    process.env.TARGET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  if (!targetDatabaseUrl) {
    throw new Error(
      "Missing DATABASE_URL. Set DATABASE_URL (or TARGET_DATABASE_URL) to your Neon PostgreSQL URL.",
    );
  }

  const useSqlDump = sourceSqlFile !== "";
  if (useSqlDump) {
    const resolvedSourceSqlFile = path.resolve(process.cwd(), sourceSqlFile);
    if (!fs.existsSync(resolvedSourceSqlFile)) {
      throw new Error(`SQL dump file not found: ${resolvedSourceSqlFile}`);
    }
    console.log("Source SQL dump:");
    console.log(`  ${resolvedSourceSqlFile}`);
  } else {
    console.log("Source MySQL:");
    console.log(
      `  ${sourceConfig.user}@${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database} (password=${maskValue(sourceConfig.password)})`,
    );
  }
  console.log(`Target Neon: ${targetDatabaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
  console.log(`Batch size: ${batchSize}`);
  if (truncate && !dryRun) {
    console.log("Target cleanup: enabled (truncate before copy)");
  }

  const sourceConn = useSqlDump ? null : await mysql.createConnection(sourceConfig);
  const pgPool = new PgPool({
    connectionString: targetDatabaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  try {
    await ensurePgSchema(pgPool);

    if (truncate && !dryRun) {
      await pgPool.query(`
        TRUNCATE TABLE
          admin_audit_logs,
          security_events,
          auth_login_attempts,
          auth_sessions,
          auth_users,
          maintenance_tasks,
          site_metrics_visited_sessions,
          site_metrics_presence,
          site_metrics_counter,
          xbloom_recipe_clicks,
          recipe_submissions,
          recipes,
          roasters
        RESTART IDENTITY CASCADE
      `);
      console.log("Target tables truncated.");
    }

    const dumpRowsByTable = useSqlDump
      ? parseSqlDumpInserts(
          fs.readFileSync(path.resolve(process.cwd(), sourceSqlFile), "utf8"),
        )
      : null;

    let totalCopied = 0;
    for (const spec of TABLE_SPECS) {
      const { copied } = useSqlDump
        ? await copyTableFromDump({
            dumpRowsByTable,
            pgPool,
            spec,
            batchSize,
            dryRun,
          })
        : await copyTable({
            sourceConn,
            sourceDatabase,
            pgPool,
            spec,
            batchSize,
            dryRun,
          });
      totalCopied += copied;
    }

    console.log(`Migration completed. Total rows processed: ${totalCopied}`);
  } finally {
    if (sourceConn) {
      await sourceConn.end();
    }
    await pgPool.end();
  }
}

main().catch((error) => {
  console.error("MySQL -> Neon migration failed.");
  console.error(error);
  process.exit(1);
});
