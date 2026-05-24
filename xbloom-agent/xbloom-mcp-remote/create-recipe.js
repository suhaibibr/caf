#!/usr/bin/env node
import { stdin as input, stderr as promptOutput } from "node:process";
import { createInterface } from "node:readline/promises";
import { config } from "./src/config.js";
import { Logger } from "./src/utils/logger.js";
import { EncryptionService } from "./src/services/encryptionService.js";
import { SessionStore } from "./src/services/sessionStore.js";
import { XBloomClient } from "./src/services/xbloomClient.js";
import { AuthService } from "./src/services/authService.js";
import { RecipeService } from "./src/services/recipeService.js";
import { parseRecipeText } from "./src/parser/recipeTextParser.js";
import { toAppError } from "./src/errors.js";

function parseArgs(argv) {
  const options = {};
  const textParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      textParts.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    i += 1;
  }

  return { options, recipeText: textParts.join(" ").trim() };
}

async function readStdinIfAvailable(currentText) {
  if (currentText) return currentText;
  if (input.isTTY) return "";

  let data = "";
  for await (const chunk of input) {
    data += chunk;
  }
  return String(data).trim();
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function promptCredentials() {
  const rl = createInterface({ input, output: promptOutput });
  try {
    const email = (await rl.question("xBloom email: ")).trim();
    const password = await rl.question("xBloom password: ");
    return { email, password };
  } finally {
    rl.close();
  }
}

async function resolveCredentials({ authService, sessionStore, recipeService, logger }) {
  const defaultToken = await sessionStore.getDefaultSessionToken();
  if (defaultToken) {
    const stored = await sessionStore.getCredentials(defaultToken);
    if (stored) {
      try {
        await recipeService.listRecipes(stored);
        return stored;
      } catch (error) {
        logger.warn("stored_session_invalid", { reason: String(error) });
        await sessionStore.clearDefaultSession();
      }
    }
  }

  const envEmail = process.env.XBLOOM_EMAIL?.trim();
  const envPassword = process.env.XBLOOM_PASSWORD;
  if (envEmail && envPassword) {
    const loginResult = await authService.login(envEmail, envPassword);
    logger.info("cli_login_success_env", { email: envEmail });
    return authService.requireCredentials(loginResult.sessionToken);
  }

  const { email, password } = await promptCredentials();
  const loginResult = await authService.login(email, password);
  logger.info("cli_login_success", { email });
  return authService.requireCredentials(loginResult.sessionToken);
}

async function main() {
  const logger = new Logger(process.env.CLI_LOG_LEVEL || "error");

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

  await sessionStore.ensureStoreFile();

  const { options, recipeText: cliText } = parseArgs(process.argv.slice(2));
  const recipeText = await readStdinIfAvailable(cliText);
  if (!recipeText) {
    throw new Error("Recipe text is required from CLI argument or stdin.");
  }

  const parsed = parseRecipeText(recipeText);
  const credentials = await resolveCredentials({ authService, sessionStore, recipeService, logger });

  const recipeName = String(options.name || `xBloom Recipe ${new Date().toISOString()}`);
  const doseG = parseNumber(options.dose, 18);
  const tempC = parseNumber(options.temp, 92);
  const grindSize = parseNumber(options.grind, 70);
  const grindRpm = parseNumber(options.rpm, 80);
  const flowRate = parseNumber(options.flow, 3.0);

  const ratio = parseNumber(options.ratio, Number((parsed.totalWaterMl / doseG).toFixed(2)));
  const pours = parsed.incrementalPours.map((pour, index) => ({
    name: index === 0 ? "Bloom" : `Pour ${index + 1}`,
    volumeMl: pour.volumeMl,
    temperatureC: tempC,
    pattern: "circular",
    flowRate,
    pauseSeconds: pour.waitSec,
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

  const result = {
    success: true,
    recipeName,
    parsedRecipe: {
      totalWaterMl: parsed.totalWaterMl,
      pours: parsed.pours,
      drawdownTargetSec: parsed.drawdownTargetSec
    },
    warnings: parsed.warnings,
    recipeId: created.recipeId,
    shareUrl: share.shareUrl
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const appError = toAppError(error);
  const output = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message
    }
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
});
