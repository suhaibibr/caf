import express from "express";
import { config } from "./config.js";
import { BadRequestError, toAppError } from "./errors.js";
import { Logger } from "./utils/logger.js";
import { EncryptionService } from "./services/encryptionService.js";
import { SessionStore } from "./services/sessionStore.js";
import { XBloomClient } from "./services/xbloomClient.js";
import { AuthService } from "./services/authService.js";
import { RecipeService } from "./services/recipeService.js";
import { parseRecipeText } from "./parser/recipeTextParser.js";

const logger = new Logger(config.logLevel);

const encryptionService = new EncryptionService(config.sessionEncryptionSecret, config.sessionEncryptionSalt);
const sessionStore = new SessionStore(config.sessionFile, encryptionService, logger);
const xbloomClient = new XBloomClient({
  apiBase: config.xbloomApiBase,
  shareBase: config.xbloomShareBase
});

const authService = new AuthService({
  xbloomClient,
  sessionStore,
  sessionTtlSeconds: config.sessionTtlSeconds,
  logger
});

const recipeService = new RecipeService({
  xbloomClient,
  shareBase: config.xbloomShareBase,
  logger
});

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Token");
  if (req.method === "OPTIONS") return res.status(204).send();
  return next();
});

function getSessionTokenFromRequest(req) {
  const headerToken = req.header("x-session-token");
  if (headerToken) return headerToken.trim();

  const auth = req.header("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  return null;
}

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseNumberArray(values, fallback = []) {
  if (!Array.isArray(values)) return fallback;
  const mapped = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return mapped;
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

async function requireCredentials(req) {
  const sessionToken = getSessionTokenFromRequest(req);
  return authService.requireCredentials(sessionToken);
}

app.get("/health", (_req, res) => {
  ok(res, { status: "ok", service: "xbloom-local-backend" });
});

app.post("/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  const login = await authService.login(email, password);
  ok(res, login);
}));

app.get("/recipes", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const recipes = await recipeService.listRecipes(credentials);
  ok(res, { recipes });
}));

app.post("/recipes", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const created = await recipeService.createRecipe(credentials, req.body);
  ok(res, created, 201);
}));

app.patch("/recipes/:id", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const recipe = await recipeService.updateRecipe(credentials, req.params.id, req.body || {});
  ok(res, { recipe });
}));

app.delete("/recipes/:id", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const result = await recipeService.deleteRecipe(credentials, req.params.id);
  ok(res, result);
}));

app.post("/recipes/import", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const createInAccount = Boolean(body.createInAccount);
  const credentials = createInAccount ? await requireCredentials(req) : null;
  const result = await recipeService.importRecipe(credentials, body);
  ok(res, result);
}));

app.post("/recipes/:id/share", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const result = await recipeService.getShareUrl(credentials, req.params.id);
  ok(res, result);
}));

app.post("/recipes/from-text", asyncRoute(async (req, res) => {
  const credentials = await requireCredentials(req);
  const body = req.body || {};
  const recipeText = String(body.recipeText || "").trim();
  const recipeName = String(body.name || `xBloom Recipe ${new Date().toISOString()}`);
  const manualVolumes = parseNumberArray(body.pourVolumesMl, []);
  const manualWaits = parseNumberArray(body.waitSeconds, []);

  let parsed = null;
  if (recipeText) {
    try {
      parsed = parseRecipeText(recipeText);
    } catch (error) {
      if (manualVolumes.length === 0) throw error;
      parsed = {
        totalWaterMl: manualVolumes.reduce((sum, value) => sum + Number(value || 0), 0),
        pours: [],
        incrementalPours: [],
        drawdownTargetSec: null,
        warnings: ["Recipe text parsing failed; using manual pour volumes instead."]
      };
    }
  } else if (manualVolumes.length > 0) {
    parsed = {
      totalWaterMl: manualVolumes.reduce((sum, value) => sum + Number(value || 0), 0),
      pours: [],
      incrementalPours: [],
      drawdownTargetSec: null,
      warnings: ["No recipe text provided; using manual pour volumes."]
    };
  } else {
    throw new BadRequestError("Provide recipe text or manual pour volumes.");
  }

  if (manualVolumes.length === 0) {
    throw new BadRequestError("At least one manual pour volume is required.");
  }

  const doseG = parseNumber(body.dose, 18);
  const tempC = parseNumber(body.temp, 92);
  const grindSize = parseNumber(body.grind, 70);
  const grindRpm = parseNumber(body.rpm, 80);
  const flowRate = parseNumber(body.flow, 3.0);
  const ratio = parseNumber(body.ratio, Number((parsed.totalWaterMl / doseG).toFixed(2)));

  const basePours = manualVolumes.length > 0
    ? manualVolumes.map((volumeMl, index) => ({
        volumeMl,
        targetMl: manualVolumes.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
        durationSec: null,
        waitSec: 0
      }))
    : parsed.incrementalPours;

  const pours = basePours.map((pour, index) => ({
    name: index === 0 ? "Bloom" : `Pour ${index + 1}`,
    volumeMl: Number(pour.volumeMl),
    temperatureC: tempC,
    pattern: "circular",
    flowRate,
    pauseSeconds: manualWaits[index] ?? 0,
    agitateBefore: false,
    agitateAfter: false
  }));

  const created = await recipeService.createRecipe(credentials, {
    name: recipeName,
    brewType: "coffee",
    doseG,
    ratio,
    grindSize,
    grindRpm,
    pours
  });

  const share = await recipeService.getShareUrl(credentials, created.recipeId);

  ok(res, {
    recipeName,
    parsedRecipe: {
      totalWaterMl: pours.reduce((sum, pour) => sum + Number(pour.volumeMl || 0), 0),
      pours: pours.map((pour, index) => ({
        targetMl: pours.slice(0, index + 1).reduce((sum, row) => sum + Number(row.volumeMl || 0), 0),
        durationSec: null,
        waitSec: Number(pour.pauseSeconds || 0)
      })),
      drawdownTargetSec: parsed.drawdownTargetSec
    },
    warnings: parsed.warnings,
    recipeId: created.recipeId,
    shareUrl: share.shareUrl
  });
}));

app.use((error, _req, res, _next) => {
  const appError = error?.type === "entity.parse.failed"
    ? { statusCode: 400, code: "bad_request", message: "Request body must be valid JSON." }
    : toAppError(error);

  if (appError.statusCode >= 500) {
    logger.error("api_error", { code: appError.code, message: appError.message });
  } else {
    logger.warn("api_error", { code: appError.code, message: appError.message });
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {})
    }
  });
});

app.listen(config.port, async () => {
  await sessionStore.ensureStoreFile();
  logger.info("server_started", { port: config.port, sessionFile: config.sessionFile });
});
