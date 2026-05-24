import { BadRequestError, NotFoundError, UnauthorizedError, UpstreamError } from "../errors.js";

const PATTERN_TO_ID = {
  centered: 1,
  spiral: 2,
  circular: 3
};

const ID_TO_PATTERN = {
  1: "centered",
  2: "spiral",
  3: "circular"
};

function requirePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError(`'${fieldName}' must be a positive number.`);
  }
  return parsed;
}

function parseShareId(shareUrl) {
  if (!shareUrl) {
    throw new BadRequestError("'shareUrl' is required.");
  }

  if (shareUrl.includes("share-h5.xbloom.com")) {
    try {
      const parsed = new URL(shareUrl);
      const id = parsed.searchParams.get("id");
      if (!id) throw new BadRequestError("Unable to parse share ID from URL.");
      return id;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError("Invalid xBloom share URL.");
    }
  }

  return shareUrl;
}

function mapXbloomStepToApiStep(step, index = 0) {
  return {
    name: step.theName || `Step ${index + 1}`,
    volumeMl: Number(step.volume ?? 30),
    temperatureC: Number(step.temperature ?? 93),
    pattern: ID_TO_PATTERN[Number(step.pattern ?? 3)] || "circular",
    flowRate: Number(step.flowRate ?? 3),
    pauseSeconds: Number(step.pausing ?? 0),
    agitateBefore: Number(step.isEnableVibrationBefore ?? 2) === 1,
    agitateAfter: Number(step.isEnableVibrationAfter ?? 2) === 1
  };
}

function mapApiStepToXbloomStep(step, index, brewType) {
  const volumeMl = requirePositiveNumber(step.volumeMl, "pours.volumeMl");
  const temperatureC = requirePositiveNumber(step.temperatureC, "pours.temperatureC");
  const flowRate = step.flowRate === undefined ? 3.0 : requirePositiveNumber(step.flowRate, "pours.flowRate");
  const pauseSeconds = step.pauseSeconds === undefined ? 0 : Number(step.pauseSeconds);
  if (!Number.isFinite(pauseSeconds) || pauseSeconds < 0) {
    throw new BadRequestError("'pours.pauseSeconds' must be a non-negative number.");
  }

  const defaultName = brewType === "tea"
    ? `Steep ${index + 1}`
    : index === 0
    ? "Bloom"
    : `Pour ${index + 1}`;

  return {
    theName: step.name || defaultName,
    volume: brewType === "tea" ? Math.min(volumeMl, 90) : volumeMl,
    temperature: temperatureC,
    flowRate,
    pattern: brewType === "tea" ? 3 : (PATTERN_TO_ID[step.pattern || "circular"] || 3),
    pausing: brewType === "tea" ? Math.min(pauseSeconds, 360) : pauseSeconds,
    isEnableVibrationBefore: step.agitateBefore ? 1 : 2,
    isEnableVibrationAfter: step.agitateAfter ? 1 : 2
  };
}

function recipeRawToApiRecipe(raw) {
  const pourList = Array.isArray(raw.pourList) ? raw.pourList : [];
  const brewType = Number(raw.cupType) === 4 ? "tea" : "coffee";
  return {
    id: Number(raw.tableId),
    name: raw.theName || "Untitled Recipe",
    brewType,
    doseG: Number(raw.dose ?? 15),
    ratio: Number(raw.grandWater ?? 15),
    grindSize: Number(raw.grinderSize ?? 70),
    grindRpm: Number(raw.rpm ?? 80),
    color: raw.theColor || (brewType === "tea" ? "#A8C686" : "#C9D5B8"),
    shareUrl: raw.shareRecipeLink || null,
    pours: pourList.map(mapXbloomStepToApiStep)
  };
}

export class RecipeService {
  constructor({ xbloomClient, shareBase, logger }) {
    this.xbloomClient = xbloomClient;
    this.shareBase = shareBase;
    this.logger = logger;
  }

  async listRecipes(credentials) {
    const response = await this.xbloomClient.postEncrypted("tuMyTeaRecipeCreated.tuhtml", {
      ...this.xbloomClient.authBase(credentials),
      pageNumber: 1,
      countPerPage: 100,
      adaptedModel: 1
    });

    if (response.result !== "success") {
      throw new UpstreamError("xBloom failed to list recipes.");
    }

    const recipes = Array.isArray(response.list) ? response.list : [];
    return recipes.map(recipeRawToApiRecipe);
  }

  async createRecipe(credentials, input) {
    if (!input || typeof input !== "object") {
      throw new BadRequestError("Request body is required.");
    }

    const brewType = input.brewType === "tea" ? "tea" : "coffee";
    if (!Array.isArray(input.pours) || input.pours.length === 0) {
      throw new BadRequestError("'pours' must be a non-empty array.");
    }

    const doseG = brewType === "tea"
      ? Math.min(requirePositiveNumber(input.doseG, "doseG"), 10)
      : requirePositiveNumber(input.doseG, "doseG");
    const ratio = requirePositiveNumber(input.ratio, "ratio");
    const grindSize = brewType === "tea" ? 50 : requirePositiveNumber(input.grindSize ?? 70, "grindSize");
    const grindRpm = brewType === "tea" ? 60 : requirePositiveNumber(input.grindRpm ?? 80, "grindRpm");
    const color = input.color || (brewType === "tea" ? "#A8C686" : "#C9D5B8");

    const steps = input.pours
      .slice(0, brewType === "tea" ? 3 : undefined)
      .map((step, index) => mapApiStepToXbloomStep(step, index, brewType));

    const payload = {
      ...this.xbloomClient.authBase(credentials),
      theName: input.name || `Recipe ${new Date().toISOString()}`,
      dose: doseG,
      grandWater: ratio,
      grinderSize: grindSize,
      rpm: grindRpm,
      cupType: brewType === "tea" ? 4 : 2,
      adaptedModel: 1,
      isEnableBypassWater: 2,
      isSetGrinderSize: brewType === "tea" ? 2 : 1,
      theColor: color,
      theSubsetId: 0,
      bypassTemp: 85.0,
      bypassVolume: 5.0,
      subSetType: 2,
      appPlace: [4],
      createTimeStamp: Date.now(),
      isShortcuts: 2,
      pourDataJSONStr: JSON.stringify(steps)
    };

    this.logger.info("recipe_create_attempt", { email: credentials.email, recipeName: payload.theName });
    const response = await this.xbloomClient.postEncrypted("tuRecipeAdd.tuhtml", payload);
    if (response.result !== "success" || !response.tableId) {
      const upstreamHint =
        response.info ||
        response.message ||
        response.msg ||
        response.error ||
        response.errorMsg ||
        "";
      this.logger.warn("recipe_create_failed", {
        email: credentials.email,
        result: response.result || "unknown",
        info: upstreamHint || null
      });
      throw new UpstreamError(
        upstreamHint
          ? `xBloom failed to create recipe. ${upstreamHint}`
          : "xBloom failed to create recipe."
      );
    }

    const recipeId = Number(response.tableId);
    this.logger.info("recipe_create_success", { email: credentials.email, recipeId });
    return {
      recipeId,
      shareUrl: this.buildShareUrl(recipeId)
    };
  }

  async updateRecipe(credentials, recipeId, patch) {
    const numericId = Number(recipeId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new BadRequestError("Recipe id must be a positive number.");
    }

    const existing = await this.getRecipeRawById(credentials, numericId);
    if (!existing) throw new NotFoundError(`Recipe '${numericId}' not found.`);

    const brewType = patch.brewType === "tea" || Number(existing.cupType) === 4 ? "tea" : "coffee";
    const mappedSteps = Array.isArray(patch.pours) && patch.pours.length > 0
      ? patch.pours
          .slice(0, brewType === "tea" ? 3 : undefined)
          .map((step, index) => mapApiStepToXbloomStep(step, index, brewType))
      : (Array.isArray(existing.pourList) ? existing.pourList : []);

    const payload = {
      ...this.xbloomClient.authBase(credentials),
      tableId: numericId,
      theName: patch.name || existing.theName || `Recipe ${numericId}`,
      dose: patch.doseG !== undefined
        ? (brewType === "tea" ? Math.min(requirePositiveNumber(patch.doseG, "doseG"), 10) : requirePositiveNumber(patch.doseG, "doseG"))
        : Number(existing.dose ?? 15),
      grandWater: patch.ratio !== undefined ? requirePositiveNumber(patch.ratio, "ratio") : Number(existing.grandWater ?? 15),
      grinderSize: brewType === "tea"
        ? 50
        : patch.grindSize !== undefined
        ? requirePositiveNumber(patch.grindSize, "grindSize")
        : Number(existing.grinderSize ?? 70),
      rpm: brewType === "tea"
        ? 60
        : patch.grindRpm !== undefined
        ? requirePositiveNumber(patch.grindRpm, "grindRpm")
        : Number(existing.rpm ?? 80),
      theColor: patch.color || existing.theColor || (brewType === "tea" ? "#A8C686" : "#C9D5B8"),
      cupType: brewType === "tea" ? 4 : Number(existing.cupType ?? 2),
      adaptedModel: 1,
      isEnableBypassWater: Number(existing.isEnableBypassWater ?? 2),
      isSetGrinderSize: brewType === "tea" ? 2 : Number(existing.isSetGrinderSize ?? 1),
      theSubsetId: Number(existing.theSubsetId ?? 0),
      bypassTemp: Number(existing.bypassTemp ?? 85.0),
      bypassVolume: Number(existing.bypassVolume ?? 5.0),
      subSetType: 2,
      appPlace: [4],
      isShortcuts: Number(existing.isShortcuts ?? 2),
      pourDataJSONStr: JSON.stringify(mappedSteps)
    };

    const response = await this.xbloomClient.postEncrypted("tuRecipeUpdate.tuhtml", payload);
    if (response.result !== "success") {
      throw new UpstreamError("xBloom failed to update recipe.");
    }

    const updatedRaw = await this.getRecipeRawById(credentials, numericId);
    if (!updatedRaw) throw new NotFoundError(`Recipe '${numericId}' not found after update.`);
    return recipeRawToApiRecipe(updatedRaw);
  }

  async deleteRecipe(credentials, recipeId) {
    const numericId = Number(recipeId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new BadRequestError("Recipe id must be a positive number.");
    }

    const response = await this.xbloomClient.postEncrypted("tuRecipeDelete.tuhtml", {
      ...this.xbloomClient.authBase(credentials),
      tableId: numericId
    });

    if (response.result !== "success") {
      throw new UpstreamError("xBloom failed to delete recipe.");
    }

    return { deleted: true, recipeId: numericId };
  }

  async fetchRecipeFromShare(shareUrl) {
    const shareId = parseShareId(shareUrl);
    const response = await this.xbloomClient.postPlain("RecipeDetail.html", {
      tableIdOfRSA: shareId,
      interfaceVersion: 19700101,
      skey: "testskey"
    });

    if (response.result !== "success" || !response.recipeVo) {
      throw new NotFoundError("Unable to fetch recipe from this share URL.");
    }

    return recipeRawToApiRecipe(response.recipeVo);
  }

  async importRecipe(credentials, input) {
    if (!input?.shareUrl) throw new BadRequestError("'shareUrl' is required.");
    const importedRecipe = await this.fetchRecipeFromShare(input.shareUrl);

    if (!input.createInAccount) {
      return {
        importedRecipe,
        createdRecipe: null
      };
    }

    if (!credentials) {
      throw new UnauthorizedError("Session required when createInAccount=true.");
    }

    const createResult = await this.createRecipe(credentials, {
      name: input.nameOverride || importedRecipe.name,
      brewType: importedRecipe.brewType,
      doseG: importedRecipe.doseG,
      ratio: importedRecipe.ratio,
      grindSize: importedRecipe.grindSize,
      grindRpm: importedRecipe.grindRpm,
      color: importedRecipe.color,
      pours: importedRecipe.pours
    });

    return {
      importedRecipe,
      createdRecipe: createResult
    };
  }

  async getShareUrl(credentials, recipeId) {
    const numericId = Number(recipeId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new BadRequestError("Recipe id must be a positive number.");
    }

    const existing = await this.getRecipeRawById(credentials, numericId);
    if (!existing) throw new NotFoundError(`Recipe '${numericId}' not found.`);

    if (existing.shareRecipeLink) {
      return {
        shareUrl: String(existing.shareRecipeLink),
        source: "existing"
      };
    }

    return {
      shareUrl: this.buildShareUrl(numericId),
      source: "derived"
    };
  }

  async getRecipeRawById(credentials, recipeId) {
    const response = await this.xbloomClient.postEncrypted("tuMyTeaRecipeCreated.tuhtml", {
      ...this.xbloomClient.authBase(credentials),
      pageNumber: 1,
      countPerPage: 100,
      adaptedModel: 1
    });

    if (response.result !== "success") return null;

    const list = Array.isArray(response.list) ? response.list : [];
    return list.find((recipe) => Number(recipe.tableId) === recipeId) || null;
  }

  buildShareUrl(recipeId) {
    const encoded = Buffer.from(String(recipeId), "utf-8").toString("base64");
    return `${this.shareBase}/?id=${encodeURIComponent(encoded)}`;
  }
}
