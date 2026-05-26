"use client";

import { useMemo, useState } from "react";
import {
  CAF_GENERATED_ROASTER_NAME,
  CAF_GENERATED_ROASTER_SLUG,
} from "@/lib/caf-generated-roaster";
import { normalizeRecipeForXbloomTransport } from "@/lib/xbloom-recipe-normalizer";

type ProcessType =
  | "Washed"
  | "Natural"
  | "Honey"
  | "Anaerobic"
  | "Experimental"
  | "Co-ferment";
type RoastLevel = "Light" | "Light-Medium" | "Medium" | "Medium-Dark";
type CupGoal = "Clarity" | "Balance" | "Sweetness" | "Body";
type CupSize = "Small" | "Medium" | "Large";
type CupMode = "Hot" | "Iced";
type Region = "Africa" | "Latin America" | "Asia-Pacific";
type PourStyle = "Centered" | "Spiral" | "Circular";
type Agitation = "On before" | "On after" | "Both" | "None";
type CurveMode = "declining" | "fixed";
type IcedBrewIntent =
  | "Iced Filter"
  | "Flash-Chilled Pour Over"
  | "Concentrated Over Ice";
type SensoryIntent =
  | "delicate / floral / tea-like"
  | "juicy / structured / bright"
  | "round / cocoa / sweet"
  | "syrupy / dense / low-acid";

type RecipeInput = {
  coffeeName: string;
  roaster: string;
  originCountry: string;
  process: ProcessType | "";
  roastLevel: RoastLevel | "";
  roastDate: string;
  cupGoal: CupGoal | "";
  cupSize: CupSize | "";
  cupMode: CupMode | "";
};

type CountryProfile = {
  region: Region;
  profile: string[];
  baselineGoalBias: CupGoal;
};

type ResolvedInput = {
  coffeeName: string;
  roaster: string;
  originCountry: string;
  process: ProcessType;
  roastLevel: RoastLevel;
  roastDate: string;
  cupGoal: CupGoal;
  cupSize: CupSize;
  cupMode: CupMode;
  icedIntent: IcedBrewIntent | null;
  method: "Omni Dripper";
  region: Region;
  countryKey: string;
  countryProfile: string[];
  assumptions: string[];
  assumptionSummary: string;
  daysOffRoast: number | null;
  sensoryIntent: SensoryIntent;
};

type ColdPlan = {
  mode: "Iced";
  intent: IcedBrewIntent;
  brewWater: number;
  iceGrams: number;
  iceMlEquivalent: number;
  expectedFinalBeverage: number;
  icePlacement: "server" | "cup" | "both";
  icePlacementText: string;
  iceInstructions: string[];
  qualityNotes: string[];
};

type PourStep = {
  used: boolean;
  volume: number;
  temperature: number;
  flowRate: number;
  pause: number;
  pourStyle: PourStyle;
  agitation: Agitation;
};

type BrewTimeTarget = {
  minSec: number;
  maxSec: number;
};

type GeneratedRecipe = {
  name: string;
  brewGoal: string;
  method: "Omni Dripper";
  cupMode: CupMode;
  icedIntent: IcedBrewIntent | null;
  dose: number;
  ratio: number;
  totalWater: number;
  grindSize: number;
  grinderSpeed: number;
  numberOfPours: number;
  pours: [PourStep, PourStep, PourStep, PourStep];
  coldPlan: ColdPlan | null;
  expectedCupProfile: {
    aroma: string;
    acidity: string;
    sweetness: string;
    body: string;
    finish: string;
  };
  adjustmentGuide: {
    ifSour: string;
    ifBitter: string;
    ifWeak: string;
    ifMuddy: string;
  };
  proTip: string;
  assumptions: string[];
};

type CandidateRecipe = Omit<GeneratedRecipe, "pours"> & {
  pours: PourStep[];
};

const DEFAULT_INPUT: RecipeInput = {
  coffeeName: "",
  roaster: "",
  originCountry: "",
  process: "",
  roastLevel: "",
  roastDate: "",
  cupGoal: "",
  cupSize: "",
  cupMode: "",
};

const ORIGIN_COUNTRY_MAP: Record<string, CountryProfile> = {
  ethiopia: {
    region: "Africa",
    profile: ["floral", "citrus", "tea-like", "high clarity"],
    baselineGoalBias: "Clarity",
  },
  kenya: {
    region: "Africa",
    profile: ["berry", "juicy", "bright acidity", "structured"],
    baselineGoalBias: "Clarity",
  },
  rwanda: {
    region: "Africa",
    profile: ["clean", "citrus", "tea-like", "sweet"],
    baselineGoalBias: "Balance",
  },
  uganda: {
    region: "Africa",
    profile: ["fruit-forward", "dense", "sweet"],
    baselineGoalBias: "Sweetness",
  },
  colombia: {
    region: "Latin America",
    profile: ["balanced", "caramel", "citrus", "sweet"],
    baselineGoalBias: "Balance",
  },
  brazil: {
    region: "Latin America",
    profile: ["chocolate", "nuts", "low acidity", "round body"],
    baselineGoalBias: "Body",
  },
  guatemala: {
    region: "Latin America",
    profile: ["cocoa", "soft spice", "structured", "balanced"],
    baselineGoalBias: "Balance",
  },
  "costa rica": {
    region: "Latin America",
    profile: ["clean", "bright", "sweet", "balanced"],
    baselineGoalBias: "Clarity",
  },
  "el salvador": {
    region: "Latin America",
    profile: ["sweet", "soft acidity", "balanced", "cocoa"],
    baselineGoalBias: "Balance",
  },
  peru: {
    region: "Latin America",
    profile: ["soft", "clean", "sweet", "light cocoa"],
    baselineGoalBias: "Balance",
  },
  mexico: {
    region: "Latin America",
    profile: ["cocoa", "mild fruit", "soft spice", "balanced"],
    baselineGoalBias: "Balance",
  },
  panama: {
    region: "Latin America",
    profile: ["floral", "clean", "bright", "elegant"],
    baselineGoalBias: "Clarity",
  },
  indonesia: {
    region: "Asia-Pacific",
    profile: ["earthy", "heavy body", "herbal", "low acidity"],
    baselineGoalBias: "Body",
  },
  india: {
    region: "Asia-Pacific",
    profile: ["spice", "body", "low acidity", "dense"],
    baselineGoalBias: "Body",
  },
  yemen: {
    region: "Asia-Pacific",
    profile: ["complex", "dense", "winey", "intense"],
    baselineGoalBias: "Sweetness",
  },
  thailand: {
    region: "Asia-Pacific",
    profile: ["sweet", "spice", "body", "low acidity"],
    baselineGoalBias: "Body",
  },
};

const COUNTRY_AR_LABELS: Record<string, string> = {
  ethiopia: "إثيوبيا",
  kenya: "كينيا",
  rwanda: "رواندا",
  uganda: "أوغندا",
  colombia: "كولومبيا",
  brazil: "البرازيل",
  guatemala: "غواتيمالا",
  "costa rica": "كوستاريكا",
  "el salvador": "السلفادور",
  peru: "بيرو",
  mexico: "المكسيك",
  panama: "بنما",
  indonesia: "إندونيسيا",
  india: "الهند",
  yemen: "اليمن",
  thailand: "تايلاند",
};

const HOT_ROAST_TEMP_RANGES: Record<RoastLevel, { min: number; max: number; base: number }> = {
  Light: { min: 94, max: 95.5, base: 95 },
  "Light-Medium": { min: 92.5, max: 94.5, base: 93.6 },
  Medium: { min: 91, max: 93.5, base: 92.3 },
  "Medium-Dark": { min: 89, max: 91.5, base: 90.2 },
};

const ICED_ROAST_TEMP_RANGES: Record<RoastLevel, { min: number; max: number; base: number }> = {
  Light: { min: 92, max: 94.5, base: 93.2 },
  "Light-Medium": { min: 91, max: 93.5, base: 92.3 },
  Medium: { min: 90, max: 92.5, base: 91.3 },
  "Medium-Dark": { min: 88.5, max: 91, base: 89.8 },
};

const GOAL_BREW_TIME_TARGETS: Record<CupGoal, BrewTimeTarget> = {
  Clarity: { minSec: 135, maxSec: 165 },
  Balance: { minSec: 120, maxSec: 150 },
  Sweetness: { minSec: 125, maxSec: 155 },
  Body: { minSec: 90, maxSec: 120 },
};

const FLORAL_DELICATE_COUNTRIES = new Set(["ethiopia", "panama"]);
const ICED_KEYWORD_PATTERNS = [
  /\biced\b/i,
  /over[-\s]?ice/i,
  /flash[-\s]?chill/i,
  /cold\s*cup/i,
  /iced\s*filter/i,
  /بارد/i,
  /ايسد/i,
  /آيسد/i,
  /ايس/i,
  /آيس/i,
  /مثلج/i,
  /ثلج/i,
];

const ICED_INTENT_RATIO_RANGES: Record<IcedBrewIntent, { min: number; max: number }> = {
  "Flash-Chilled Pour Over": { min: 10, max: 15 },
  "Iced Filter": { min: 12, max: 15.5 },
  "Concentrated Over Ice": { min: 9, max: 12.5 },
};

const ICED_CUP_TARGET_RANGES: Record<CupSize, { min: number; mid: number; max: number }> = {
  Small: { min: 180, mid: 200, max: 220 },
  Medium: { min: 240, mid: 270, max: 300 },
  Large: { min: 320, mid: 350, max: 380 },
};

const ICED_DOSE_RANGES: Record<CupSize, { min: number; max: number }> = {
  Small: { min: 13, max: 15 },
  Medium: { min: 14.5, max: 16.5 },
  Large: { min: 15.5, max: 18 },
};

function getRoastTempRange(roastLevel: RoastLevel, cupMode: CupMode) {
  return cupMode === "Iced"
    ? ICED_ROAST_TEMP_RANGES[roastLevel]
    : HOT_ROAST_TEMP_RANGES[roastLevel];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function formatCountryKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isDelicateOriginForClarity(countryKey: string, sensoryIntent: SensoryIntent) {
  return (
    countryKey === "ethiopia" ||
    countryKey === "panama" ||
    sensoryIntent === "delicate / floral / tea-like"
  );
}

function getDaysOffRoast(roastDate: string) {
  if (!roastDate) {
    return null;
  }
  const ts = new Date(roastDate).getTime();
  if (!Number.isFinite(ts)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function hasIcedKeywords(input: RecipeInput) {
  const combined = `${input.coffeeName} ${input.roaster} ${input.originCountry}`.toLowerCase();
  if (!combined.trim()) {
    return false;
  }
  return ICED_KEYWORD_PATTERNS.some((pattern) => pattern.test(combined));
}

function resolveSensoryIntent(input: {
  region: Region;
  goal: CupGoal;
  process: ProcessType;
  countryKey: string;
  roastLevel: RoastLevel;
}): SensoryIntent {
  const floralCountry = FLORAL_DELICATE_COUNTRIES.has(input.countryKey);
  if (
    (input.goal === "Clarity" && (input.process === "Washed" || floralCountry)) ||
    (input.region === "Africa" && input.process === "Washed")
  ) {
    return "delicate / floral / tea-like";
  }

  if (input.region === "Africa" && input.goal === "Clarity" && input.process !== "Washed") {
    return "juicy / structured / bright";
  }

  if (
    input.region === "Africa" &&
    (input.goal === "Sweetness" || input.goal === "Balance") &&
    input.process !== "Washed"
  ) {
    return "juicy / structured / bright";
  }

  if (
    input.goal === "Body" ||
    input.roastLevel === "Medium-Dark" ||
    input.region === "Asia-Pacific" ||
    input.countryKey === "brazil" ||
    input.countryKey === "indonesia" ||
    input.countryKey === "vietnam"
  ) {
    return "syrupy / dense / low-acid";
  }

  return "round / cocoa / sweet";
}

function resolveIcedIntent(input: {
  goal: CupGoal;
  process: ProcessType;
  region: Region;
  countryKey: string;
  sensoryIntent: SensoryIntent;
}): IcedBrewIntent {
  if (
    input.goal === "Clarity" ||
    input.sensoryIntent === "delicate / floral / tea-like" ||
    (input.region === "Africa" && input.process === "Washed")
  ) {
    return "Flash-Chilled Pour Over";
  }

  if (
    input.goal === "Body" ||
    input.countryKey === "brazil" ||
    input.region === "Asia-Pacific" ||
    input.sensoryIntent === "syrupy / dense / low-acid"
  ) {
    return "Concentrated Over Ice";
  }

  return "Iced Filter";
}

function resolveInput(input: RecipeInput): ResolvedInput {
  const assumptions: string[] = [];

  const countryRaw = input.originCountry.trim();
  const countryKey = formatCountryKey(countryRaw);
  const countryMeta = countryKey ? ORIGIN_COUNTRY_MAP[countryKey] : undefined;

  let region: Region = "Latin America";
  let countryProfile = ["balanced", "caramel", "clean", "sweet"];
  let baselineGoal: CupGoal = "Balance";

  if (!countryMeta) {
    assumptions.push(
      "بلد المنشأ غير معروف، لذلك تم استخدام خط أساس متوازن من أمريكا اللاتينية.",
    );
  } else {
    region = countryMeta.region;
    countryProfile = countryMeta.profile;
    baselineGoal = countryMeta.baselineGoalBias;
  }

  const process = input.process || "Washed";
  if (!input.process) {
    assumptions.push("لم يتم تحديد المعالجة، فتم اعتماد مغسولة (Washed).");
  }

  const roastLevel = input.roastLevel || "Light-Medium";
  if (!input.roastLevel) {
    assumptions.push("لم يتم تحديد درجة التحميص، فتم اعتماد فاتح-متوسط.");
  }

  const cupGoal = input.cupGoal || baselineGoal;
  if (!input.cupGoal) {
    assumptions.push("لم يتم تحديد هدف الكوب، فتم اعتماد الهدف الافتراضي المرتبط ببلد المنشأ.");
  }

  const autoIced = !input.cupMode && hasIcedKeywords(input);
  const cupMode: CupMode = input.cupMode || (autoIced ? "Iced" : "Hot");
  if (!input.cupMode && autoIced) {
    assumptions.push("تم اكتشاف كلمات تدل على كوب بارد، فتم تفعيل وضع Iced تلقائيًا.");
  } else if (!input.cupMode) {
    assumptions.push("لم يتم تحديد نوع الكوب، فتم اعتماد Hot افتراضيًا.");
  }

  const cupSize = input.cupSize || "Medium";
  if (!input.cupSize) {
    assumptions.push(
      cupMode === "Iced"
        ? "لم يتم تحديد حجم الكوب البارد، فتم اعتماد Medium Iced افتراضيًا."
        : "لم يتم تحديد حجم الكوب، فتم اعتماد الحجم المتوسط.",
    );
  }

  const coffeeName = input.coffeeName.trim();
  const roaster = input.roaster.trim();
  const sensoryIntent = resolveSensoryIntent({
    region,
    goal: cupGoal,
    process,
    countryKey,
    roastLevel,
  });
  const icedIntent =
    cupMode === "Iced"
      ? resolveIcedIntent({
          goal: cupGoal,
          process,
          region,
          countryKey,
          sensoryIntent,
        })
      : null;

  const assumptionSummary =
    assumptions.length > 0
      ? `افتراضات تلقائية: ${assumptions.slice(0, 2).join(" ")}`
      : "";

  return {
    coffeeName,
    roaster,
    originCountry: countryRaw || "Unknown",
    process,
    roastLevel,
    roastDate: input.roastDate,
    cupGoal,
    cupSize,
    cupMode,
    icedIntent,
    method: "Omni Dripper",
    region,
    countryKey,
    countryProfile,
    assumptions,
    assumptionSummary,
    daysOffRoast: getDaysOffRoast(input.roastDate),
    sensoryIntent,
  };
}

function pickHotDose(cupSize: CupSize, goal: CupGoal) {
  const ranges: Record<CupSize, { low: number; mid: number; high: number }> = {
    Small: { low: 10, mid: 11, high: 12 },
    Medium: { low: 14, mid: 15, high: 16 },
    Large: { low: 17, mid: 17.5, high: 18 },
  };

  const range = ranges[cupSize];
  if (goal === "Clarity") {
    return range.low;
  }
  if (goal === "Body") {
    return range.high;
  }
  if (goal === "Sweetness") {
    return roundToOne((range.mid + range.high) / 2);
  }
  return range.mid;
}

function getHotGoalRatioRange(goal: CupGoal) {
  if (goal === "Clarity") {
    return { min: 16.5, max: 18 };
  }
  if (goal === "Balance") {
    return { min: 15, max: 16 };
  }
  if (goal === "Sweetness") {
    return { min: 15, max: 16.5 };
  }
  return { min: 13, max: 15 };
}

function getRatioRangeByMode(resolved: ResolvedInput) {
  if (resolved.cupMode === "Iced" && resolved.icedIntent) {
    return ICED_INTENT_RATIO_RANGES[resolved.icedIntent];
  }
  return getHotGoalRatioRange(resolved.cupGoal);
}

function pickHotRatio(resolved: ResolvedInput) {
  let ratio: number;
  if (resolved.cupGoal === "Clarity") {
    ratio = 17;
  } else if (resolved.cupGoal === "Balance") {
    ratio = 15.5;
  } else if (resolved.cupGoal === "Sweetness") {
    ratio = 15.5;
  } else {
    ratio = 14;
  }

  if (
    resolved.region === "Africa" &&
    resolved.process === "Washed" &&
    resolved.cupGoal === "Clarity"
  ) {
    ratio += 0.5;
  }
  if (
    resolved.region === "Africa" &&
    resolved.process === "Natural" &&
    resolved.cupGoal === "Sweetness"
  ) {
    ratio += 0.5;
  }
  if (
    (resolved.countryKey === "brazil" || resolved.countryKey === "indonesia") &&
    resolved.cupGoal === "Body"
  ) {
    ratio -= 0.5;
  }
  if (resolved.region === "Asia-Pacific" && resolved.cupGoal === "Body") {
    ratio -= 0.5;
  }
  if (resolved.countryKey === "yemen" && resolved.cupGoal === "Sweetness") {
    ratio = 15.5;
  }

  if (resolved.roastLevel === "Light") {
    ratio += 0.5;
  } else if (resolved.roastLevel === "Medium-Dark") {
    ratio -= 0.5;
  }

  ratio = roundToHalf(clamp(ratio, 5, 25));
  const range = getHotGoalRatioRange(resolved.cupGoal);
  ratio = clamp(ratio, range.min, range.max);

  return roundToHalf(ratio);
}

function pickIcedIntentRatio(resolved: ResolvedInput, intent: IcedBrewIntent) {
  const range = ICED_INTENT_RATIO_RANGES[intent];
  let ratio =
    intent === "Flash-Chilled Pour Over"
      ? 14
      : intent === "Iced Filter"
        ? 14
        : 11.5;

  if (resolved.cupGoal === "Clarity") {
    ratio += 0.5;
  } else if (resolved.cupGoal === "Body") {
    ratio -= 0.5;
  }

  if (resolved.roastLevel === "Light") {
    ratio += 0.4;
  } else if (resolved.roastLevel === "Medium-Dark") {
    ratio -= 0.4;
  }

  if (
    intent === "Flash-Chilled Pour Over" &&
    (resolved.countryKey === "ethiopia" || resolved.countryKey === "panama")
  ) {
    ratio += 0.3;
  }

  if (
    intent === "Concentrated Over Ice" &&
    (resolved.countryKey === "brazil" || resolved.region === "Asia-Pacific")
  ) {
    ratio -= 0.3;
  }

  return roundToHalf(clamp(ratio, range.min, range.max));
}

function pickIcedFinalCupTarget(cupSize: CupSize, goal: CupGoal) {
  const range = ICED_CUP_TARGET_RANGES[cupSize];
  if (goal === "Clarity") {
    return range.min;
  }
  if (goal === "Body") {
    return range.max;
  }
  if (goal === "Sweetness") {
    return roundToOne((range.mid + range.max) / 2);
  }
  return range.mid;
}

function pickIcedIceShare(input: {
  goal: CupGoal;
  intent: IcedBrewIntent;
  process: ProcessType;
  roastLevel: RoastLevel;
}) {
  let share =
    input.intent === "Flash-Chilled Pour Over"
      ? 0.4
      : input.intent === "Iced Filter"
        ? 0.3
        : 0.24;

  if (input.goal === "Clarity") {
    share += 0.02;
  } else if (input.goal === "Body") {
    share -= 0.02;
  }

  if (
    input.process === "Anaerobic" ||
    input.process === "Experimental" ||
    input.process === "Co-ferment" ||
    input.roastLevel === "Medium-Dark"
  ) {
    share -= 0.02;
  }

  const range =
    input.intent === "Flash-Chilled Pour Over"
      ? { min: 0.35, max: 0.45 }
      : input.intent === "Iced Filter"
        ? { min: 0.25, max: 0.35 }
        : { min: 0.2, max: 0.28 };

  return clamp(share, range.min, range.max);
}

function pickIcedDose(input: {
  ratio: number;
  targetFinalCup: number;
  iceShare: number;
  cupSize: CupSize;
  goal: CupGoal;
  countryKey: string;
  sensoryIntent: SensoryIntent;
  assumptions: string[];
}) {
  const desiredDose = (input.targetFinalCup * (1 - input.iceShare)) / input.ratio;
  const doseRange = ICED_DOSE_RANGES[input.cupSize];
  let dose = roundToOne(clamp(desiredDose, doseRange.min, doseRange.max));

  if (input.iceShare >= 0.3) {
    dose = roundToOne(
      clamp(dose + (input.iceShare >= 0.38 ? 2 : 1), doseRange.min, doseRange.max),
    );
  }

  if (input.ratio >= 15) {
    const minForRatio =
      input.cupSize === "Small" ? 14 : input.cupSize === "Medium" ? 15 : 16;
    dose = roundToOne(clamp(Math.max(dose, minForRatio), doseRange.min, doseRange.max));
  }

  if (
    input.goal === "Clarity" &&
    isDelicateOriginForClarity(input.countryKey, input.sensoryIntent)
  ) {
    const clarityFloor =
      input.cupSize === "Small" ? 14 : input.cupSize === "Medium" ? 15 : 16;
    dose = roundToOne(clamp(Math.max(dose, clarityFloor), doseRange.min, doseRange.max));
  }

  if (
    input.cupSize === "Large" &&
    input.goal === "Clarity" &&
    isDelicateOriginForClarity(input.countryKey, input.sensoryIntent)
  ) {
    const sensoryBias = input.iceShare >= 0.35 || input.ratio >= 15 ? 2 : 1;
    dose = roundToOne(clamp(dose + sensoryBias, doseRange.min, doseRange.max));
    input.assumptions.push(
      `تم تطبيق زيادة حسية للجرعة (+${sensoryBias}g) للحفاظ على الوضوح العطري في الكوب البارد الكبير.`,
    );
  }

  if ((input.cupSize === "Medium" || input.cupSize === "Large") && dose < 14) {
    dose = roundToOne(Math.max(dose, 14));
  }

  const projectedFinal = roundToOne((dose * input.ratio) / (1 - input.iceShare));
  const targetRange = ICED_CUP_TARGET_RANGES[input.cupSize];

  if (projectedFinal < targetRange.min || projectedFinal > targetRange.max) {
    input.assumptions.push(
      "تم ضبط حجم الكوب البارد حسب حدود Omni Dripper، لذلك قد يختلف الحجم النهائي قليلًا عن الهدف النظري.",
    );
  }

  if (input.iceShare >= 0.3) {
    input.assumptions.push("تم رفع الجرعة قليلًا لمعادلة التخفيف الناتج عن الثلج.");
  }
  if (input.ratio >= 15) {
    input.assumptions.push("تم رفع الجرعة لأن النسبة المرتفعة في المشروبات الباردة تحتاج قوة أعلى.");
  }

  return dose;
}

function pickIcedIcePlacement(intent: IcedBrewIntent): ColdPlan["icePlacement"] {
  if (intent === "Flash-Chilled Pour Over") return "server";
  if (intent === "Concentrated Over Ice") return "cup";
  return "both";
}

function toIcedPlacementText(placement: ColdPlan["icePlacement"]) {
  if (placement === "server") return "in server";
  if (placement === "cup") return "in cup";
  return "both";
}

function buildIcedInstructions(input: {
  intent: IcedBrewIntent;
  icePlacement: ColdPlan["icePlacement"];
  iceGrams: number;
}) {
  const roundedIce = Math.round(input.iceGrams);
  const instructions: string[] = [];

  if (input.icePlacement === "server") {
    instructions.push(`Add ${roundedIce} g ice to the server before brewing.`);
    instructions.push("Brew directly over ice.");
  } else if (input.icePlacement === "cup") {
    instructions.push(`Add ${roundedIce} g ice to the final cup.`);
    instructions.push("Brew into server first, then pour over ice.");
  } else {
    const serverIce = Math.round(roundedIce * 0.6);
    const cupIce = Math.max(0, roundedIce - serverIce);
    instructions.push(`Add ${serverIce} g ice to the server before brewing.`);
    instructions.push(`Add ${cupIce} g ice to the final cup.`);
  }

  instructions.push("After brewing, swirl gently and serve over fresh ice if desired.");
  return instructions;
}

function applyColdQualityControl(input: {
  resolved: ResolvedInput;
  totalWater: number;
  ratio: number;
  coldPlan: ColdPlan;
}) {
  const notes: string[] = [];
  const coldPlan = { ...input.coldPlan };
  let ratio = input.ratio;
  let totalWater = input.totalWater;

  if (input.resolved.cupGoal === "Clarity" && ratio < 12.5) {
    ratio = roundToHalf(clamp(12.5, ICED_INTENT_RATIO_RANGES[coldPlan.intent].min, ICED_INTENT_RATIO_RANGES[coldPlan.intent].max));
    totalWater = roundToOne(ratio * (input.totalWater / input.ratio));
    notes.push("Brew concentration was relaxed slightly to preserve clarity in cold serving.");
  }

  if (input.resolved.cupGoal === "Body" && ratio > 12) {
    ratio = roundToHalf(clamp(12, ICED_INTENT_RATIO_RANGES[coldPlan.intent].min, ICED_INTENT_RATIO_RANGES[coldPlan.intent].max));
    totalWater = roundToOne(ratio * (input.totalWater / input.ratio));
    notes.push("Brew concentration was tightened to protect body after ice dilution.");
  }

  const maxIceByGoal =
    input.resolved.cupGoal === "Body"
      ? totalWater * 0.28
      : input.resolved.cupGoal === "Sweetness"
        ? totalWater * 0.35
        : totalWater * 0.45;

  if (coldPlan.iceGrams > maxIceByGoal) {
    coldPlan.iceGrams = roundToOne(maxIceByGoal);
    notes.push("Ice was reduced slightly to avoid over-dilution for the selected cup goal.");
  }

  if (coldPlan.iceGrams < totalWater * 0.2 && input.resolved.cupGoal === "Clarity") {
    coldPlan.iceGrams = roundToOne(totalWater * 0.25);
    notes.push("Ice was raised slightly to keep a clean, refreshing clarity in cold mode.");
  }

  coldPlan.brewWater = roundToOne(totalWater);
  coldPlan.iceMlEquivalent = roundToOne(coldPlan.iceGrams);
  coldPlan.expectedFinalBeverage = roundToOne(coldPlan.brewWater + coldPlan.iceGrams);
  coldPlan.qualityNotes = [...coldPlan.qualityNotes, ...notes];
  coldPlan.iceInstructions = buildIcedInstructions({
    intent: coldPlan.intent,
    icePlacement: coldPlan.icePlacement,
    iceGrams: coldPlan.iceGrams,
  });

  return { coldPlan, ratio, totalWater, notes };
}

function pickBaseGrind(roast: RoastLevel, process: ProcessType) {
  if (roast === "Medium-Dark") {
    return 62;
  }
  if (roast === "Light" && process === "Washed") {
    return 48;
  }
  if (roast === "Light" && process === "Natural") {
    return 52;
  }
  if (roast === "Light-Medium" && process === "Washed") {
    return 51;
  }
  if (roast === "Medium" && process === "Washed") {
    return 55;
  }
  if (roast === "Medium" && process === "Natural") {
    return 59;
  }
  if (process === "Honey") {
    return 54;
  }
  if (process === "Anaerobic" || process === "Experimental" || process === "Co-ferment") {
    return 57;
  }
  return 54;
}

function getBrewTimeTarget(goal: CupGoal) {
  return GOAL_BREW_TIME_TARGETS[goal];
}

function estimateDrawdownSeconds(input: {
  dose: number;
  ratio: number;
  grindSize: number;
  pours: number;
  process: ProcessType;
  flowAvg: number;
}) {
  const processEffect =
    input.process === "Washed"
      ? 8
      : input.process === "Honey"
        ? 6
        : input.process === "Natural"
          ? 5
          : 3;
  const seconds =
    95 +
    (input.ratio - 14) * 8 +
    (58 - input.grindSize) * 2.2 +
    (input.pours - 2) * 15 +
    (input.dose - 14) * 1.5 +
    processEffect -
    (input.flowAvg - 3.2) * 22;
  return clamp(Math.round(seconds), 70, 210);
}

function adjustGrindByBrewTime(params: {
  grindSize: number;
  target: BrewTimeTarget;
  dose: number;
  ratio: number;
  pours: number;
  process: ProcessType;
  flowAvg: number;
}) {
  let grind = params.grindSize;
  let estimated = estimateDrawdownSeconds({
    dose: params.dose,
    ratio: params.ratio,
    grindSize: grind,
    pours: params.pours,
    process: params.process,
    flowAvg: params.flowAvg,
  });

  for (let i = 0; i < 8; i += 1) {
    if (estimated < params.target.minSec) {
      grind = clamp(grind - 1, 1, 80);
    } else if (estimated > params.target.maxSec) {
      grind = clamp(grind + 1, 1, 80);
    } else {
      break;
    }

    estimated = estimateDrawdownSeconds({
      dose: params.dose,
      ratio: params.ratio,
      grindSize: grind,
      pours: params.pours,
      process: params.process,
      flowAvg: params.flowAvg,
    });
  }

  return { grind, estimated };
}

function pickPourCount(resolved: ResolvedInput) {
  if (resolved.cupMode === "Iced" && resolved.icedIntent) {
    if (resolved.icedIntent === "Flash-Chilled Pour Over") {
      return resolved.cupGoal === "Clarity" ? 4 : 3;
    }
    if (resolved.icedIntent === "Concentrated Over Ice") {
      return resolved.cupSize === "Large" || resolved.cupGoal === "Sweetness" ? 3 : 2;
    }
    return 3;
  }

  let pours = resolved.cupGoal === "Clarity" ? 4 : resolved.cupGoal === "Body" ? 2 : 3;

  if (
    resolved.process === "Anaerobic" ||
    resolved.process === "Experimental" ||
    resolved.process === "Co-ferment"
  ) {
    pours = Math.min(pours, 3);
  }

  if (resolved.cupGoal === "Body" && resolved.cupSize === "Large") {
    pours = 3;
  }

  return clamp(pours, 2, 4);
}

function getProcessBloomMultiplier(process: ProcessType) {
  if (process === "Washed") {
    return 2.5;
  }
  if (process === "Natural") {
    return 2.2;
  }
  if (process === "Honey") {
    return 2.4;
  }
  return 2.2;
}

function pickBloomWater(input: {
  totalWater: number;
  dose: number;
  process: ProcessType;
  daysOffRoast: number | null;
  cupMode: CupMode;
  icedIntent: IcedBrewIntent | null;
}) {
  if (typeof input.daysOffRoast === "number" && input.daysOffRoast <= 3) {
    return roundToOne(Math.min(input.dose * 3, input.totalWater * 0.6));
  }

  if (input.cupMode === "Iced" && input.icedIntent) {
    const intentBloomRange =
      input.icedIntent === "Flash-Chilled Pour Over"
        ? { min: 0.2, max: 0.25, multiplier: 2.3 }
        : input.icedIntent === "Concentrated Over Ice"
          ? { min: 0.18, max: 0.22, multiplier: 2.05 }
          : { min: 0.2, max: 0.24, multiplier: 2.25 };
    const baseline = input.dose * intentBloomRange.multiplier;
    return roundToOne(
      clamp(baseline, intentBloomRange.min * input.totalWater, intentBloomRange.max * input.totalWater),
    );
  }

  const baseline = input.dose * getProcessBloomMultiplier(input.process);
  const minByDose = input.dose * 2.2;
  const maxByDose = input.dose * 2.8;
  return roundToOne(clamp(baseline, minByDose, maxByDose));
}

function getRemainingPourWeights(
  goal: CupGoal,
  pours: number,
  cupMode: CupMode,
  icedIntent: IcedBrewIntent | null,
): number[] {
  if (pours <= 1) {
    return [1];
  }

  if (cupMode === "Iced" && icedIntent) {
    if (icedIntent === "Flash-Chilled Pour Over") {
      return Array.from({ length: pours }, () => 1);
    }
    if (icedIntent === "Concentrated Over Ice") {
      if (pours === 2) return [0.38, 0.62];
      if (pours === 3) return [0.2, 0.34, 0.46];
      return [0.12, 0.22, 0.28, 0.38];
    }
    if (pours === 2) return [0.5, 0.5];
    if (pours === 3) return [0.3, 0.35, 0.35];
    return [0.24, 0.26, 0.25, 0.25];
  }

  if (goal === "Clarity") {
    if (pours === 2) {
      return [0.53, 0.47];
    }
    if (pours === 3) {
      return [0.35, 0.37, 0.28];
    }
    return [0.28, 0.3, 0.24, 0.18];
  }

  if (goal === "Sweetness") {
    if (pours === 2) {
      return [0.45, 0.55];
    }
    if (pours === 3) {
      return [0.28, 0.44, 0.28];
    }
    return [0.2, 0.3, 0.3, 0.2];
  }

  if (goal === "Body") {
    if (pours === 2) {
      return [0.42, 0.58];
    }
    if (pours === 3) {
      return [0.22, 0.44, 0.34];
    }
    return [0.18, 0.3, 0.3, 0.22];
  }

  if (pours === 2) {
    return [0.5, 0.5];
  }
  if (pours === 3) {
    return [0.34, 0.33, 0.33];
  }
  return [0.26, 0.24, 0.25, 0.25];
}

function allocatePourVolumes(input: {
  totalWater: number;
  bloomWater: number;
  pours: number;
  goal: CupGoal;
  cupMode: CupMode;
  icedIntent: IcedBrewIntent | null;
}) {
  const remainingCount = Math.max(input.pours - 1, 1);
  const remainingWater = roundToOne(input.totalWater - input.bloomWater);
  const weights = getRemainingPourWeights(
    input.goal,
    remainingCount,
    input.cupMode,
    input.icedIntent,
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const values: number[] = [input.bloomWater];
  let allocated = input.bloomWater;

  for (let index = 0; index < remainingCount; index += 1) {
    if (index === remainingCount - 1) {
      values.push(roundToOne(input.totalWater - allocated));
      continue;
    }
    const portion = roundToOne((remainingWater * weights[index]) / weightSum);
    values.push(portion);
    allocated = roundToOne(allocated + portion);
  }

  return values.map((value) => roundToOne(Math.max(0, value)));
}

function pickCurveMode(resolved: ResolvedInput) {
  const floralCountry = FLORAL_DELICATE_COUNTRIES.has(resolved.countryKey);

  if (resolved.cupMode === "Iced") {
    const shouldDecline =
      resolved.icedIntent === "Flash-Chilled Pour Over" &&
      (resolved.roastLevel === "Light" ||
        resolved.roastLevel === "Light-Medium" ||
        resolved.cupGoal === "Clarity" ||
        floralCountry);
    return shouldDecline ? "declining" : "fixed";
  }

  const needsDeclining =
    resolved.roastLevel === "Light" ||
    (resolved.roastLevel === "Light-Medium" && resolved.cupGoal === "Clarity") ||
    floralCountry;

  const prefersFixed =
    resolved.cupGoal === "Balance" ||
    resolved.cupGoal === "Body" ||
    resolved.roastLevel === "Medium";

  if (needsDeclining && !prefersFixed) {
    return "declining" as CurveMode;
  }
  return "fixed" as CurveMode;
}

function pickBaseTemperature(resolved: ResolvedInput, curve: CurveMode) {
  const range = getRoastTempRange(resolved.roastLevel, resolved.cupMode);
  let base = range.base;

  if (resolved.cupMode === "Iced") {
    if (
      resolved.icedIntent === "Flash-Chilled Pour Over" &&
      (resolved.cupGoal === "Clarity" || FLORAL_DELICATE_COUNTRIES.has(resolved.countryKey))
    ) {
      base += 0.3;
    } else if (resolved.icedIntent === "Concentrated Over Ice") {
      base -= 0.2;
    }

    if (resolved.cupGoal === "Body") {
      base -= 0.2;
    } else if (resolved.cupGoal === "Clarity") {
      base += 0.2;
    }
  } else {
    if (resolved.cupGoal === "Clarity") {
      base += 0.3;
    } else if (resolved.cupGoal === "Sweetness") {
      base += 0.2;
    } else if (resolved.cupGoal === "Body") {
      base -= 0.3;
    }
  }

  if (
    resolved.process === "Anaerobic" ||
    resolved.process === "Experimental" ||
    resolved.process === "Co-ferment"
  ) {
    base -= resolved.cupMode === "Iced" ? 0.5 : 0.4;
  }
  if (resolved.roastLevel === "Medium-Dark") {
    base -= resolved.cupMode === "Iced" ? 0.4 : 0.3;
  }
  if (typeof resolved.daysOffRoast === "number" && resolved.daysOffRoast >= 11) {
    base += resolved.cupMode === "Iced" ? 0.1 : 0.2;
  }
  if (curve === "declining") {
    base += 0.1;
  }

  return roundToOne(clamp(base, range.min, range.max));
}

function pickFlowRates(
  goal: CupGoal,
  pours: number,
  cupMode: CupMode,
  icedIntent: IcedBrewIntent | null,
) {
  const rates: number[] = [];
  rates.push(3.0);

  for (let index = 2; index <= pours; index += 1) {
    if (goal === "Clarity") {
      if (cupMode === "Iced" && icedIntent === "Flash-Chilled Pour Over") {
        rates.push(index === pours ? 3.0 : 3.1);
      } else {
        rates.push(index === pours ? 3.0 : index === 2 ? 3.1 : 3.2);
      }
    } else if (goal === "Balance") {
      rates.push(index === pours ? 3.1 : index === 2 ? 3.3 : 3.2);
    } else if (goal === "Sweetness") {
      rates.push(index === pours ? 3.0 : index === 2 ? 3.2 : 3.1);
    } else {
      rates.push(index === pours ? 3.3 : 3.5);
    }
  }

  return rates.map((value) => roundToOne(clamp(value, 3, 3.5)));
}

function pickAgitation(
  step: number,
  totalPours: number,
  goal: CupGoal,
  process: ProcessType,
  cupMode: CupMode,
  icedIntent: IcedBrewIntent | null,
): Agitation {
  if (process === "Anaerobic" || process === "Experimental" || process === "Co-ferment") {
    return "None";
  }

  if (cupMode === "Iced" && icedIntent) {
    if (icedIntent === "Flash-Chilled Pour Over") {
      return step === 1 ? "On before" : "None";
    }
    if (icedIntent === "Concentrated Over Ice") {
      if (goal === "Sweetness" && step === 1) {
        return "On before";
      }
      return "None";
    }
    if (goal === "Sweetness" && step === 2) {
      return "On after";
    }
    return step === 1 ? "On before" : "None";
  }

  if (goal === "Clarity") {
    return step === 1 ? "On before" : "None";
  }

  if (process === "Washed") {
    if (goal === "Sweetness" && step === 2) {
      return "On after";
    }
    return step === 1 ? "On before" : "None";
  }

  if (process === "Natural") {
    if (goal === "Sweetness" && step === 2) {
      return "On after";
    }
    return step === 1 ? "On before" : "None";
  }

  if (process === "Honey") {
    if (goal === "Sweetness" && step > 1 && step < totalPours) {
      return "On after";
    }
    return step === 1 ? "On before" : "None";
  }

  if (goal === "Body") {
    return "None";
  }

  return step === 1 ? "On before" : "None";
}

function pickPourStyle(step: number, totalPours: number, goal: CupGoal): PourStyle {
  if (step === 1 || step === totalPours) {
    return "Centered";
  }
  if (goal === "Body") {
    return "Circular";
  }
  return "Spiral";
}

function pickBloomPause(input: {
  daysOffRoast: number | null;
  goal: CupGoal;
  process: ProcessType;
  bloomWater: number;
  dose: number;
}) {
  let pause = 34;
  if (typeof input.daysOffRoast === "number") {
    if (input.daysOffRoast <= 3) {
      pause = 45;
    } else if (input.daysOffRoast >= 11) {
      pause = 30;
    }
  }

  if (input.goal === "Clarity") {
    pause += 4;
  } else if (input.goal === "Body") {
    pause -= 4;
  }

  if (
    input.process === "Anaerobic" ||
    input.process === "Experimental" ||
    input.process === "Co-ferment"
  ) {
    pause -= 2;
  }

  if (typeof input.daysOffRoast === "number" && input.daysOffRoast <= 3) {
    pause = clamp(pause, 40, 50);
  } else {
    pause = clamp(pause, 30, 45);
  }

  if (input.bloomWater > input.dose * 3) {
    pause = Math.max(35, pause);
  }

  return Math.round(clamp(pause, 0, 59));
}

function pickPause(step: number, totalPours: number, bloomPause: number, goal: CupGoal) {
  if (step === totalPours) {
    return 0;
  }
  if (step === 1) {
    return bloomPause;
  }
  if (goal === "Body") {
    return 20;
  }
  if (goal === "Sweetness") {
    return 18;
  }
  return 15;
}

function pickTemperatures(input: {
  pours: number;
  curve: CurveMode;
  baseTemp: number;
  roastLevel: RoastLevel;
  cupMode: CupMode;
  minTotalDrop?: number;
}) {
  const range = getRoastTempRange(input.roastLevel, input.cupMode);
  const temps: number[] = [];

  for (let index = 0; index < input.pours; index += 1) {
    const drop = input.curve === "declining" ? index * (input.cupMode === "Iced" ? 0.35 : 0.4) : 0;
    temps.push(roundToOne(clamp(input.baseTemp - drop, range.min, range.max)));
  }

  if (
    input.curve === "declining" &&
    input.pours > 1 &&
    typeof input.minTotalDrop === "number" &&
    input.minTotalDrop > 0
  ) {
    const currentDrop = roundToOne(temps[0] - temps[temps.length - 1]);
    if (currentDrop < input.minTotalDrop) {
      const neededDrop = input.minTotalDrop - currentDrop;
      const first = temps[0];
      for (let index = 1; index < temps.length; index += 1) {
        const ratio = index / (temps.length - 1);
        const target = roundToOne(first - (currentDrop + neededDrop) * ratio);
        temps[index] = roundToOne(clamp(Math.min(temps[index], target), range.min, range.max));
      }
    }
  }

  return temps;
}

function pickRpm(goal: CupGoal, grindSize: number) {
  const ranges: Record<CupGoal, { min: number; max: number; base: number }> = {
    Clarity: { min: 80, max: 88, base: 84 },
    Balance: { min: 82, max: 90, base: 86 },
    Sweetness: { min: 78, max: 88, base: 82 },
    Body: { min: 70, max: 84, base: 76 },
  };
  const target = ranges[goal];
  let rpm = target.base;

  if (grindSize <= 48) {
    rpm -= 2;
  } else if (grindSize <= 52) {
    rpm -= 1;
  } else if (grindSize >= 62) {
    rpm += 2;
  } else if (grindSize >= 58) {
    rpm += 1;
  }

  return Math.round(clamp(rpm, target.min, target.max));
}

function normalizeVolumesToTotal(volumes: number[], totalWater: number) {
  const fixed = volumes.map((volume) => roundToOne(Math.max(0, volume)));
  if (fixed.length === 0) {
    return fixed;
  }

  const sumWithoutLast = roundToOne(fixed.slice(0, -1).reduce((sum, value) => sum + value, 0));
  fixed[fixed.length - 1] = roundToOne(Math.max(0, totalWater - sumWithoutLast));
  return fixed;
}

function areVolumesFlat(volumes: number[]) {
  if (volumes.length < 3) {
    return false;
  }
  const max = Math.max(...volumes);
  const min = Math.min(...volumes);
  return max - min <= 2;
}

function applyProgressiveClarityVolumes(volumes: number[], totalWater: number) {
  if (volumes.length < 3) {
    return normalizeVolumesToTotal(volumes, totalWater);
  }

  const tuned = [...volumes];
  const variation = Math.max(2, roundToOne(totalWater * 0.01));

  if (tuned.length >= 3) {
    tuned[1] = roundToOne(Math.max(tuned[1], tuned[0] + variation));
  }
  if (tuned.length >= 4) {
    tuned[2] = roundToOne(Math.max(tuned[2], tuned[1] - 1));
  }

  let normalized = normalizeVolumesToTotal(tuned, totalWater);
  const minLastPour = Math.max(8, roundToOne(totalWater * 0.1));
  const lastIndex = normalized.length - 1;
  if (normalized[lastIndex] < minLastPour && normalized.length >= 3) {
    const deficit = roundToOne(minLastPour - normalized[lastIndex]);
    const pullFromSecond = roundToOne(deficit / 2);
    normalized[1] = roundToOne(Math.max(0, normalized[1] - pullFromSecond));
    if (normalized.length >= 4) {
      normalized[2] = roundToOne(Math.max(0, normalized[2] - (deficit - pullFromSecond)));
    }
    normalized = normalizeVolumesToTotal(normalized, totalWater);
  }

  return normalized;
}

function countAfterAgitation(pours: Array<{ agitation: Agitation }>) {
  return pours.filter((pour) => pour.agitation === "On after" || pour.agitation === "Both").length;
}

function isHighUnderExtractionRisk(input: {
  ratio: number;
  grindSize: number;
  pours: number;
  goal: CupGoal;
}) {
  if (input.goal === "Body") {
    return false;
  }
  return input.ratio >= 17 && input.grindSize >= 54 && input.pours >= 3;
}

function isSafeButFlatRecipe(input: {
  goal: CupGoal;
  ratio: number;
  grindSize: number;
  pours: number[];
  agitation: Agitation[];
}) {
  if (input.goal !== "Clarity") {
    return false;
  }
  const lowAgitation = input.agitation.every((value) => value === "None" || value === "On before");
  return areVolumesFlat(input.pours) && lowAgitation && input.grindSize >= 54 && input.ratio >= 17;
}

function countTrue(values: boolean[]) {
  return values.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

function hasDecliningCurve(temperatures: number[]) {
  if (temperatures.length < 2) {
    return false;
  }
  return temperatures[0] - temperatures[temperatures.length - 1] >= 1;
}

type FinalGrindPassInput = {
  resolved: ResolvedInput;
  ratio: number;
  dose: number;
  pours: number;
  grindSize: number;
  bloomVolume: number;
  bloomPause: number;
  temperatures: number[];
  agitations: Agitation[];
  flowRates: number[];
  totalWater: number;
  coldPlan: ColdPlan | null;
};

type FinalGrindPassResult = {
  grindSize: number;
  coolTemperatureBy: number;
  reduceAgitationAfterBloom: boolean;
};

function runFinalGrindPass(input: FinalGrindPassInput): FinalGrindPassResult {
  let grind = input.grindSize;
  let coolTemperatureBy = 0;
  let reduceAgitationAfterBloom = false;

  const avgTemp =
    input.temperatures.reduce((sum, value) => sum + value, 0) /
    Math.max(1, input.temperatures.length);
  const lowAgitation =
    input.agitations.filter((agitation) => agitation === "On after" || agitation === "Both").length <= 1;
  const bloomRatio = input.bloomVolume / Math.max(1, input.dose);
  const iceShare =
    input.resolved.cupMode === "Iced" && input.coldPlan
      ? clamp(input.coldPlan.iceGrams / Math.max(1, input.coldPlan.expectedFinalBeverage), 0, 0.7)
      : 0;

  if (
    input.resolved.cupGoal === "Clarity" &&
    (input.resolved.process === "Washed" || input.resolved.process === "Honey") &&
    (input.resolved.roastLevel === "Light" || input.resolved.roastLevel === "Light-Medium") &&
    input.ratio >= 16.5
  ) {
    grind = Math.round(clamp(grind, 46, 51));
  }

  if (input.ratio >= 16.5 && input.ratio <= 18) {
    grind = Math.round(clamp(grind, 45, 52));
  } else if (input.ratio >= 15 && input.ratio <= 16) {
    grind = Math.round(clamp(grind, 47, 58));
  } else if (input.ratio >= 13 && input.ratio <= 14.5) {
    grind = Math.round(clamp(grind, 48, 64));
  } else if (input.ratio > 18) {
    grind = Math.round(clamp(grind - 2, 44, 49));
  }

  if (input.resolved.process === "Washed") {
    grind -= 1;
  } else if (input.resolved.process === "Natural") {
    grind += input.ratio >= 16.5 ? 1 : 3;
  } else if (input.resolved.process === "Honey") {
    grind += 0;
  } else if (
    input.resolved.process === "Anaerobic" ||
    input.resolved.process === "Experimental" ||
    input.resolved.process === "Co-ferment"
  ) {
    grind = Math.round(clamp(grind, 46, 58));
  }

  if (
    input.resolved.region === "Africa" &&
    input.resolved.cupGoal === "Clarity"
  ) {
    grind -= 1;
  } else if (
    (input.resolved.countryKey === "brazil" || input.resolved.region === "Asia-Pacific") &&
    input.resolved.cupGoal === "Body"
  ) {
    grind += 1;
  }

  if (input.pours === 2) {
    grind += 1;
  } else if (input.pours >= 4 && input.ratio >= 16.5 && input.resolved.cupGoal === "Clarity") {
    grind -= 2;
  }

  if (bloomRatio >= 2.8 && input.bloomPause >= 35 && grind > 52) {
    grind -= 2;
  } else if (bloomRatio <= 2.1 && grind < 45) {
    grind += 1;
  }

  if (
    avgTemp <= 91.5 &&
    grind >= 53 &&
    input.ratio >= 16.5 &&
    input.resolved.process === "Washed" &&
    input.resolved.cupGoal === "Clarity"
  ) {
    grind -= 3;
  }

  if (
    avgTemp >= 94.5 &&
    grind <= 45 &&
    input.ratio <= 14 &&
    input.resolved.roastLevel === "Medium-Dark"
  ) {
    grind += 3;
    coolTemperatureBy = 0.3;
    reduceAgitationAfterBloom = true;
  }

  if (input.resolved.cupMode === "Iced") {
    if (iceShare >= 0.3) {
      grind -= 1;
    }
    if (input.ratio >= 15 && input.resolved.cupGoal === "Clarity") {
      grind -= 1;
    }
  }

  if (
    input.resolved.cupSize === "Large" &&
    input.resolved.cupGoal === "Clarity" &&
    input.ratio >= 16.5
  ) {
    grind -= 1;
  }

  const underRiskSignals = countTrue([
    input.ratio >= 17,
    grind >= 53,
    input.pours >= 4,
    lowAgitation,
    input.resolved.process === "Washed",
    input.resolved.roastLevel === "Light" || input.resolved.roastLevel === "Light-Medium",
    input.resolved.cupSize === "Large",
    hasDecliningCurve(input.temperatures),
  ]);
  if (underRiskSignals >= 3) {
    grind = Math.round(clamp(grind, 48, 51));
  }

  const agitationEvents = input.agitations.filter(
    (agitation) => agitation === "On after" || agitation === "Both",
  ).length;
  const overRiskSignals = countTrue([
    input.ratio <= 14,
    grind <= 45,
    avgTemp >= 94,
    agitationEvents >= 2,
    input.pours >= 4,
    input.resolved.roastLevel === "Medium-Dark",
  ]);
  if (overRiskSignals >= 3) {
    grind += 3;
    coolTemperatureBy = Math.max(coolTemperatureBy, 0.3);
    reduceAgitationAfterBloom = true;
  }

  if (
    input.resolved.cupGoal === "Clarity" &&
    isDelicateOriginForClarity(input.resolved.countryKey, input.resolved.sensoryIntent) &&
    input.ratio >= 16.5 &&
    grind > 51
  ) {
    grind = 51;
  }

  const roastBounds =
    input.resolved.roastLevel === "Medium-Dark"
      ? { min: 50, max: 68 }
      : input.resolved.roastLevel === "Medium"
        ? { min: 47, max: 63 }
        : { min: 44, max: 58 };
  grind = Math.round(clamp(grind, roastBounds.min, roastBounds.max));

  return {
    grindSize: grind,
    coolTemperatureBy,
    reduceAgitationAfterBloom,
  };
}

function isLikelyWeakIcedCup(input: {
  dose: number;
  ratio: number;
  cupSize: CupSize;
  goal: CupGoal;
  countryKey: string;
  sensoryIntent: SensoryIntent;
  iceShare: number;
}) {
  let score = 0;
  if (input.cupSize === "Medium" || input.cupSize === "Large") score += 1;
  if (input.ratio >= 15) score += 1;
  if (input.iceShare >= 0.3) score += 1;
  if (input.goal === "Clarity") score += 1;
  if (isDelicateOriginForClarity(input.countryKey, input.sensoryIntent)) score += 1;

  const softDoseFloor =
    input.cupSize === "Small" ? 14 : input.cupSize === "Medium" ? 15 : 16;
  if (input.dose < softDoseFloor) score += 2;

  return score >= 4;
}

function enforceRatioByMode(resolved: ResolvedInput, ratio: number) {
  const range = getRatioRangeByMode(resolved);
  return clamp(ratio, range.min, range.max);
}

function validateAndFinalizeRecipe(
  recipe: CandidateRecipe,
  resolved: ResolvedInput,
): GeneratedRecipe {
  const roastRange = getRoastTempRange(resolved.roastLevel, resolved.cupMode);

  let dose = roundToOne(clamp(recipe.dose, 5, 18));
  let ratio = roundToHalf(clamp(recipe.ratio, 5, 25));
  ratio = roundToHalf(enforceRatioByMode(resolved, ratio));
  if (
    resolved.cupMode === "Hot" &&
    resolved.cupGoal === "Clarity" &&
    resolved.cupSize === "Large" &&
    ratio >= 17 &&
    dose < 16
  ) {
    dose = 16;
  }

  if (resolved.cupMode === "Iced") {
    const icedRange = ICED_DOSE_RANGES[resolved.cupSize];
    dose = roundToOne(clamp(dose, icedRange.min, icedRange.max));

    if ((resolved.cupSize === "Medium" || resolved.cupSize === "Large") && dose < 14) {
      dose = 14;
    }

    if (ratio >= 15) {
      const minForHighRatio =
        resolved.cupSize === "Small" ? 14 : resolved.cupSize === "Medium" ? 15 : 16;
      dose = roundToOne(clamp(Math.max(dose, minForHighRatio), icedRange.min, icedRange.max));
    }

    if (
      resolved.cupGoal === "Clarity" &&
      isDelicateOriginForClarity(resolved.countryKey, resolved.sensoryIntent)
    ) {
      const clarityFloor =
        resolved.cupSize === "Small" ? 14 : resolved.cupSize === "Medium" ? 15 : 16;
      dose = roundToOne(clamp(Math.max(dose, clarityFloor), icedRange.min, icedRange.max));
    }

    const finalTarget = Math.max(1, toFiniteNumber(recipe.coldPlan?.expectedFinalBeverage) ?? (dose * ratio));
    const iceGramsCandidate = Math.max(0, toFiniteNumber(recipe.coldPlan?.iceGrams) ?? 0);
    const iceShare = clamp(iceGramsCandidate / finalTarget, 0, 0.6);
    if (
      isLikelyWeakIcedCup({
        dose,
        ratio,
        cupSize: resolved.cupSize,
        goal: resolved.cupGoal,
        countryKey: resolved.countryKey,
        sensoryIntent: resolved.sensoryIntent,
        iceShare,
      })
    ) {
      const bump =
        resolved.cupSize === "Large" &&
        resolved.cupGoal === "Clarity" &&
        isDelicateOriginForClarity(resolved.countryKey, resolved.sensoryIntent)
          ? 2
          : 1;
      dose = roundToOne(clamp(dose + bump, icedRange.min, icedRange.max));
    }
  }

  let totalWater = roundToOne(dose * ratio);

  let pours = Math.round(clamp(recipe.numberOfPours, 2, 4));

  if (resolved.cupGoal === "Clarity") {
    pours = 4;
  }
  if (resolved.cupGoal === "Body") {
    pours = clamp(pours, 2, 3);
  }

  let grindSize = Math.round(clamp(recipe.grindSize, 1, 80));
  if (resolved.cupGoal !== "Body" && ratio >= 16.5 && ratio <= 18) {
    grindSize = Math.round(clamp(grindSize, 45, 52));
  }
  if (isHighUnderExtractionRisk({ ratio, grindSize, pours, goal: resolved.cupGoal })) {
    grindSize = Math.round(clamp(grindSize - 4, 45, 80));
    if (ratio > 16.5) {
      ratio = 16.5;
      totalWater = roundToOne(dose * ratio);
    }
  }

  const validPours = recipe.pours
    .slice(0, pours)
    .map((pour, index) => ({
      used: true,
      volume: roundToOne(Math.max(0, pour.volume)),
      temperature: roundToOne(clamp(pour.temperature, roastRange.min, roastRange.max)),
      flowRate: roundToOne(clamp(pour.flowRate, 3, 3.5)),
      pause: Math.round(clamp(pour.pause, 0, 59)),
      pourStyle: pour.pourStyle,
      agitation: pour.agitation,
      index,
    }))
    .filter((pour) => Number.isFinite(pour.volume));

  if (validPours.length !== pours) {
    while (validPours.length < pours) {
      validPours.push({
        used: true,
        volume: 0,
        temperature: roundToOne(clamp(recipe.pours[0]?.temperature || roastRange.base, roastRange.min, roastRange.max)),
        flowRate: 3.1,
        pause: 0,
        pourStyle: "Centered",
        agitation: "None",
        index: validPours.length,
      });
    }
  }

  if (validPours.length > 0) {
    const isFresh = typeof resolved.daysOffRoast === "number" && resolved.daysOffRoast <= 3;
    const bloomMin = roundToOne(dose * 2.2);
    const bloomMax = roundToOne(dose * 2.8);
    if (isFresh) {
      validPours[0].volume = roundToOne(clamp(dose * 3, 0.2 * totalWater, 0.35 * totalWater));
      validPours[0].pause = Math.round(clamp(Math.max(validPours[0].pause, 40), 40, 50));
    } else {
      validPours[0].volume = roundToOne(clamp(validPours[0].volume, bloomMin, bloomMax));
      validPours[0].pause = Math.round(clamp(validPours[0].pause, 30, 45));
    }
    if (validPours[0].volume > dose * 3) {
      validPours[0].pause = Math.max(validPours[0].pause, 35);
    }

    if (resolved.cupGoal === "Clarity") {
      const currentVolumes = validPours.map((pour) => pour.volume);
      const tunedVolumes =
        areVolumesFlat(currentVolumes) || currentVolumes[1] <= currentVolumes[0]
          ? applyProgressiveClarityVolumes(currentVolumes, totalWater)
          : normalizeVolumesToTotal(currentVolumes, totalWater);
      tunedVolumes.forEach((value, index) => {
        if (validPours[index]) {
          validPours[index].volume = value;
        }
      });
    }

    if (resolved.process === "Washed" && resolved.cupGoal === "Clarity") {
      validPours.forEach((pour, index) => {
        pour.agitation = index === 0 ? "On before" : "None";
      });
      if (countAfterAgitation(validPours) > 1) {
        validPours.forEach((pour, index) => {
          if (index > 0) {
            pour.agitation = "None";
          }
        });
      }
    }

    if (
      resolved.cupGoal === "Clarity" &&
      FLORAL_DELICATE_COUNTRIES.has(resolved.countryKey) &&
      validPours.length > 1
    ) {
      const firstTemp = validPours[0].temperature;
      let targetLast = roundToOne(Math.max(roastRange.min, firstTemp - 1.5));
      if (firstTemp - targetLast < 1.5 && firstTemp < roastRange.max) {
        const boostedFirst = roundToOne(clamp(firstTemp + 0.3, roastRange.min, roastRange.max));
        validPours[0].temperature = boostedFirst;
        targetLast = roundToOne(Math.max(roastRange.min, boostedFirst - 1.5));
      }
      for (let index = 1; index < validPours.length; index += 1) {
        const stepRatio = index / (validPours.length - 1);
        const target = roundToOne(validPours[0].temperature - (validPours[0].temperature - targetLast) * stepRatio);
        validPours[index].temperature = roundToOne(clamp(Math.min(validPours[index].temperature, target), roastRange.min, roastRange.max));
      }
    }

    const sumWithoutLast = roundToOne(
      validPours.slice(0, -1).reduce((sum, pour) => sum + pour.volume, 0),
    );
    let lastVolume = roundToOne(totalWater - sumWithoutLast);

    if (lastVolume < 0.1 && validPours.length > 1) {
      const deficit = roundToOne(0.1 - lastVolume);
      lastVolume = 0.1;
      validPours[validPours.length - 2].volume = roundToOne(
        Math.max(0.1, validPours[validPours.length - 2].volume - deficit),
      );
    }

    validPours[validPours.length - 1].volume = roundToOne(lastVolume);
  }

  const avgFlowRate =
    validPours.reduce((sum, pour) => sum + pour.flowRate, 0) / Math.max(validPours.length, 1);
  const brewTarget = getBrewTimeTarget(resolved.cupGoal);
  let predictedBrewTime = estimateDrawdownSeconds({
    dose,
    ratio,
    grindSize,
    pours,
    process: resolved.process,
    flowAvg: avgFlowRate,
  });
  if (predictedBrewTime < brewTarget.minSec) {
    const delta = brewTarget.minSec - predictedBrewTime;
    const grindDrop = Math.min(6, Math.max(2, Math.ceil(delta / 10)));
    grindSize = Math.round(clamp(grindSize - grindDrop, 1, 80));
    predictedBrewTime = estimateDrawdownSeconds({
      dose,
      ratio,
      grindSize,
      pours,
      process: resolved.process,
      flowAvg: avgFlowRate,
    });
  } else if (predictedBrewTime > brewTarget.maxSec + 15) {
    const delta = predictedBrewTime - brewTarget.maxSec;
    const grindUp = Math.min(4, Math.max(1, Math.ceil(delta / 14)));
    grindSize = Math.round(clamp(grindSize + grindUp, 1, 80));
  }

  const finalVolumesForRisk = validPours.map((pour) => pour.volume);
  if (
    resolved.cupGoal !== "Body" &&
    ratio >= 17 &&
    grindSize >= 54 &&
    areVolumesFlat(finalVolumesForRisk)
  ) {
    grindSize = Math.round(clamp(grindSize - 4, 1, 80));
    const progressive = applyProgressiveClarityVolumes(finalVolumesForRisk, totalWater);
    progressive.forEach((value, index) => {
      if (validPours[index]) {
        validPours[index].volume = value;
      }
    });
  }

  if (
    resolved.cupGoal === "Clarity" &&
    isSafeButFlatRecipe({
      goal: resolved.cupGoal,
      ratio,
      grindSize,
      pours: finalVolumesForRisk,
      agitation: validPours.map((pour) => pour.agitation),
    })
  ) {
    grindSize = Math.round(clamp(grindSize - 2, 1, 80));
    const progressive = applyProgressiveClarityVolumes(finalVolumesForRisk, totalWater);
    progressive.forEach((value, index) => {
      if (validPours[index]) {
        validPours[index].volume = value;
      }
    });
  }

  // Final grind correction layer:
  // protect clarity recipes from high-ratio + coarse-grind combinations.
  if (resolved.cupGoal === "Clarity" && ratio >= 17 && grindSize >= 53) {
    const corrected =
      ratio >= 17.5 ? 48 : ratio >= 17.2 ? 49 : pours >= 4 ? 50 : 51;
    grindSize = Math.round(clamp(corrected, 48, 51));
  }

  const finalPass = runFinalGrindPass({
    resolved,
    ratio,
    dose,
    pours,
    grindSize,
    bloomVolume: validPours[0]?.volume ?? 0,
    bloomPause: validPours[0]?.pause ?? 0,
    temperatures: validPours.map((pour) => pour.temperature),
    agitations: validPours.map((pour) => pour.agitation),
    flowRates: validPours.map((pour) => pour.flowRate),
    totalWater,
    coldPlan: recipe.coldPlan ?? null,
  });
  grindSize = finalPass.grindSize;

  if (finalPass.coolTemperatureBy > 0) {
    validPours.forEach((pour) => {
      pour.temperature = roundToOne(
        clamp(
          pour.temperature - finalPass.coolTemperatureBy,
          roastRange.min,
          roastRange.max,
        ),
      );
    });
  }

  if (finalPass.reduceAgitationAfterBloom) {
    validPours.forEach((pour, index) => {
      if (index > 0) {
        pour.agitation = "None";
      }
    });
  }

  const fixedPours: [PourStep, PourStep, PourStep, PourStep] = [0, 1, 2, 3].map((index) => {
    const candidate = validPours[index];
    if (candidate) {
      return {
        used: true,
        volume: candidate.volume,
        temperature: candidate.temperature,
        flowRate: candidate.flowRate,
        pause: candidate.pause,
        pourStyle: candidate.pourStyle,
        agitation: candidate.agitation,
      };
    }
    return {
      used: false,
      volume: 0,
      temperature: 0,
      flowRate: 0,
      pause: 0,
      pourStyle: "Centered",
      agitation: "None",
    };
  }) as [PourStep, PourStep, PourStep, PourStep];

  let coldPlan: ColdPlan | null = null;
  if (resolved.cupMode === "Iced" && recipe.coldPlan) {
    const brewWater = totalWater;
    const priorFinal = Math.max(1, recipe.coldPlan.expectedFinalBeverage);
    const targetIceShare = clamp(recipe.coldPlan.iceGrams / priorFinal, 0.2, 0.45);
    const iceGrams = roundToOne((brewWater * targetIceShare) / (1 - targetIceShare));
    const icePlacement = recipe.coldPlan.icePlacement;
    coldPlan = {
      mode: "Iced",
      intent: recipe.coldPlan.intent,
      brewWater,
      iceGrams,
      iceMlEquivalent: roundToOne(iceGrams),
      expectedFinalBeverage: roundToOne(brewWater + iceGrams),
      icePlacement,
      icePlacementText: toIcedPlacementText(icePlacement),
      iceInstructions: buildIcedInstructions({
        intent: recipe.coldPlan.intent,
        icePlacement,
        iceGrams,
      }),
      qualityNotes: recipe.coldPlan.qualityNotes || [],
    };
  }

  return {
    ...recipe,
    dose,
    ratio,
    totalWater,
    numberOfPours: pours,
    pours: fixedPours,
    cupMode: resolved.cupMode,
    icedIntent: resolved.icedIntent,
    coldPlan,
    grindSize,
    grinderSpeed: pickRpm(resolved.cupGoal, grindSize),
  };
}

function buildRecipe(resolved: ResolvedInput): GeneratedRecipe {
  const runtimeAssumptions = [...resolved.assumptions];
  const isIced = resolved.cupMode === "Iced" && Boolean(resolved.icedIntent);
  const icedIntent = resolved.icedIntent;

  let ratio =
    isIced && icedIntent ? pickIcedIntentRatio(resolved, icedIntent) : pickHotRatio(resolved);

  let dose =
    isIced && icedIntent
      ? pickIcedDose({
          ratio,
          targetFinalCup: pickIcedFinalCupTarget(resolved.cupSize, resolved.cupGoal),
          iceShare: pickIcedIceShare({
            goal: resolved.cupGoal,
            intent: icedIntent,
            process: resolved.process,
            roastLevel: resolved.roastLevel,
          }),
          cupSize: resolved.cupSize,
          goal: resolved.cupGoal,
          countryKey: resolved.countryKey,
          sensoryIntent: resolved.sensoryIntent,
          assumptions: runtimeAssumptions,
        })
      : pickHotDose(resolved.cupSize, resolved.cupGoal);

  if (
    resolved.cupMode === "Hot" &&
    resolved.cupGoal === "Clarity" &&
    resolved.cupSize === "Large" &&
    ratio >= 17 &&
    dose < 16
  ) {
    dose = 16;
    runtimeAssumptions.push("تم رفع الجرعة إلى 16g لحماية قوة الاستخلاص في الكوب الكبير مع نسبة مرتفعة.");
  }

  dose = roundToOne(clamp(dose, 5, 18));
  let totalWater = roundToOne(dose * ratio);
  let poursCount = pickPourCount(resolved);

  let coldPlan: ColdPlan | null = null;
  if (isIced && icedIntent) {
    const iceShare = pickIcedIceShare({
      goal: resolved.cupGoal,
      intent: icedIntent,
      process: resolved.process,
      roastLevel: resolved.roastLevel,
    });
    const iceGrams = roundToOne((totalWater * iceShare) / (1 - iceShare));
    const icePlacement = pickIcedIcePlacement(icedIntent);
    coldPlan = {
      mode: "Iced",
      intent: icedIntent,
      brewWater: totalWater,
      iceGrams,
      iceMlEquivalent: roundToOne(iceGrams),
      expectedFinalBeverage: roundToOne(totalWater + iceGrams),
      icePlacement,
      icePlacementText: toIcedPlacementText(icePlacement),
      iceInstructions: buildIcedInstructions({
        intent: icedIntent,
        icePlacement,
        iceGrams,
      }),
      qualityNotes: [],
    };

    const qualityControl = applyColdQualityControl({
      resolved,
      totalWater,
      ratio,
      coldPlan,
    });
    coldPlan = qualityControl.coldPlan;
    ratio = qualityControl.ratio;
    totalWater = qualityControl.totalWater;
    if (qualityControl.notes.length > 0) {
      runtimeAssumptions.push(...qualityControl.notes);
    }

    const postDilutionShare = clamp(
      coldPlan.iceGrams / Math.max(1, coldPlan.expectedFinalBeverage),
      0,
      0.6,
    );
    if (
      isLikelyWeakIcedCup({
        dose,
        ratio,
        cupSize: resolved.cupSize,
        goal: resolved.cupGoal,
        countryKey: resolved.countryKey,
        sensoryIntent: resolved.sensoryIntent,
        iceShare: postDilutionShare,
      })
    ) {
      const icedRange = ICED_DOSE_RANGES[resolved.cupSize];
      const bump =
        resolved.cupSize === "Large" &&
        resolved.cupGoal === "Clarity" &&
        isDelicateOriginForClarity(resolved.countryKey, resolved.sensoryIntent)
          ? 2
          : 1;
      dose = roundToOne(clamp(dose + bump, icedRange.min, icedRange.max));
      totalWater = roundToOne(dose * ratio);

      const updatedIce = roundToOne((totalWater * postDilutionShare) / (1 - postDilutionShare));
      coldPlan = {
        ...coldPlan,
        brewWater: totalWater,
        iceGrams: updatedIce,
        iceMlEquivalent: roundToOne(updatedIce),
        expectedFinalBeverage: roundToOne(totalWater + updatedIce),
        iceInstructions: buildIcedInstructions({
          intent: coldPlan.intent,
          icePlacement: coldPlan.icePlacement,
          iceGrams: updatedIce,
        }),
      };

      runtimeAssumptions.push(
        `تمت زيادة الجرعة (${bump}g) لتحسين القوة الحسية والثبات العطري في التقديم البارد قبل تعديل النسبة.`,
      );
    }
  }

  let baseGrind = pickBaseGrind(resolved.roastLevel, resolved.process);
  if (resolved.cupGoal === "Clarity") {
    baseGrind -= 2;
  } else if (resolved.cupGoal === "Body") {
    baseGrind += 2;
  }

  if (resolved.process === "Natural") {
    baseGrind += 1;
  } else if (resolved.process === "Washed") {
    baseGrind -= 1;
  } else if (
    resolved.process === "Anaerobic" ||
    resolved.process === "Experimental" ||
    resolved.process === "Co-ferment"
  ) {
    baseGrind += 1;
  }

  if (typeof resolved.daysOffRoast === "number" && resolved.daysOffRoast >= 11) {
    baseGrind -= 1;
  }

  if (isIced && icedIntent) {
    if (icedIntent === "Flash-Chilled Pour Over") {
      baseGrind -= 1;
    } else if (icedIntent === "Concentrated Over Ice") {
      baseGrind += 1;
    }

    if (coldPlan && coldPlan.iceGrams >= totalWater * 0.5) {
      baseGrind -= 1;
    }
  }

  const draftFlowRates = pickFlowRates(
    resolved.cupGoal,
    poursCount,
    resolved.cupMode,
    resolved.icedIntent,
  );
  const avgFlow =
    draftFlowRates.reduce((sum, value) => sum + value, 0) / Math.max(draftFlowRates.length, 1);
  const brewTarget = getBrewTimeTarget(resolved.cupGoal);
  const grindTuned = adjustGrindByBrewTime({
    grindSize: Math.round(clamp(baseGrind, 1, 80)),
    target: brewTarget,
    dose,
    ratio,
    pours: poursCount,
    process: resolved.process,
    flowAvg: avgFlow,
  });

  let grindSize = Math.round(clamp(grindTuned.grind, 1, 80));

  if (resolved.cupGoal !== "Body" && ratio >= 16.5 && ratio <= 18) {
    const constrained = Math.round(clamp(grindSize, 45, 52));
    if (constrained !== grindSize) {
      grindSize = constrained;
      runtimeAssumptions.push("تم تقييد الطحن ضمن نطاق أوضح ليتماشى مع النسبة العالية.");
    }
  }

  if (isHighUnderExtractionRisk({ ratio, grindSize, pours: poursCount, goal: resolved.cupGoal })) {
    grindSize = Math.round(clamp(grindSize - 4, 1, 80));
    if (ratio > 16.5 && resolved.cupGoal !== "Body") {
      ratio = 16.5;
      totalWater = roundToOne(dose * ratio);
    }
    runtimeAssumptions.push("تم تفعيل موازنة الاستخلاص لتفادي under-extraction (تعديل الطحن/النسبة).");
  }

  let predictedTime = estimateDrawdownSeconds({
    dose,
    ratio,
    grindSize,
    pours: poursCount,
    process: resolved.process,
    flowAvg: avgFlow,
  });
  if (resolved.cupGoal === "Clarity" && predictedTime < 135) {
    grindSize = Math.round(clamp(grindSize - 2, 1, 80));
    if (poursCount < 4 && !isIced) {
      poursCount = 4;
    }
    predictedTime = estimateDrawdownSeconds({
      dose,
      ratio,
      grindSize,
      pours: poursCount,
      process: resolved.process,
      flowAvg: avgFlow,
    });
    if (predictedTime < 135) {
      grindSize = Math.round(clamp(grindSize - 1, 1, 80));
    }
  }

  const grinderSpeed = pickRpm(resolved.cupGoal, grindSize);

  const bloomWater = pickBloomWater({
    totalWater,
    dose,
    process: resolved.process,
    daysOffRoast: resolved.daysOffRoast,
    cupMode: resolved.cupMode,
    icedIntent: resolved.icedIntent,
  });
  const volumes = allocatePourVolumes({
    totalWater,
    bloomWater,
    pours: poursCount,
    goal: resolved.cupGoal,
    cupMode: resolved.cupMode,
    icedIntent: resolved.icedIntent,
  });
  const tunedVolumes =
    resolved.cupGoal === "Clarity"
      ? applyProgressiveClarityVolumes(volumes, totalWater)
      : normalizeVolumesToTotal(volumes, totalWater);

  const curveMode = pickCurveMode(resolved);
  const baseTemp = pickBaseTemperature(resolved, curveMode);
  const requireStrongDecline =
    resolved.cupGoal === "Clarity" &&
    (resolved.countryKey === "ethiopia" ||
      resolved.countryKey === "panama" ||
      resolved.sensoryIntent === "delicate / floral / tea-like");
  const temperatures = pickTemperatures({
    pours: poursCount,
    curve: curveMode,
    baseTemp,
    roastLevel: resolved.roastLevel,
    cupMode: resolved.cupMode,
    minTotalDrop: requireStrongDecline ? 1.5 : undefined,
  });

  const bloomPause = pickBloomPause({
    daysOffRoast: resolved.daysOffRoast,
    goal: resolved.cupGoal,
    process: resolved.process,
    bloomWater,
    dose,
  });
  const flowRates = pickFlowRates(
    resolved.cupGoal,
    poursCount,
    resolved.cupMode,
    resolved.icedIntent,
  );

  const activePours: PourStep[] = Array.from({ length: poursCount }).map((_, index) => {
    const step = index + 1;
    return {
      used: true,
      volume: roundToOne(tunedVolumes[index]),
      temperature: temperatures[index],
      flowRate: flowRates[index],
      pause: pickPause(step, poursCount, bloomPause, resolved.cupGoal),
      pourStyle: pickPourStyle(step, poursCount, resolved.cupGoal),
      agitation: pickAgitation(
        step,
        poursCount,
        resolved.cupGoal,
        resolved.process,
        resolved.cupMode,
        resolved.icedIntent,
      ),
    };
  });

  if (
    isSafeButFlatRecipe({
      goal: resolved.cupGoal,
      ratio,
      grindSize,
      pours: activePours.map((pour) => pour.volume),
      agitation: activePours.map((pour) => pour.agitation),
    })
  ) {
    grindSize = Math.round(clamp(grindSize - 2, 1, 80));
    const progressive = applyProgressiveClarityVolumes(
      activePours.map((pour) => pour.volume),
      totalWater,
    );
    progressive.forEach((volume, index) => {
      if (activePours[index]) {
        activePours[index].volume = volume;
      }
    });
    runtimeAssumptions.push("تم تصحيح وصفة آمنة لكنها مسطحة لرفع الحيوية والوضوح.");
  }

  if (isHighUnderExtractionRisk({ ratio, grindSize, pours: poursCount, goal: resolved.cupGoal })) {
    grindSize = Math.round(clamp(grindSize - 2, 1, 80));
    runtimeAssumptions.push("تم تطبيق تصحيح إضافي لضمان استخلاص أوضح قبل الإخراج.");
  }

  const assumptionSummary =
    runtimeAssumptions.length > 0
      ? `افتراضات تلقائية: ${runtimeAssumptions.slice(0, 2).join(" ")}`
      : "";

  const brewGoalText = [
    `تم تصميم الوصفة لتحقيق كوب ${resolved.cupMode === "Iced" ? "بارد" : "حار"} بهدف ${toArabicGoal(resolved.cupGoal)} على Omni Dripper مع طابع ${resolved.sensoryIntent}.`,
    isIced && coldPlan
      ? `وصفة باردة | Brew Water ${coldPlan.brewWater}ml | Ice ${coldPlan.iceGrams}g | Final ~${coldPlan.expectedFinalBeverage}ml | Ice Placement: ${coldPlan.icePlacementText}.`
      : "",
    assumptionSummary,
  ]
    .filter(Boolean)
    .join(" ");

  const countryJoined = resolved.countryProfile.slice(0, 3).join(", ");
  const daysNote =
    typeof resolved.daysOffRoast === "number"
      ? `عمر القهوة: ${resolved.daysOffRoast} يومًا من تاريخ التحميص.`
      : "تاريخ التحميص غير متوفر؛ تم تطبيق سلوك افتراضي للحداثة.";

  const candidate: CandidateRecipe = {
    name: `${resolved.coffeeName || "وصفة جديدة"} - ${toArabicGoal(resolved.cupGoal)}${isIced ? " بارد" : ""}`,
    brewGoal: brewGoalText,
    method: resolved.method,
    cupMode: resolved.cupMode,
    icedIntent: resolved.icedIntent,
    dose,
    ratio,
    totalWater,
    grindSize,
    grinderSpeed,
    numberOfPours: poursCount,
    pours: activePours,
    coldPlan,
    expectedCupProfile: {
      aroma: countryJoined || "clean aromatic profile",
      acidity:
        resolved.cupGoal === "Clarity"
          ? "Bright and transparent"
          : resolved.cupGoal === "Body"
            ? "Low to medium"
            : "Medium and integrated",
      sweetness:
        resolved.cupGoal === "Sweetness" || resolved.cupGoal === "Body"
          ? "Medium-high"
          : "Medium",
      body:
        resolved.cupGoal === "Body"
          ? "Dense and syrupy"
          : resolved.cupGoal === "Clarity"
            ? "Tea-like"
            : "Medium and round",
      finish:
        resolved.cupGoal === "Clarity"
          ? "Clean and crisp"
          : resolved.cupGoal === "Body"
            ? "Long and coating"
            : "Balanced and sweet",
    },
    adjustmentGuide: {
      ifSour: isIced
        ? "If too sharp when cold: grind slightly finer or reduce ice slightly."
        : "If sour / thin / sharp: grind finer 1-3 steps.",
      ifBitter: isIced
        ? "If too diluted: reduce ice or tighten ratio."
        : "If bitter / dry / heavy: grind coarser 1-3 steps.",
      ifWeak: isIced
        ? "If too heavy: increase ice slightly or raise ratio."
        : "If flat but not bitter: grind slightly finer or raise early temperature slightly.",
      ifMuddy: isIced
        ? "If aromatics feel muted: use flash-chilled structure and lower agitation."
        : "If watery: tighten grind before changing pours.",
    },
    proTip: isIced && coldPlan
      ? resolved.cupGoal === "Clarity" || resolved.sensoryIntent === "delicate / floral / tea-like"
        ? `${daysNote} Chill the server or cup first. Use clear dense ice when possible. Swirl lightly after brewing and avoid over-agitation.`
        : `${daysNote} ${coldPlan.iceInstructions.join(" ")}`
      : `${daysNote} Purge 3g before grinding for better repeatability.`,
    assumptions: runtimeAssumptions,
  };

  return validateAndFinalizeRecipe(candidate, resolved);
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-[0.04em] text-[var(--page-muted)]">
      {children}
    </p>
  );
}

function toCountryOptionValue(countryKey: string) {
  return countryKey
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toArabicRegion(region: Region) {
  if (region === "Africa") return "أفريقيا";
  if (region === "Latin America") return "أمريكا اللاتينية";
  return "آسيا والمحيط الهادئ";
}

function toArabicCountryName(countryValue: string) {
  const key = formatCountryKey(countryValue);
  return COUNTRY_AR_LABELS[key] || countryValue || "غير محدد";
}

function toArabicProcess(process: ProcessType) {
  if (process === "Washed") return "مغسولة";
  if (process === "Natural") return "طبيعية";
  if (process === "Honey") return "هوني";
  if (process === "Anaerobic") return "لاهوائية";
  if (process === "Experimental") return "تجريبية";
  return "كوفيرمنت";
}

function toArabicRoast(roast: RoastLevel) {
  if (roast === "Light") return "فاتح";
  if (roast === "Light-Medium") return "فاتح-متوسط";
  if (roast === "Medium") return "متوسط";
  return "متوسط-داكن";
}

function toArabicGoal(goal: CupGoal) {
  if (goal === "Clarity") return "وضوح";
  if (goal === "Balance") return "توازن";
  if (goal === "Sweetness") return "حلاوة";
  return "قوام";
}

function toArabicSize(size: CupSize) {
  if (size === "Small") return "صغير";
  if (size === "Medium") return "متوسط";
  return "كبير";
}

function toArabicCupMode(mode: CupMode) {
  return mode === "Iced" ? "بارد" : "حار";
}

function toArabicPourStyle(style: PourStyle) {
  if (style === "Centered") return "مركزي";
  if (style === "Spiral") return "حلزوني";
  return "دائري";
}

function toArabicAgitation(agitation: Agitation) {
  if (agitation === "On before") return "قبل الصب";
  if (agitation === "On after") return "بعد الصب";
  if (agitation === "Both") return "قبل وبعد";
  return "بدون";
}

type CreateLinkSuccess = {
  ok: boolean;
  url: string;
};

type CreateLinkFailure = {
  message?: string;
};

type PublishRecipeSuccess = {
  ok: boolean;
  slug: string;
  recipeUrl: string;
};

type PublishRecipeFailure = {
  message?: string;
};

async function readJsonSafely<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildRecipePublishPayload(recipe: GeneratedRecipe, xbloomUrl: string) {
  const usedPours = recipe.pours.filter((pour) => pour.used);
  const totalSeconds = usedPours.reduce((sum, pour) => sum + pour.pause, 0);

  return {
    name: recipe.name,
    authorName: "كــاف",
    brewer: recipe.method,
    grams: recipe.dose,
    iceGrams: recipe.cupMode === "Iced" ? Math.round(recipe.coldPlan?.iceGrams ?? 0) : null,
    pourCount: recipe.numberOfPours,
    firstPourTemperature: usedPours[0]?.temperature ?? null,
    pourSteps: usedPours.map((pour, index) => ({
      name: index === 0 ? "Bloom" : `Pour ${index + 1}`,
      volumeMl: Math.round(pour.volume),
      temperatureC: pour.temperature,
      seconds: pour.pause,
    })),
    ratioInput: `1:${recipe.ratio} ${Math.round(recipe.totalWater)}ml`,
    roasterSlug: CAF_GENERATED_ROASTER_SLUG,
    roasterName: CAF_GENERATED_ROASTER_NAME,
    brewType: recipe.cupMode === "Iced" ? "cold" : "hot",
    xbloomUrl,
    totalSeconds,
  };
}

function applyTransportNormalization(recipe: GeneratedRecipe): GeneratedRecipe {
  const normalized = normalizeRecipeForXbloomTransport(recipe);
  if (!normalized) {
    return recipe;
  }

  const pours = [0, 1, 2, 3].map((index) => {
    const base = recipe.pours[index] || {
      used: false,
      volume: 0,
      temperature: 0,
      flowRate: 0,
      pause: 0,
      pourStyle: "Centered" as PourStyle,
      agitation: "None" as Agitation,
    };
    const incoming = normalized.pours[index];
    if (!incoming) {
      return {
        ...base,
        used: false,
        volume: 0,
      };
    }


// h
    return {
      ...base,
      used: true,
      volume: incoming.volume,
      pause: incoming.pause,
      temperature: incoming.temperature,
      flowRate: incoming.flowRate,
    };
  }) as [PourStep, PourStep, PourStep, PourStep];

  const coldPlan = recipe.coldPlan
    ? {
        ...recipe.coldPlan,
        brewWater: normalized.totalWater,
        expectedFinalBeverage: roundToOne(normalized.totalWater + recipe.coldPlan.iceGrams),
      }
    : null;

  return {
    ...recipe,
    dose: normalized.dose,
    ratio: normalized.ratio,
    totalWater: normalized.totalWater,
    numberOfPours: normalized.pours.length,
    pours,
    coldPlan,
  };
}

export function XbloomRecipeEngine() {
  const [input, setInput] = useState<RecipeInput>(DEFAULT_INPUT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recipeLink, setRecipeLink] = useState("");
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    dose: number;
    ice: number;
    recipeUrl: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const countriesByRegion = useMemo(() => {
    const grouped: Record<Region, Array<{ value: string; label: string }>> = {
      Africa: [],
      "Latin America": [],
      "Asia-Pacific": [],
    };

    for (const [countryKey, meta] of Object.entries(ORIGIN_COUNTRY_MAP)) {
      grouped[meta.region].push({
        value: toCountryOptionValue(countryKey),
        label: COUNTRY_AR_LABELS[countryKey] || toCountryOptionValue(countryKey),
      });
    }

    (Object.keys(grouped) as Region[]).forEach((region) => {
      grouped[region].sort((a, b) => a.label.localeCompare(b.label, "ar"));
    });

    return grouped;
  }, []);

  const preview = useMemo(() => {
    const resolved = resolveInput(input);
    const recipe = applyTransportNormalization(buildRecipe(resolved));
    let cumulativeVolume = 0;
    const pours = recipe.pours
      .filter((pour) => pour.used)
      .map((pour, index) => {
        cumulativeVolume = roundToOne(cumulativeVolume + pour.volume);
        return {
          index: index + 1,
          cumulativeVolume,
          ...pour,
        };
      });

    return { resolved, recipe, pours };
  }, [input]);

  const maxPourVolume = useMemo(
    () => Math.max(...preview.pours.map((pour) => pour.volume), 1),
    [preview.pours],
  );

  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 pb-20 sm:px-8 lg:grid-cols-[1fr_1fr]">
      <article className="theme-surface rounded-[24px] p-5 sm:p-6">
        <h2 className="text-3xl font-bold text-[var(--page-fg)]">انشاء وصفة</h2>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <InputLabel>اسم الوصفة</InputLabel>
            <input
              value={input.coffeeName}
              onChange={(event) => setInput((c) => ({ ...c, coffeeName: event.target.value }))}
              placeholder="مثال: قوجي كاف"
              className="theme-input h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
            />
          </div>

          <div className="grid gap-2">
            <InputLabel>اسم المحمصة</InputLabel>
            <input
              value={input.roaster}
              onChange={(event) => setInput((c) => ({ ...c, roaster: event.target.value }))}
              placeholder="مثال: محمصة كاف"
              className="theme-input h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
            />
          </div>

          <div className="grid gap-2">
            <InputLabel>بلد المنشأ</InputLabel>
            <select
              value={input.originCountry}
              onChange={(event) => setInput((c) => ({ ...c, originCountry: event.target.value }))}
              className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
            >
              <option value="">اختيار تلقائي حسب المدخلات</option>
              {(Object.keys(countriesByRegion) as Region[]).map((region) => (
                <optgroup key={region} label={toArabicRegion(region)}>
                  {countriesByRegion[region].map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <InputLabel>المعالجة</InputLabel>
              <select
                value={input.process}
                onChange={(event) =>
                  setInput((c) => ({ ...c, process: event.target.value as ProcessType | "" }))
                }
                className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              >
                <option value="">تلقائي</option>
                <option value="Washed">مغسولة (Washed)</option>
                <option value="Natural">طبيعية (Natural)</option>
                <option value="Honey">عسلية (Honey)</option>
                <option value="Anaerobic">لاهوائية (Anaerobic)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <InputLabel>درجة التحميص</InputLabel>
              <select
                value={input.roastLevel}
                onChange={(event) =>
                  setInput((c) => ({ ...c, roastLevel: event.target.value as RoastLevel | "" }))
                }
                className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              >
                <option value="">تلقائي</option>
                <option value="Light">فاتح (Light)</option>
                <option value="Light-Medium">فاتح-متوسط (Light-Medium)</option>
                <option value="Medium">متوسط (Medium)</option>
                <option value="Medium-Dark">متوسط-داكن (Medium-Dark)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <InputLabel>تاريخ التحميص</InputLabel>
              <input
                type="date"
                value={input.roastDate}
                onChange={(event) => setInput((c) => ({ ...c, roastDate: event.target.value }))}
                className="theme-input h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              />
            </div>

            <div className="grid gap-2">
              <InputLabel> الكوب</InputLabel>
              <select
                value={input.cupGoal}
                onChange={(event) =>
                  setInput((c) => ({ ...c, cupGoal: event.target.value as CupGoal | "" }))
                }
                className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              >
                <option value="">تلقائي</option>
                <option value="Clarity">كوب واضح</option>
                <option value="Balance">كوب متوازن</option>
                <option value="Sweetness">كوب حلو</option>
                <option value="Body">كوب بقوام أعلى</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <InputLabel>حجم الكوب</InputLabel>
              <select
                value={input.cupSize}
                onChange={(event) =>
                  setInput((c) => ({ ...c, cupSize: event.target.value as CupSize | "" }))
                }
                className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              >
                <option value="">تلقائي</option>
                <option value="Small">صغير (Small)</option>
                <option value="Medium">متوسط (Medium)</option>
                <option value="Large">كبير (Large)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <InputLabel>نوع الكوب</InputLabel>
              <select
                value={input.cupMode}
                onChange={(event) =>
                  setInput((c) => ({ ...c, cupMode: event.target.value as CupMode | "" }))
                }
                className="theme-input ui-select h-11 rounded-[12px] px-3 text-sm font-bold outline-none"
              >
                <option value="">تلقائي (Hot / Iced)</option>
                <option value="Hot">حار (Hot)</option>
                <option value="Iced">بارد (Iced)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const recipePayload = preview.recipe;
              setIsGenerating(true);
              setErrorMessage("");
              setStatusMessage("جاري إنشاء الوصفة داخل xBloom...");
              setRecipeLink("");
              setIsResultModalOpen(false);
              setResultSummary(null);

              try {
                const response = await fetch("/api/xbloom/create-link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    recipe: recipePayload,
                    source: {
                      generatedAt: new Date().toISOString(),
                      input,
                      assumptions: preview.resolved.assumptions,
                    },
                  }),
                });

                if (!response.ok) {
                  const errorBody = await readJsonSafely<CreateLinkFailure>(response);
                  throw new Error(
                    errorBody?.message || "تعذر إنشاء رابط xBloom في الوقت الحالي.",
                  );
                }

                const body = await readJsonSafely<CreateLinkSuccess>(response);
                if (!body?.url) {
                  throw new Error("لم يتم استلام رابط صالح من خدمة xBloom.");
                }

                setStatusMessage("تم إنشاء رابط xBloom، جاري حفظ الوصفة في كـاف...");
                const publishResponse = await fetch("/api/recipe-submissions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(buildRecipePublishPayload(recipePayload, body.url)),
                });

                if (!publishResponse.ok) {
                  const errorBody = await readJsonSafely<PublishRecipeFailure>(publishResponse);
                  throw new Error(
                    errorBody?.message || "تم إنشاء رابط xBloom لكن تعذر حفظ الوصفة في كـاف.",
                  );
                }

                const published = await readJsonSafely<PublishRecipeSuccess>(publishResponse);
                if (!published?.recipeUrl) {
                  throw new Error("تم حفظ الوصفة لكن لم يصل رابط صفحة الوصفة.");
                }

                setRecipeLink(body.url);
                setResultSummary({
                  dose: recipePayload.dose,
                  ice: Math.round(recipePayload.coldPlan?.iceGrams ?? 0),
                  recipeUrl: published.recipeUrl,
                });
                setIsResultModalOpen(true);
                setStatusMessage("تم إنشاء الرابط وحفظ الوصفة تحت محمصة بواسطة كـاف.");
              } catch (error) {
                setStatusMessage("");
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "حدث خطأ أثناء إنشاء رابط الوصفة.",
                );
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating}
            className="mt-1 w-full rounded-[16px] bg-[var(--page-card-button-bg)] px-5 py-3 text-sm font-bold text-[var(--page-card-button-text)] transition hover:opacity-90"
          >
            {isGenerating ? "جاري الإنشاء..." : "إنشاء رابط xBloom"}
          </button>

          <p className="mt-2 text-xs font-bold leading-6 text-[var(--page-muted)]">
            ملاحظة: الوصفات في هذا النظام مبنية على فرضيات ومعايير (
            <a
              href="https://chatgpt.com/g/g-67f14ec8ba988191ac76eedb7bed7849-xbloom-brew-master"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--page-fg)] underline"
            >
              Chatgpt - xBloom Brew Master
            </a>
            )، وقد تحتاج إلى تعديل بسيط حسب نوع البن وذوقك.
          </p>

          {statusMessage ? (
            <p className="text-xs font-bold text-[var(--page-muted)]">{statusMessage}</p>
          ) : null}

          {errorMessage ? (
            <p className="text-xs font-bold text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      </article>

      <article className="theme-surface rounded-[24px] p-5 sm:p-6">
        <p className="text-xs font-bold tracking-[0.1em] text-[var(--page-muted)]">
          معاينة وصفة xBloom
        </p>
        <section className="mt-4 overflow-hidden rounded-[14px] border border-[#2a2f37] bg-[#07090d] text-[#dfe6ee]">
          <div className="relative overflow-hidden bg-[#c8d3b2] px-4 py-4 text-[#1f2a1f]">
            <p className="text-xs font-bold opacity-90">Omni</p>
            <p className="mt-2 text-sm font-bold">
              {toArabicCountryName(preview.resolved.originCountry)} - {toArabicGoal(preview.resolved.cupGoal)} - {toArabicCupMode(preview.resolved.cupMode)}
            </p>
            <p className="mt-1 text-xs font-bold opacity-80">
              {toArabicProcess(preview.resolved.process)} - {toArabicRoast(preview.resolved.roastLevel)} - {toArabicSize(preview.resolved.cupSize)}
            </p>
            <div className="mt-2 flex items-end gap-3 text-[#263329]">
              <p className="text-4xl leading-none font-black">1:{preview.recipe.ratio}</p>
              <p className="text-4xl leading-none font-black">{Math.round(preview.recipe.totalWater)}ml</p>
            </div>
            <p className="mt-2 text-xs font-bold opacity-80">
              {preview.resolved.coffeeName} - {preview.resolved.roaster}
            </p>

            <div className="absolute left-3 top-2 text-left text-[#8d9878]/45">
              <p className="text-[10px] font-black tracking-[0.22em]">POURS</p>
              <p className="text-6xl leading-none font-black">{preview.recipe.numberOfPours}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0 border-y border-[#2a2f37] bg-[#1a1f27] px-4 py-3 text-[#d9e1ea]">
            <div className="border-l border-[#2a2f37] pl-3">
              <p className="text-[11px] font-bold text-[#93a0ad]">كمية القهوة</p>
              <p className="mt-1 text-3xl font-black">{preview.recipe.dose}g</p>
            </div>
            <div className="pr-3 text-right">
              <p className="text-[11px] font-bold text-[#93a0ad]">كمية الثلج</p>
              <p className="mt-1 text-3xl font-black">
                {Math.round(preview.recipe.coldPlan?.iceGrams ?? 0)}g
              </p>
            </div>
          </div>

          <div className="bg-[#05070b] px-4 py-4">
            <p className="text-3xl font-black text-white">الصبات</p>
            <div
              className="mt-4 grid overflow-hidden rounded-[10px] border border-[#252b35]"
              style={{ gridTemplateColumns: `repeat(${Math.max(preview.pours.length, 1)}, minmax(0, 1fr))` }}
            >
              {preview.pours.map((pour, idx) => {
                const intensity = clamp(pour.volume / maxPourVolume, 0.28, 1);
                return (
                  <div
                    key={pour.index}
                    className={`min-h-[200px] bg-[#05070b] px-2 py-3 ${idx < preview.pours.length - 1 ? "border-l border-[#252b35]" : ""}`}
                  >
                    <p className="text-center text-xl font-black text-white">{Math.round(pour.volume)}ml</p>
                    <div
                      className="mt-3 h-12 rounded-[2px] bg-[#3a404a]"
                      style={{ opacity: intensity }}
                    />
                    <div className="mt-4 text-center text-xs font-bold text-[#a8b2bf]">
                      <p>◌ {pour.temperature}°</p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {pour.index === 1 ? "Bloom" : `Pour ${pour.index}`}
                      </p>
                      <p className="mt-2">{pour.pause > 0 ? `${pour.pause}s` : "--"}</p>
                      <p className="mt-2 text-[10px] text-[#8190a0]">
                        {toArabicPourStyle(pour.pourStyle)} - {toArabicAgitation(pour.agitation)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </article>
      </section>

      {isResultModalOpen && recipeLink && resultSummary ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-[18px] border border-[var(--page-line)] bg-[var(--page-surface)] p-5 shadow-2xl">
            <p className="text-lg font-black text-[var(--page-fg)]">تم إنشاء رابط الوصفة</p>
            <div className="mt-4 grid gap-2 rounded-[12px] border border-[var(--page-line)] bg-[var(--page-surface-soft)] p-3 text-sm font-bold text-[var(--page-fg)]">
              <p>الرابط:</p>
              <a
                href={recipeLink}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[var(--page-card-button-bg)] underline"
              >
                {recipeLink}
              </a>
              <p>كمية القهوة: {resultSummary.dose}g</p>
              <p>كمية الثلج: {resultSummary.ice}g</p>
              <a
                href={resultSummary.recipeUrl}
                className="text-[var(--page-card-button-bg)] underline"
              >
                عرض الوصفة في كـاف
              </a>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsResultModalOpen(false)}
                className="rounded-[10px] bg-[var(--page-card-button-bg)] px-4 py-2 text-sm font-bold text-[var(--page-card-button-text)] transition hover:opacity-90"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
