type XbloomRecipePourInput = {
  used?: boolean;
  volume?: number;
  pause?: number;
  temperature?: number;
  flowRate?: number;
};

type XbloomRecipeInput = {
  dose?: number;
  ratio?: number;
  pours?: XbloomRecipePourInput[];
};

export type XbloomNormalizedPour = {
  volume: number;
  pause: number;
  temperature: number;
  flowRate: number;
};

export type XbloomNormalizedRecipe = {
  dose: number;
  ratio: number;
  totalWater: number;
  pours: XbloomNormalizedPour[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPours(recipe: XbloomRecipeInput) {
  const poursRaw = Array.isArray(recipe.pours) ? recipe.pours : [];
  const pours: XbloomNormalizedPour[] = [];

  for (const pour of poursRaw) {
    const used = pour.used === undefined ? true : Boolean(pour.used);
    const volume = Math.round(toFiniteNumber(pour.volume) ?? 0);
    if (!used || volume <= 0) {
      continue;
    }
    pours.push({
      volume,
      pause: Math.round(clamp(toFiniteNumber(pour.pause) ?? 0, 0, 59)),
      temperature: roundToOne(clamp(toFiniteNumber(pour.temperature) ?? 92, 80, 100)),
      flowRate: roundToOne(clamp(toFiniteNumber(pour.flowRate) ?? 3.1, 3, 3.5)),
    });
  }

  return pours;
}

function normalizeRatioForXbloom(dose: number, rawRatio: number) {
  let ratio = roundToHalf(clamp(rawRatio, 5, 25));
  if (dose % 2 !== 0 && ratio % 1 !== 0) {
    ratio = clamp(Math.round(ratio), 5, 25);
  }
  return ratio;
}

function normalizePoursForTotal(pours: XbloomNormalizedPour[], targetTotalMl: number) {
  const total = pours.reduce((sum, pour) => sum + pour.volume, 0);
  if (total <= 0) {
    return pours;
  }

  const rawScaled = pours.map((pour) => (pour.volume / total) * targetTotalMl);
  const volumes = rawScaled.map((value) => Math.max(1, Math.floor(value)));
  let remaining = targetTotalMl - volumes.reduce((sum, value) => sum + value, 0);

  if (remaining > 0) {
    const priorities = rawScaled
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction);
    let cursor = 0;
    while (remaining > 0) {
      volumes[priorities[cursor % priorities.length].index] += 1;
      remaining -= 1;
      cursor += 1;
    }
  } else if (remaining < 0) {
    const priorities = rawScaled
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => a.fraction - b.fraction);
    let cursor = 0;
    while (remaining < 0 && cursor < priorities.length * 3) {
      const target = priorities[cursor % priorities.length].index;
      if (volumes[target] > 1) {
        volumes[target] -= 1;
        remaining += 1;
      }
      cursor += 1;
    }
  }

  return pours.map((pour, index) => ({
    ...pour,
    volume: volumes[index] ?? pour.volume,
  }));
}

export function normalizeRecipeForXbloomTransport(
  recipe: XbloomRecipeInput | null | undefined,
): XbloomNormalizedRecipe | null {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  const extractedPours = extractPours(recipe);
  if (extractedPours.length === 0) {
    return null;
  }

  const dose = Math.round(clamp(toFiniteNumber(recipe.dose) ?? 15, 5, 18));
  const totalWaterRaw = extractedPours.reduce((sum, pour) => sum + pour.volume, 0);
  const ratioRaw = toFiniteNumber(recipe.ratio) ?? (dose > 0 ? totalWaterRaw / dose : 15);
  const ratioNormalized = normalizeRatioForXbloom(dose, ratioRaw);
  const totalWater = Math.max(1, Math.round(dose * ratioNormalized));
  const pours = normalizePoursForTotal(extractedPours, totalWater);
  const ratio = dose > 0 ? Number((totalWater / dose).toFixed(2)) : ratioNormalized;

  return {
    dose,
    ratio,
    totalWater,
    pours,
  };
}
