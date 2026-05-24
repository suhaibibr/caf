import { spawn } from "child_process";
import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import {
  normalizeRecipeForXbloomTransport,
  type XbloomNormalizedPour,
} from "@/lib/xbloom-recipe-normalizer";

export type XbloomCreateLinkInput = {
  recipe: unknown;
  source?: unknown;
};

type BloomModule = {
  createRecipeLink?: (input: unknown) => Promise<unknown> | unknown;
  generateRecipeLink?: (input: unknown) => Promise<unknown> | unknown;
  publishRecipe?: (input: unknown) => Promise<unknown> | unknown;
  createLink?: (input: unknown) => Promise<unknown> | unknown;
  run?: (input: unknown) => Promise<unknown> | unknown;
  default?: (input: unknown) => Promise<unknown> | unknown;
};

type CliRecipeStep = XbloomNormalizedPour;

type CliRecipePayload = {
  name: string;
  dose: number;
  ratio: number | null;
  grind: number;
  rpm: number;
  temp: number;
  flow: number;
  recipeText: string;
};

type CliSuccessOutput = {
  success?: boolean;
  shareUrl?: string;
  url?: string;
  recipeUrl?: string;
  link?: string;
  error?: {
    message?: string;
  };
};

const BLOOM_ENTRY_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), ".next", "bloom");
const PROJECT_ROOT = path.join(/* turbopackIgnore: true */ process.cwd());
const PROJECT_CLI_CANDIDATES = [
  path.join(PROJECT_ROOT, "xbloom-agent", "xbloom-mcp-remote", "create-recipe.js"),
  path.join(PROJECT_ROOT, "xbloom-mcp-remote", "create-recipe.js"),
  path.join(PROJECT_ROOT, "bloom", "xbloom-agent", "xbloom-mcp-remote", "create-recipe.js"),
  path.join(PROJECT_ROOT, "bloom", "xbloom-mcp-remote", "create-recipe.js"),
  path.join(PROJECT_ROOT, "scripts", "xbloom-mcp-remote", "create-recipe.js"),
  path.join(PROJECT_ROOT, "create-recipe.js"),
];
const KNOWN_CLI_CANDIDATES = [
  path.join(BLOOM_ENTRY_PATH, "xbloom-agent", "xbloom-mcp-remote", "create-recipe.js"),
  path.join(BLOOM_ENTRY_PATH, "create-recipe.js"),
];
const MODULE_CANDIDATE_FILES = [
  "index.js",
  "index.mjs",
  "index.cjs",
  "main.js",
  "main.mjs",
  "main.cjs",
  "bloom.js",
  "bloom.mjs",
  "bloom.cjs",
  "runner.js",
  "runner.mjs",
  "runner.cjs",
];
const MISSING_CLI_GUIDANCE =
  "لم يتم العثور على Bloom CLI. حدد المسار الثابت في XBLOOM_CLI_PATH (مثال: C:\\Users\\Suhai\\Desktop\\caf\\xbloom-agent\\xbloom-mcp-remote\\create-recipe.js).";

function toObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildRecipeTextFromPours(pours: CliRecipeStep[]) {
  let cumulative = 0;
  const parts: string[] = [];

  for (let index = 0; index < pours.length; index += 1) {
    const pour = pours[index];
    cumulative += pour.volume;
    parts.push(`Pour ${index + 1} ${cumulative} ml wait ${pour.pause} sec`);
  }

  return parts.join(", ");
}

function buildCliPayload(input: XbloomCreateLinkInput): CliRecipePayload {
  const recipeObject = toObject(input.recipe);
  if (!recipeObject) {
    throw new Error("صيغة الوصفة غير صالحة.");
  }

  const normalized = normalizeRecipeForXbloomTransport(recipeObject);
  if (!normalized || normalized.pours.length === 0) {
    throw new Error("الوصفة لا تحتوي صبات صالحة لإرسالها إلى xBloom.");
  }

  const name = String(recipeObject.name || "xBloom Auto Recipe");
  const dose = normalized.dose;
  const pours = normalized.pours;
  const ratio = normalized.ratio;
  const grind = Math.round(clamp(toFiniteNumber(recipeObject.grindSize) ?? 55, 1, 80));
  const rpm = Math.round(clamp(toFiniteNumber(recipeObject.grinderSpeed) ?? 85, 60, 120));
  const temp = pours[0]?.temperature ?? 92;
  const flow = pours[0]?.flowRate ?? 3.1;

  return {
    name,
    dose,
    ratio,
    grind,
    rpm,
    temp,
    flow,
    recipeText: buildRecipeTextFromPours(pours),
  };
}

function extractLinkFromResult(result: unknown) {
  if (typeof result === "string") {
    return result.trim();
  }

  if (result && typeof result === "object") {
    const maybeResult = result as Record<string, unknown>;
    const candidates = [
      maybeResult.url,
      maybeResult.link,
      maybeResult.recipeUrl,
      maybeResult.recipeURL,
      maybeResult.shareUrl,
      maybeResult.shareURL,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function assertValidUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("منطق bloom أعاد رابطًا غير صالح.");
  }

  if (!parsed.protocol.startsWith("http")) {
    throw new Error("الرابط المُعاد من bloom ليس http/https.");
  }

  return parsed.toString();
}

async function findRunnableFileInDir(dirPath: string, depth = 0): Promise<string | null> {
  if (depth > 3) {
    return null;
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
        return path.join(dirPath, entry.name);
      }
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const name = entry.name.toLowerCase();
      if (name === "node_modules" || name === ".git") {
        continue;
      }
      const nested = await findRunnableFileInDir(path.join(dirPath, entry.name), depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function findFileByName(dirPath: string, targetName: string, depth = 0): Promise<string | null> {
  if (depth > 5) {
    return null;
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
      return path.join(dirPath, entry.name);
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const name = entry.name.toLowerCase();
      if (name === "node_modules" || name === ".git" || name === ".next") {
        continue;
      }
      const nested = await findFileByName(path.join(dirPath, entry.name), targetName, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function parseJsonLoose(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const chunk = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(chunk) as unknown;
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function findCliPathInWorkspace() {
  const candidateDirs = [
    PROJECT_ROOT,
    path.join(PROJECT_ROOT, "bloom"),
    path.join(PROJECT_ROOT, "xbloom-agent"),
    path.join(PROJECT_ROOT, "scripts"),
  ];

  for (const candidateDir of candidateDirs) {
    if (!existsSync(candidateDir)) {
      continue;
    }
    const found = await findFileByName(candidateDir, "create-recipe.js");
    if (found) {
      return found;
    }
  }

  return null;
}

async function resolveBloomCliPath() {
  const explicitCliPath = process.env.XBLOOM_CLI_PATH?.trim();
  if (explicitCliPath) {
    if (!existsSync(explicitCliPath)) {
      throw new Error(`المسار المحدد في XBLOOM_CLI_PATH غير موجود: ${explicitCliPath}`);
    }
    return explicitCliPath;
  }

  const allKnownCandidates = [...PROJECT_CLI_CANDIDATES, ...KNOWN_CLI_CANDIDATES];
  for (const candidate of allKnownCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (existsSync(BLOOM_ENTRY_PATH)) {
    const recursiveFound = await findFileByName(BLOOM_ENTRY_PATH, "create-recipe.js");
    if (recursiveFound) {
      return recursiveFound;
    }
  }

  const workspaceDiscovered = await findCliPathInWorkspace();
  if (workspaceDiscovered) {
    return workspaceDiscovered;
  }

  return null;
}

async function runBloomCli(cliPath: string, input: XbloomCreateLinkInput) {
  const payload = buildCliPayload(input);
  const args = [
    cliPath,
    "--name",
    payload.name,
    "--dose",
    String(payload.dose),
    "--temp",
    String(payload.temp),
    "--grind",
    String(payload.grind),
    "--rpm",
    String(payload.rpm),
    "--flow",
    String(payload.flow),
  ];

  if (payload.ratio !== null) {
    args.push("--ratio", String(payload.ratio));
  }

  const cliWorkingDir = path.dirname(cliPath);
  const envEmail = process.env.XBLOOM_EMAIL?.trim();
  const envPassword = process.env.XBLOOM_PASSWORD;
  const hasEnvCredentials = Boolean(envEmail && envPassword);

  return await new Promise<unknown>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: cliWorkingDir,
      env: {
        ...process.env,
        XBLOOM_EMAIL: hasEnvCredentials ? envEmail : "__missing__",
        XBLOOM_PASSWORD: hasEnvCredentials ? envPassword : "__missing__",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(new Error(`تعذر تشغيل سكربت bloom: ${error.message}`));
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          "انتهت مهلة إنشاء الرابط عبر bloom. تأكد من صحة بيانات xBloom أو وجود جلسة مسجلة.",
        ),
      );
    }, 45000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      const parsed = parseJsonLoose(stdout) as CliSuccessOutput | null;

      if (code === 0) {
        if (parsed?.success === false) {
          reject(
            new Error(
              parsed.error?.message || "فشل إنشاء الوصفة داخل bloom CLI دون تفاصيل إضافية.",
            ),
          );
          return;
        }
        resolve(parsed ?? stdout);
        return;
      }

      const errorMessage =
        parsed?.error?.message ||
        stderr.trim() ||
        stdout.trim() ||
        `Bloom CLI exited with code ${code ?? "unknown"}.`;
      reject(new Error(`تعذر إنشاء رابط الوصفة عبر bloom: ${errorMessage}`));
    });

    child.stdin.write(payload.recipeText);
    child.stdin.end();
  });
}

async function resolveBloomRunnerPath() {
  if (!existsSync(BLOOM_ENTRY_PATH)) {
    throw new Error(
      "لم يتم العثور على المسار .next/bloom وقت التشغيل. مجلد .next قد يُعاد توليده تلقائيًا من Next.js. "
        + MISSING_CLI_GUIDANCE,
    );
  }

  const entryStat = await stat(BLOOM_ENTRY_PATH);
  if (entryStat.isFile()) {
    return BLOOM_ENTRY_PATH;
  }

  for (const candidate of MODULE_CANDIDATE_FILES) {
    const candidatePath = path.join(BLOOM_ENTRY_PATH, candidate);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const recursiveMatch = await findRunnableFileInDir(BLOOM_ENTRY_PATH);
  if (recursiveMatch) {
    return recursiveMatch;
  }

  throw new Error("المسار .next/bloom موجود لكن لا يحتوي ملف تشغيل واضح.");
}

function resolveRunnerFn(moduleObject: BloomModule) {
  const defaultExport =
    moduleObject.default && typeof moduleObject.default === "object"
      ? (moduleObject.default as BloomModule)
      : null;

  const fn =
    moduleObject.createRecipeLink ||
    moduleObject.generateRecipeLink ||
    moduleObject.publishRecipe ||
    moduleObject.createLink ||
    moduleObject.run ||
    moduleObject.default ||
    defaultExport?.createRecipeLink ||
    defaultExport?.generateRecipeLink ||
    defaultExport?.publishRecipe ||
    defaultExport?.createLink ||
    defaultExport?.run ||
    defaultExport?.default;

  if (typeof fn !== "function") {
    throw new Error(
      "ملف .next/bloom لا يصدّر دالة تشغيل متوقعة (createRecipeLink/generateRecipeLink/default).",
    );
  }

  return fn;
}

export async function createXbloomRecipeLink(input: XbloomCreateLinkInput) {
  const cliPath = await resolveBloomCliPath();
  if (cliPath) {
    const cliResult = await runBloomCli(cliPath, input);
    const cliLink = extractLinkFromResult(cliResult);
    if (!cliLink) {
      throw new Error("تعذر استخراج رابط الوصفة من استجابة bloom CLI.");
    }
    return assertValidUrl(cliLink);
  }

  const runnerPath = await resolveBloomRunnerPath();
  const moduleUrl = pathToFileURL(runnerPath).href;
  const bloomModule = (await import(moduleUrl)) as BloomModule;
  const run = resolveRunnerFn(bloomModule);

  const result = await run({
    recipe: input.recipe,
    source: input.source ?? null,
    credentials: {
      email: process.env.XBLOOM_EMAIL ?? "",
      password: process.env.XBLOOM_PASSWORD ?? "",
    },
  });

  const link = extractLinkFromResult(result);
  if (!link) {
    throw new Error("تعذر استخراج رابط الوصفة من استجابة bloom.");
  }

  return assertValidUrl(link);
}
