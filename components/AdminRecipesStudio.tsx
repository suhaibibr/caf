"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { announceRecipeAdded } from "@/lib/site-notifications";
import type { Roaster } from "@/lib/data";
import type { ManagedPourStep, ManagedRecipe } from "@/lib/recipes-db";

type AdminRecipesStudioProps = {
  initialRecipes: ManagedRecipe[];
  roasters: Roaster[];
  initialOpenCreate?: boolean;
};

type AdminBrewType = "" | "hot" | "cold";
type Step = 1 | 2 | 3;
type StatusTone = "neutral" | "success" | "error";

type XbloomPayload = {
  message?: string;
  name?: string;
  authorName?: string;
  grams?: number | null;
  waterMl?: number | null;
  ratio?: string;
  pourCount?: number | null;
  firstPourTemperature?: number | null;
  pourSteps?: ManagedPourStep[];
  brewer?: string;
};

type BatchRecipeDraft = {
  key: string;
  url: string;
  name: string;
  authorName: string;
  roasterSlug: string;
  brewer: string;
  grams: string;
  ratioInput: string;
  pourCount: string;
  firstPourTemperature: string;
  pourSteps: ManagedPourStep[];
  brewType: AdminBrewType;
  iceGrams: string;
};

type BatchDuplicateEntry = {
  key: string;
  sampleUrl: string;
  count: number;
  reason: "input-duplicate" | "already-exists";
};

const ADMIN_RECIPES_PER_PAGE = 24;
const MISC_RECIPES_LABEL = "وصفات متنوعة";

const brewerOptions = ["Omni", "Other", "xBloom", "V60", "Chemex", "Espresso"];

const HEAT_DESCRIPTOR_WORDS = new Set([
  "hot",
  "cold",
  "iced",
  "warm",
  "or",
  "barid",
  "har",
  "harr",
  "بارد",
  "باردة",
  "حار",
  "حارة",
  "ساخن",
  "ساخنة",
  "ثلج",
  "مثلج",
  "مثلجة",
  "او",
  "أو",
]);

const RECIPE_WORD_TRANSLATIONS: Record<string, string> = {
  recipe: "وصفة",
  coffee: "قهوة",
  espresso: "إسبريسو",
  classic: "كلاسيك",
  balanced: "متوازنة",
  sweet: "حلوة",
  medium: "متوسطة",
  light: "خفيفة",
  dark: "داكنة",
  bloom: "بلومنق",
  pour: "صبة",
  pours: "صبات",
  filter: "فلتر",
  drip: "تقطير",
  blend: "بلند",
  roast: "تحميص",
  roasted: "محمص",
  house: "هاوس",
  signature: "سيجنتشر",
  fruity: "فواكه",
  floral: "زهرية",
  nutty: "مكسرات",
  caramel: "كراميل",
  milk: "حليب",
  latte: "لاتيه",
  cappuccino: "كابتشينو",
  mocha: "موكا",
  americano: "أمريكانو",
  guji: "قوجي",
  and: "و",
  with: "مع",
  v60: "V60",
  xbloom: "xBloom",
  omni: "Omni",
  other: "Other",
};

const LATIN_TO_ARABIC_MAP: Record<string, string> = {
  a: "ا",
  b: "ب",
  c: "ك",
  d: "د",
  e: "",
  f: "ف",
  g: "ج",
  h: "",
  i: "ي",
  j: "ج",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  o: "و",
  p: "ب",
  q: "ق",
  r: "ر",
  s: "س",
  t: "ت",
  u: "و",
  v: "ف",
  w: "و",
  x: "كس",
  y: "ي",
  z: "ز",
};

async function readJsonSafely<T>(response: Response) {
  const text = await response.text();
  if (!text) {
    return null as T | null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseXbloomInput(value: string) {
  const raw = value.trim();
  if (!raw) {
    return { url: "", customName: "" };
  }

  const urlMatch = raw.match(/https?:\/\/\S+/i);
  if (!urlMatch) {
    return { url: raw, customName: "" };
  }

  const url = urlMatch[0].trim();
  const suffix = raw.slice((urlMatch.index ?? 0) + url.length).trim();
  const customName = suffix.replace(/^[-–—:|]+\s*/, "").trim();

  return {
    url,
    customName,
  };
}

function normalizeXbloomUrl(value: string) {
  const raw = parseXbloomInput(value).url.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    const id = parsed.searchParams.get("id");

    if (id) {
      try {
        return `id:${decodeURIComponent(id).trim()}`;
      } catch {
        return `id:${id.trim()}`;
      }
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    const query = parsed.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function stripRecipeHeatDescriptors(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const normalizedParts = token
        .toLowerCase()
        .split(/[\/_|-]+/g)
        .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter(Boolean);
      if (normalizedParts.length === 0) {
        return false;
      }
      return normalizedParts.every((part) => !HEAT_DESCRIPTOR_WORDS.has(part));
    })
    .join(" ")
    .replace(/\s+([.,،:;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function transliterateEnglishWord(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) {
    return "";
  }

  const digraphs: Array<[string, string]> = [
    ["ch", "ش"],
    ["sh", "ش"],
    ["th", "ث"],
    ["kh", "خ"],
    ["gh", "غ"],
    ["ph", "ف"],
    ["oo", "و"],
    ["ou", "و"],
    ["ee", "ي"],
  ];

  let result = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const pair = normalized.slice(index, index + 2);
    const matchedDigraph = digraphs.find(([token]) => token === pair);
    if (matchedDigraph) {
      result += matchedDigraph[1];
      index += 1;
      continue;
    }

    const char = normalized[index];
    if (/[0-9]/.test(char)) {
      result += char;
      continue;
    }

    result += LATIN_TO_ARABIC_MAP[char] ?? "";
  }

  if (normalized.endsWith("e") && !result.endsWith("ي")) {
    result += "ي";
  }

  return result || value;
}

function translateRecipeNameToArabic(value: string) {
  const cleaned = stripRecipeHeatDescriptors(value);
  if (!cleaned) {
    return "";
  }
  const hasEnglish = /[A-Za-z]/.test(cleaned);
  if (!hasEnglish) {
    return cleaned;
  }

  const arabicName = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}&+._-]+)([^\p{L}\p{N}]*)$/u);
      if (!match) {
        return token;
      }

      const [, prefix, core, suffix] = match;
      const normalized = core.toLowerCase().replace(/[_-]+/g, "");
      const direct =
        RECIPE_WORD_TRANSLATIONS[normalized] ??
        RECIPE_WORD_TRANSLATIONS[core.toLowerCase()];

      if (direct) {
        return `${prefix}${direct}${suffix}`;
      }

      if (/[A-Za-z]/.test(core)) {
        const transliterated = transliterateEnglishWord(core);
        return `${prefix}${transliterated || core}${suffix}`;
      }

      return token;
    })
    .join(" ")
    .replace(/\s+([.,،:;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return `${arabicName}- ${cleaned}`;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M10.5 13.5 13.5 10.5M8.4 15.6 6.6 17.4a3 3 0 0 1-4.2-4.2l3.1-3.1a3 3 0 0 1 4.2 0M15.6 8.4l1.8-1.8a3 3 0 0 1 4.2 4.2l-3.1 3.1a3 3 0 0 1-4.2 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BeanIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M14.8 4.8c3.5 1.9 4.9 6.4 3.1 10s-6.2 5.1-9.7 3.2-4.9-6.4-3.1-10 6.2-5.1 9.7-3.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M10.4 5.7c2.4 2.2-.2 4.7 1.6 8.1.8 1.4 1.9 2.3 2 4.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function WaterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 4.4c3.2 3.5 5 6.1 5 8.7a5 5 0 1 1-10 0c0-2.6 1.8-5.2 5-8.7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9.4 14.4c.7 1 2 1.5 3.2 1.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 3v18M5.6 6.6 18.4 17.4M18.4 6.6 5.6 17.4M4 12h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M13.5 3.8c.4 2-1 3.3-1 5.2 0 1.5 1.2 2.4 2.2 3.5 1 1 1.8 2.1 1.8 3.8A4.5 4.5 0 1 1 7.5 16c0-2.2 1.2-3.8 2.8-5.5 1.4-1.5 2.5-2.8 3.2-6.7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12.2 12.2c.3 1.1-.6 1.8-.6 2.8 0 .8.6 1.2 1.1 1.8.5.5.8 1 .8 1.8a2.3 2.3 0 1 1-4.6 0c0-1 .6-1.8 1.4-2.6.7-.8 1.3-1.4 1.9-3.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 3.6 13.8 9l5.4 1.8-5.4 1.8-1.8 5.4-1.8-5.4L4.8 10.8 10.2 9 12 3.6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-white/52"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function AdminRecipesStudio({
  initialRecipes,
  roasters,
  initialOpenCreate = false,
}: AdminRecipesStudioProps) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [selectedRecipeSlugs, setSelectedRecipeSlugs] = useState<string[]>([]);
  const [previewRecipe, setPreviewRecipe] = useState<ManagedRecipe | null>(null);
  const [recipePendingDelete, setRecipePendingDelete] = useState<ManagedRecipe | null>(null);
  const [recipeNameEditTarget, setRecipeNameEditTarget] = useState<ManagedRecipe | null>(null);
  const [recipeNameEditValue, setRecipeNameEditValue] = useState("");
  const [isRecipeNameSaving, setIsRecipeNameSaving] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBatchDuplicateDialogOpen, setIsBatchDuplicateDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingXbloom, setIsFetchingXbloom] = useState(false);
  const [isFetchingBatch, setIsFetchingBatch] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [batchStatusMessage, setBatchStatusMessage] = useState("");
  const [batchStatusTone, setBatchStatusTone] = useState<StatusTone>("neutral");
  const [xbloomUrl, setXbloomUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [batchDuplicateEntries, setBatchDuplicateEntries] = useState<BatchDuplicateEntry[]>([]);
  const [batchUniqueUrlsAfterDedup, setBatchUniqueUrlsAfterDedup] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [grams, setGrams] = useState("15");
  const [iceGrams, setIceGrams] = useState("");
  const [isRoasterApproved, setIsRoasterApproved] = useState(false);
  const [pourCount, setPourCount] = useState("");
  const [firstPourTemperature, setFirstPourTemperature] = useState("");
  const [pourSteps, setPourSteps] = useState<ManagedPourStep[]>([]);
  const [brewer, setBrewer] = useState("Omni");
  const [ratioInput, setRatioInput] = useState("225ML - 1:16");
  const [roasterName, setRoasterName] = useState("");
  const [brewType, setBrewType] = useState<AdminBrewType>("");
  const [batchRoasterName, setBatchRoasterName] = useState("");
  const [batchApproved, setBatchApproved] = useState(false);
  const [batchRecipes, setBatchRecipes] = useState<BatchRecipeDraft[]>([]);
  const [bulkEditRoasterMode, setBulkEditRoasterMode] = useState<"keep" | "set" | "clear">("keep");
  const [bulkEditRoasterSlug, setBulkEditRoasterSlug] = useState("");
  const [bulkEditBrewType, setBulkEditBrewType] = useState<"keep" | "hot" | "cold">("keep");
  const [bulkEditIceGrams, setBulkEditIceGrams] = useState("");
  const [bulkEditApproval, setBulkEditApproval] = useState<"keep" | "approved" | "not-approved">("keep");
  const [recipesFilterMode, setRecipesFilterMode] = useState<"all" | "approved" | "unassigned">("all");
  const [recipesRoasterFilter, setRecipesRoasterFilter] = useState("all");
  const [recipesPage, setRecipesPage] = useState(1);
  const [hasAppliedInitialOpenCreate, setHasAppliedInitialOpenCreate] = useState(false);

  const matchedRoaster = useMemo(
    () =>
      roasters.find(
        (roaster) =>
          roaster.name === roasterName.trim() ||
          roaster.shortName === roasterName.trim() ||
          roaster.slug === createSlug(roasterName),
      ) ?? null,
    [roasters, roasterName],
  );

  const matchedBatchRoaster = useMemo(
    () =>
      roasters.find(
        (roaster) =>
          roaster.name === batchRoasterName.trim() ||
          roaster.shortName === batchRoasterName.trim() ||
          roaster.slug === createSlug(batchRoasterName),
      ) ?? null,
    [batchRoasterName, roasters],
  );

  const selectedSlugSet = useMemo(() => new Set(selectedRecipeSlugs), [selectedRecipeSlugs]);
  const recipesRoasterOptions = useMemo(() => {
    const optionsMap = new Map<string, string>();

    recipes.forEach((recipe) => {
      if (recipe.roasterSlug) {
        optionsMap.set(`slug:${recipe.roasterSlug}`, recipe.roasterName || recipe.roasterSlug);
        return;
      }

      const nameLabel = recipe.roasterName?.trim() || MISC_RECIPES_LABEL;
      optionsMap.set(`name:${nameLabel}`, nameLabel);
    });

    return [...optionsMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ar"));
  }, [recipes]);
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      if (recipesFilterMode === "approved" && !recipe.isRoasterApproved) {
        return false;
      }

      if (recipesFilterMode === "unassigned" && recipe.roasterSlug) {
        return false;
      }

      if (recipesRoasterFilter === "all") {
        return true;
      }

      if (recipesRoasterFilter.startsWith("slug:")) {
        return recipe.roasterSlug === recipesRoasterFilter.slice(5);
      }

      if (recipesRoasterFilter.startsWith("name:")) {
        const expectedName = recipesRoasterFilter.slice(5);
        const recipeRoasterName =
          recipe.roasterName?.trim() ||
          (recipe.roasterSlug ? "" : MISC_RECIPES_LABEL);
        return recipeRoasterName === expectedName;
      }

      return true;
    });
  }, [recipes, recipesFilterMode, recipesRoasterFilter]);
  const totalRecipesPages = Math.max(
    1,
    Math.ceil(filteredRecipes.length / ADMIN_RECIPES_PER_PAGE),
  );
  const paginatedRecipes = useMemo(() => {
    const start = (recipesPage - 1) * ADMIN_RECIPES_PER_PAGE;
    return filteredRecipes.slice(start, start + ADMIN_RECIPES_PER_PAGE);
  }, [filteredRecipes, recipesPage]);
  const selectedRecipes = useMemo(
    () => recipes.filter((recipe) => selectedSlugSet.has(recipe.slug)),
    [recipes, selectedSlugSet],
  );
  const allVisibleSelected =
    paginatedRecipes.length > 0 &&
    paginatedRecipes.every((recipe) => selectedSlugSet.has(recipe.slug));

  useEffect(() => {
    setSelectedRecipeSlugs((current) =>
      current.filter((slug) => recipes.some((recipe) => recipe.slug === slug)),
    );
  }, [recipes]);

  useEffect(() => {
    if (!initialOpenCreate || hasAppliedInitialOpenCreate) {
      return;
    }

    setHasAppliedInitialOpenCreate(true);
    setIsOpen(true);
  }, [hasAppliedInitialOpenCreate, initialOpenCreate]);

  useEffect(() => {
    setRecipesPage(1);
  }, [recipesFilterMode, recipesRoasterFilter]);

  useEffect(() => {
    setRecipesPage((current) => Math.min(current, totalRecipesPages));
  }, [totalRecipesPages]);

  useEffect(() => {
    if (recipesRoasterFilter === "all") {
      return;
    }

    if (!recipesRoasterOptions.some((option) => option.value === recipesRoasterFilter)) {
      setRecipesRoasterFilter("all");
    }
  }, [recipesRoasterFilter, recipesRoasterOptions]);

  const canContinueStepTwo =
    name.trim() &&
    authorName.trim() &&
    brewer.trim() &&
    Number.isFinite(Number(grams)) &&
    Number(grams) > 0 &&
    ratioInput.trim();

  const requiresIce = brewType === "cold";
  const canSave =
    !!canContinueStepTwo &&
    !!xbloomUrl.trim() &&
    !!brewType &&
    (!requiresIce || (Number.isFinite(Number(iceGrams)) && Number(iceGrams) > 0));

  const canSaveBatch =
    batchRecipes.length > 0 &&
    batchRecipes.every((recipe) => {
      const hasBaseData =
        recipe.name.trim() &&
        recipe.authorName.trim() &&
        recipe.brewer.trim() &&
        Number.isFinite(Number(recipe.grams)) &&
        Number(recipe.grams) > 0 &&
        recipe.ratioInput.trim() &&
        recipe.url.trim() &&
        recipe.brewType;

      if (!hasBaseData) {
        return false;
      }

      if (recipe.brewType === "cold") {
        return Number.isFinite(Number(recipe.iceGrams)) && Number(recipe.iceGrams) > 0;
      }

      return true;
    });

  const recipeStatText = (recipe: ManagedRecipe) => {
    const coldPart =
      recipe.brewType === "cold" && recipe.iceGrams
        ? ` · ${recipe.iceGrams} جرام ثلج`
        : "";
    const waterPart = recipe.waterMl ? `${recipe.waterMl} مل` : recipe.ratio;
    return `${recipe.grams} جرام${coldPart} · ${waterPart}`;
  };

  const statusClassName =
    statusTone === "error"
      ? "text-[#FFB4B4]"
      : statusTone === "success"
        ? "text-[#B8F5E6]"
        : "text-[#EAEAEA]/60";

  const batchStatusClassName =
    batchStatusTone === "error"
      ? "text-[#FFB4B4]"
      : batchStatusTone === "success"
        ? "text-[#B8F5E6]"
        : "text-[#EAEAEA]/60";

  const resetForm = () => {
    setCurrentStep(1);
    setStatusMessage("");
    setStatusTone("neutral");
    setXbloomUrl("");
    setName("");
    setAuthorName("");
    setGrams("15");
    setIceGrams("");
    setIsRoasterApproved(false);
    setPourCount("");
    setFirstPourTemperature("");
    setPourSteps([]);
    setBrewer("Omni");
    setRatioInput("225ML - 1:16");
    setRoasterName("");
    setBrewType("");
  };

  const resetBatchForm = () => {
    setCurrentStep(1);
    setBatchStatusMessage("");
    setBatchStatusTone("neutral");
    setBatchUrls("");
    setBatchRecipes([]);
    setBatchDuplicateEntries([]);
    setBatchUniqueUrlsAfterDedup([]);
    setIsBatchDuplicateDialogOpen(false);
    setBatchRoasterName("");
    setBatchApproved(false);
  };

  const openModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const openBatchModal = () => {
    resetBatchForm();
    setIsBatchOpen(true);
  };

  const closeModal = () => {
    if (isSaving || isFetchingXbloom) {
      return;
    }

    setIsOpen(false);
    setStatusMessage("");
    setStatusTone("neutral");
  };

  const closeBatchModal = () => {
    if (isFetchingBatch || isSavingBatch) {
      return;
    }

    setIsBatchOpen(false);
    setBatchStatusMessage("");
    setBatchStatusTone("neutral");
  };

  const setStatus = (message: string, tone: StatusTone = "neutral") => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const setBatchStatus = (message: string, tone: StatusTone = "neutral") => {
    setBatchStatusMessage(message);
    setBatchStatusTone(tone);
  };

  const resetBulkEditForm = () => {
    setBulkEditRoasterMode("keep");
    setBulkEditRoasterSlug("");
    setBulkEditBrewType("keep");
    setBulkEditIceGrams("");
    setBulkEditApproval("keep");
  };

  const clearSelectedRecipes = () => {
    setSelectedRecipeSlugs([]);
  };

  const toggleRecipeSelection = (slug: string) => {
    setSelectedRecipeSlugs((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedRecipeSlugs((current) => {
      if (paginatedRecipes.length === 0) {
        return current;
      }

      const visibleSlugs = paginatedRecipes.map((recipe) => recipe.slug);
      const hasAllVisible = visibleSlugs.every((slug) => current.includes(slug));
      if (hasAllVisible) {
        return current.filter((slug) => !visibleSlugs.includes(slug));
      }

      const merged = new Set([...current, ...visibleSlugs]);
      return [...merged];
    });
  };

  const openBulkEditModal = () => {
    if (selectedRecipeSlugs.length === 0) {
      setStatus("حدد وصفة واحدة على الأقل قبل التعديل الجماعي.", "error");
      return;
    }

    resetBulkEditForm();
    setIsBulkEditOpen(true);
  };

  const handleTranslateSingleRecipeName = () => {
    if (!name.trim()) {
      setStatus("اكتب اسم الوصفة أولًا ثم اضغط ترجمة.", "error");
      return;
    }

    const translated = translateRecipeNameToArabic(name);
    if (!translated) {
      setStatus("بعد حذف الكلمات غير المطلوبة، الاسم أصبح فارغًا. عدّله يدويًا.", "error");
      return;
    }
    setName(translated);
    setStatus("تمت ترجمة الاسم وتنظيف كلمات حار/بارد.", "success");
  };

  const handleTranslateBatchRecipeName = (key: string) => {
    const target = batchRecipes.find((recipe) => recipe.key === key);
    if (!target || !target.name.trim()) {
      setBatchStatus("اكتب اسم الوصفة أولًا ثم اضغط ترجمة.", "error");
      return;
    }

    const translated = translateRecipeNameToArabic(target.name);
    if (!translated) {
      setBatchStatus("بعد حذف الكلمات غير المطلوبة، الاسم أصبح فارغًا. عدّله يدويًا.", "error");
      return;
    }
    updateBatchRecipe(key, (current) => ({
      ...current,
      name: translated,
    }));
    setBatchStatus("تمت ترجمة الاسم وتنظيف كلمات حار/بارد.", "success");
  };

  const fetchXbloomRecipe = async (url: string) => {
    const response = await fetch("/api/xbloom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url.trim(),
      }),
    });

    const payload =
      (await readJsonSafely<XbloomPayload>(response)) ?? {
        message: "الرد من الخادم غير مكتمل.",
      };

    if (!response.ok) {
      throw new Error(payload.message || "تعذر جلب المعلومات من xBloom.");
    }

    return payload;
  };

  const buildRatioInput = (payload: XbloomPayload) => {
    const waterPart = payload.waterMl ? `${payload.waterMl}ML` : "";
    const ratioPart = payload.ratio ?? "";
    return [waterPart, ratioPart].filter(Boolean).join(" - ");
  };

  const handleFetchFromXbloom = async () => {
    const parsedInput = parseXbloomInput(xbloomUrl);
    if (!parsedInput.url) {
      setStatus("أضف رابط xBloom أولاً.", "error");
      return;
    }

    setIsFetchingXbloom(true);
    setStatus("");

    try {
      const payload = await fetchXbloomRecipe(parsedInput.url);
      setXbloomUrl(parsedInput.url);

      if (parsedInput.customName) {
        setName(stripRecipeHeatDescriptors(parsedInput.customName));
      } else if (payload.name) {
        setName(stripRecipeHeatDescriptors(payload.name));
      }
      if (payload.authorName) {
        setAuthorName(payload.authorName);
      }
      if (payload.grams) {
        setGrams(String(payload.grams));
      }
      if (payload.brewer) {
        setBrewer(payload.brewer);
      }
      if (payload.pourCount) {
        setPourCount(String(payload.pourCount));
      }
      if (payload.firstPourTemperature) {
        setFirstPourTemperature(String(payload.firstPourTemperature));
      }
      if (payload.pourSteps) {
        setPourSteps(payload.pourSteps);
      }
      if (payload.waterMl || payload.ratio) {
        setRatioInput(buildRatioInput(payload));
      }

      setCurrentStep(2);
      setStatus("تم استيراد بيانات الوصفة بنجاح", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء جلب بيانات xBloom.",
        "error",
      );
    } finally {
      setIsFetchingXbloom(false);
    }
  };

  const analyzeBatchDuplicates = (urls: string[]) => {
    const byKey = new Map<string, { count: number; sampleUrl: string }>();
    const firstUniqueUrlByKey = new Map<string, string>();

    urls.forEach((url) => {
      const key = normalizeXbloomUrl(url);
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { count: 1, sampleUrl: url });
      }

      if (!firstUniqueUrlByKey.has(key)) {
        firstUniqueUrlByKey.set(key, url);
      }
    });

    const existingKeys = new Set(
      recipes.map((recipe) => normalizeXbloomUrl(recipe.xbloomUrl)),
    );

    const duplicateEntries: BatchDuplicateEntry[] = [];
    byKey.forEach((value, key) => {
      if (value.count > 1) {
        duplicateEntries.push({
          key,
          sampleUrl: value.sampleUrl,
          count: value.count,
          reason: "input-duplicate",
        });
      }

      if (existingKeys.has(key)) {
        duplicateEntries.push({
          key,
          sampleUrl: value.sampleUrl,
          count: value.count,
          reason: "already-exists",
        });
      }
    });

    const dedupedUrls = [...firstUniqueUrlByKey.entries()]
      .filter(([key]) => !existingKeys.has(key))
      .map(([, url]) => url);

    return {
      duplicateEntries,
      dedupedUrls,
      removedCount: urls.length - dedupedUrls.length,
    };
  };

  const importBatchRecipesFromUrls = async (urls: string[]) => {
    if (urls.length === 0) {
      setBatchStatus("لا توجد روابط صالحة للاستيراد بعد إزالة المكرر.", "error");
      return;
    }

    setIsFetchingBatch(true);
    setBatchStatus("");

    try {
      const drafts = await Promise.all(
        urls.map(async (urlLine, index) => {
          const parsedInput = parseXbloomInput(urlLine);
          const payload = await fetchXbloomRecipe(parsedInput.url);

          return {
            key: `${Date.now()}-${index}`,
            url: parsedInput.url,
            name: stripRecipeHeatDescriptors(
              parsedInput.customName || payload.name || "",
            ),
            authorName: payload.authorName ?? "",
            roasterSlug: "",
            brewer: payload.brewer ?? "Omni",
            grams: payload.grams ? String(payload.grams) : "15",
            ratioInput: buildRatioInput(payload) || "225ML - 1:16",
            pourCount: payload.pourCount ? String(payload.pourCount) : "",
            firstPourTemperature: payload.firstPourTemperature
              ? String(payload.firstPourTemperature)
              : "",
            pourSteps: payload.pourSteps ?? [],
            brewType: "" as AdminBrewType,
            iceGrams: "",
          } satisfies BatchRecipeDraft;
        }),
      );

      setBatchRecipes(drafts);
      setCurrentStep(2);
      setBatchStatus("تم استيراد بيانات الوصفات بنجاح", "success");
    } catch (error) {
      setBatchStatus(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الوصفات.",
        "error",
      );
    } finally {
      setIsFetchingBatch(false);
    }
  };

  const handleFetchBatchRecipes = async () => {
    const urls = batchUrls
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setBatchStatus("أضف رابطًا واحدًا على الأقل.", "error");
      return;
    }

    const { duplicateEntries, dedupedUrls, removedCount } =
      analyzeBatchDuplicates(urls);

    if (duplicateEntries.length > 0) {
      setBatchDuplicateEntries(duplicateEntries);
      setBatchUniqueUrlsAfterDedup(dedupedUrls);
      setIsBatchDuplicateDialogOpen(true);
      setBatchStatus(
        `تم العثور على ${new Intl.NumberFormat("ar-EG").format(
          duplicateEntries.length,
        )} حالة تكرار. يمكنك المتابعة مع حذف المكرر تلقائيًا.`,
        "neutral",
      );
      return;
    }

    if (removedCount > 0 && dedupedUrls.length === 0) {
      setBatchStatus("كل الروابط مكررة أو موجودة مسبقًا.", "error");
      return;
    }

    await importBatchRecipesFromUrls(dedupedUrls);
  };

  const handleContinueBatchAfterDedup = async () => {
    setIsBatchDuplicateDialogOpen(false);

    if (batchUniqueUrlsAfterDedup.length === 0) {
      setBatchStatus("بعد إزالة المكرر لا توجد روابط جديدة للاستيراد.", "error");
      return;
    }

    await importBatchRecipesFromUrls(batchUniqueUrlsAfterDedup);
  };

  const goToStepThree = () => {
    if (!canContinueStepTwo) {
      setStatus("تأكد من الاسم واسم الناشر وكمية البن والأداة والنسبة أولًا.", "error");
      return;
    }

    setCurrentStep(3);
    setStatus("");
  };

  const goBatchToStepThree = () => {
    const hasInvalidRecipe = batchRecipes.some(
      (recipe) =>
        !recipe.name.trim() ||
        !recipe.authorName.trim() ||
        !recipe.brewer.trim() ||
        !Number.isFinite(Number(recipe.grams)) ||
        Number(recipe.grams) <= 0 ||
        !recipe.ratioInput.trim(),
    );

    if (hasInvalidRecipe) {
      setBatchStatus("راجع بيانات الوصفات أولًا قبل الانتقال للخطوة الأخيرة.", "error");
      return;
    }

    setCurrentStep(3);
    setBatchStatus("");
  };

  const handleSave = async () => {
    if (!canSave) {
      setStatus("أكمل البيانات المطلوبة قبل حفظ الوصفة.", "error");
      return;
    }

    const parsedSingleInput = parseXbloomInput(xbloomUrl);
    const cleanXbloomUrl = parsedSingleInput.url || xbloomUrl.trim();
    const incomingKey = normalizeXbloomUrl(cleanXbloomUrl);
    const duplicateLocal = recipes.find(
      (recipe) => normalizeXbloomUrl(recipe.xbloomUrl) === incomingKey,
    );
    if (duplicateLocal) {
      setStatus(`هذا الرابط مضاف مسبقًا في وصفة "${duplicateLocal.name}".`, "error");
      return;
    }

    setIsSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          authorName,
          isRoasterApproved,
          grams: Number(grams),
          iceGrams: requiresIce ? Number(iceGrams) : null,
          pourCount: pourCount ? Number(pourCount) : null,
          firstPourTemperature: firstPourTemperature
            ? Number(firstPourTemperature)
            : null,
          pourSteps,
          brewer,
          ratioInput,
          roasterSlug: matchedRoaster?.slug ?? null,
          roasterName: roasterName.trim() || null,
          brewType,
          xbloomUrl: cleanXbloomUrl,
        }),
      });

      const payload =
        (await readJsonSafely<(ManagedRecipe & { recipeUrl?: string }) | { message?: string }>(response)) ??
        {
          message: "الرد من الخادم غير مكتمل.",
        };
      if (!response.ok || !("slug" in payload)) {
        throw new Error(
          "message" in payload ? payload.message || "تعذر حفظ الوصفة." : "تعذر حفظ الوصفة.",
        );
      }

      setRecipes((current) => [payload, ...current]);
      announceRecipeAdded({
        type: "recipe-added",
        recipeName: payload.name,
        authorName: payload.authorName,
        roasterName: payload.roasterName || MISC_RECIPES_LABEL,
      });
      setIsOpen(false);
      resetForm();
      const params = new URLSearchParams({
        slug: payload.slug,
        from: "admin",
      });
      router.push(`/recipes/success?${params.toString()}`);
      return;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "حدث خطأ أثناء إضافة الوصفة.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateBatchRecipe = (
    key: string,
    updater: (current: BatchRecipeDraft) => BatchRecipeDraft,
  ) => {
    setBatchRecipes((current) =>
      current.map((recipe) => (recipe.key === key ? updater(recipe) : recipe)),
    );
  };

  const applyBatchBrewTypeToAll = (nextType: Exclude<AdminBrewType, "">) => {
    setBatchRecipes((current) =>
      current.map((recipe) => ({
        ...recipe,
        brewType: nextType,
        iceGrams: nextType === "cold" ? recipe.iceGrams : "",
      })),
    );
  };

  const handleSaveBatch = async () => {
    if (!canSaveBatch) {
      setBatchStatus("حدد نوع التحضير لكل وصفة وأكمل الحقول المطلوبة.", "error");
      return;
    }

    const batchKeys = batchRecipes.map((recipe) => normalizeXbloomUrl(recipe.url));
    const duplicateInBatch = batchKeys.find(
      (key, index) => batchKeys.indexOf(key) !== index,
    );
    if (duplicateInBatch) {
      setBatchStatus("لا يمكن حفظ الوصفات لأن هناك رابطًا مكررًا داخل نفس الدفعة.", "error");
      return;
    }

    const existingKeys = new Set(recipes.map((recipe) => normalizeXbloomUrl(recipe.xbloomUrl)));
    const duplicateAgainstExisting = batchKeys.find((key) => existingKeys.has(key));
    if (duplicateAgainstExisting) {
      setBatchStatus("واحد أو أكثر من الروابط موجود مسبقًا في الوصفات الحالية.", "error");
      return;
    }

    setIsSavingBatch(true);
    setBatchStatus("");

    try {
      const savedRecipes: ManagedRecipe[] = [];

      for (const recipe of batchRecipes) {
        const recipeSpecificRoaster = recipe.roasterSlug
          ? roasters.find((roaster) => roaster.slug === recipe.roasterSlug) ?? null
          : null;
        const resolvedRoaster = recipeSpecificRoaster ?? matchedBatchRoaster;

        const response = await fetch("/api/recipes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: recipe.name,
            authorName: recipe.authorName,
            isRoasterApproved: batchApproved,
            grams: Number(recipe.grams),
            iceGrams: recipe.brewType === "cold" ? Number(recipe.iceGrams) : null,
            pourCount: recipe.pourCount ? Number(recipe.pourCount) : null,
            firstPourTemperature: recipe.firstPourTemperature
              ? Number(recipe.firstPourTemperature)
              : null,
            pourSteps: recipe.pourSteps,
            brewer: recipe.brewer,
            ratioInput: recipe.ratioInput,
            roasterSlug: resolvedRoaster?.slug ?? null,
            roasterName: resolvedRoaster?.name ?? null,
            brewType: recipe.brewType,
            xbloomUrl: recipe.url,
          }),
        });

        const payload =
          (await readJsonSafely<ManagedRecipe | { message?: string }>(response)) ?? {
            message: "الرد من الخادم غير مكتمل.",
          };

        if (!response.ok || !("slug" in payload)) {
          throw new Error(
            "message" in payload
              ? payload.message || "تعذر حفظ الوصفات."
              : "تعذر حفظ الوصفات.",
          );
        }

        savedRecipes.push(payload);
      }

      setRecipes((current) => [...savedRecipes.reverse(), ...current]);
      savedRecipes.forEach((recipe) => {
        announceRecipeAdded({
          type: "recipe-added",
          recipeName: recipe.name,
          authorName: recipe.authorName,
          roasterName: recipe.roasterName || MISC_RECIPES_LABEL,
        });
      });
      router.refresh();
      setIsBatchOpen(false);
      resetBatchForm();
      setStatus(`تمت إضافة ${savedRecipes.length} وصفة بنجاح.`, "success");
    } catch (error) {
      setBatchStatus(
        error instanceof Error ? error.message : "حدث خطأ أثناء إضافة الوصفات.",
        "error",
      );
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      const response = await fetch(`/api/recipes/${slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("تعذر حذف الوصفة.");
      }

      setRecipes((current) => current.filter((recipe) => recipe.slug !== slug));
      router.refresh();
      setStatus("تم حذف الوصفة.", "success");
      setRecipePendingDelete(null);
    } catch {
      setStatus("تعذر حذف الوصفة الآن.", "error");
    }
  };

  const openRecipeNameEditor = (recipe: ManagedRecipe) => {
    setRecipeNameEditTarget(recipe);
    setRecipeNameEditValue(recipe.name);
  };

  const closeRecipeNameEditor = () => {
    if (isRecipeNameSaving) {
      return;
    }
    setRecipeNameEditTarget(null);
    setRecipeNameEditValue("");
  };

  const handleSaveRecipeName = async () => {
    if (!recipeNameEditTarget) {
      return;
    }

    const nextName = recipeNameEditValue.trim();
    if (!nextName) {
      setStatus("اكتب اسم الوصفة قبل الحفظ.", "error");
      return;
    }

    if (nextName === recipeNameEditTarget.name) {
      closeRecipeNameEditor();
      return;
    }

    setIsRecipeNameSaving(true);
    try {
      const response = await fetch(`/api/recipes/${recipeNameEditTarget.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
        }),
      });

      const payload =
        (await readJsonSafely<ManagedRecipe | { message?: string }>(response)) ?? null;

      if (!response.ok || !payload || !("slug" in payload)) {
        throw new Error(
          payload && "message" in payload
            ? payload.message || "تعذر تعديل اسم الوصفة."
            : "تعذر تعديل اسم الوصفة.",
        );
      }

      setRecipes((current) =>
        current.map((recipe) => (recipe.slug === payload.slug ? payload : recipe)),
      );
      setPreviewRecipe((current) =>
        current?.slug === payload.slug ? payload : current,
      );
      setStatus("تم تعديل اسم الوصفة بنجاح.", "success");
      router.refresh();
      closeRecipeNameEditor();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "تعذر تعديل اسم الوصفة الآن.",
        "error",
      );
    } finally {
      setIsRecipeNameSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecipeSlugs.length === 0) {
      setStatus("حدد وصفة واحدة على الأقل للحذف.", "error");
      setIsBulkDeleteOpen(false);
      return;
    }

    setIsBulkDeleting(true);
    const slugsToDelete = [...selectedRecipeSlugs];
    const deleted = new Set<string>();
    let failedCount = 0;

    try {
      for (const slug of slugsToDelete) {
        const response = await fetch(`/api/recipes/${slug}`, {
          method: "DELETE",
        });
        if (response.ok) {
          deleted.add(slug);
        } else {
          failedCount += 1;
        }
      }

      if (deleted.size > 0) {
        setRecipes((current) => current.filter((recipe) => !deleted.has(recipe.slug)));
        setSelectedRecipeSlugs((current) =>
          current.filter((slug) => !deleted.has(slug)),
        );
        router.refresh();
      }

      if (failedCount > 0) {
        setStatus(
          `تم حذف ${deleted.size} وصفة وتعذر حذف ${failedCount} وصفة.`,
          "error",
        );
      } else {
        setStatus(`تم حذف ${deleted.size} وصفة بنجاح.`, "success");
      }
    } catch {
      setStatus("تعذر تنفيذ الحذف الجماعي الآن.", "error");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteOpen(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedRecipes.length === 0) {
      setStatus("حدد وصفة واحدة على الأقل قبل التعديل.", "error");
      return;
    }

    const hasAnyChange =
      bulkEditRoasterMode !== "keep" ||
      bulkEditBrewType !== "keep" ||
      bulkEditApproval !== "keep";

    if (!hasAnyChange) {
      setStatus("اختر تعديلًا واحدًا على الأقل قبل الحفظ.", "error");
      return;
    }

    const updates: Record<string, unknown> = {};

    if (bulkEditRoasterMode === "set") {
      if (!bulkEditRoasterSlug) {
        setStatus("اختر المحمصة أولًا لتطبيقها على الوصفات المحددة.", "error");
        return;
      }
      const roaster = roasters.find((item) => item.slug === bulkEditRoasterSlug);
      if (!roaster) {
        setStatus("المحمصة المختارة غير موجودة.", "error");
        return;
      }
      updates.roasterSlug = roaster.slug;
      updates.roasterName = roaster.name;
    } else if (bulkEditRoasterMode === "clear") {
      updates.roasterSlug = null;
      updates.roasterName = null;
    }

    if (bulkEditBrewType !== "keep") {
      updates.brewType = bulkEditBrewType;
      if (bulkEditBrewType === "cold") {
        const ice = Number(bulkEditIceGrams);
        if (!Number.isFinite(ice) || ice <= 0) {
          setStatus("للوصفات الباردة أدخل جرامات ثلج صحيحة.", "error");
          return;
        }
        updates.iceGrams = Math.round(ice);
      } else {
        updates.iceGrams = null;
      }
    }

    if (bulkEditApproval !== "keep") {
      updates.isRoasterApproved = bulkEditApproval === "approved";
    }

    setIsBulkEditing(true);
    const updatedMap = new Map<string, ManagedRecipe>();
    let failedCount = 0;

    try {
      for (const recipe of selectedRecipes) {
        const response = await fetch(`/api/recipes/${recipe.slug}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        const payload =
          (await readJsonSafely<ManagedRecipe | { message?: string }>(response)) ?? null;

        if (!response.ok || !payload || !("slug" in payload)) {
          failedCount += 1;
          continue;
        }

        updatedMap.set(payload.slug, payload);
      }

      if (updatedMap.size > 0) {
        setRecipes((current) =>
          current.map((recipe) => updatedMap.get(recipe.slug) ?? recipe),
        );
        router.refresh();
      }

      if (failedCount > 0) {
        setStatus(
          `تم تعديل ${updatedMap.size} وصفة وتعذر تعديل ${failedCount} وصفة.`,
          "error",
        );
      } else {
        setStatus(`تم تعديل ${updatedMap.size} وصفة بنجاح.`, "success");
      }

      if (updatedMap.size > 0) {
        setIsBulkEditOpen(false);
        clearSelectedRecipes();
      }
    } catch {
      setStatus("تعذر تنفيذ التعديل الجماعي الآن.", "error");
    } finally {
      setIsBulkEditing(false);
    }
  };

  const openPreview = (recipe: ManagedRecipe) => {
    setPreviewRecipe(recipe);
  };

  return (
    <>
      <section className="mt-6 w-full min-w-0 overflow-x-hidden rounded-[28px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="mt-1 text-2xl font-bold">الوصفات</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openModal}
              className="inline-flex w-fit items-center gap-2 rounded-[18px] bg-black px-5 py-3 text-sm font-bold text-white shadow-[0_16px_44px_rgba(0,0,0,0.12)] transition hover:scale-[1.01] dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
            >
              <PlusIcon />
              <span>إضافة وصفة</span>
            </button>
            <button
              type="button"
              onClick={openBatchModal}
              className="inline-flex w-fit items-center gap-2 rounded-[18px] border border-black/10 bg-black/[0.04] px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] dark:border-white/10 dark:bg-white/[0.05] dark:text-[#EAEAEA]"
            >
              <SparkIcon />
              <span>إضافة عدة وصفات</span>
            </button>
          </div>
        </div>

        {statusMessage && !isOpen && (
          <p className={`mt-4 text-sm font-bold ${statusClassName}`}>{statusMessage}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] border border-black/10 bg-black/[0.03] px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <span className="text-xs font-bold text-black/48 dark:text-[#EAEAEA]/48">
            الفلاتر:
          </span>
          <button
            type="button"
            onClick={() => setRecipesFilterMode("all")}
            className={`rounded-[12px] border px-3 py-2 text-xs font-bold transition ${
              recipesFilterMode === "all"
                ? "border-black/20 bg-black text-white dark:border-white/18 dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
                : "border-black/10 text-black/70 hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA]/70 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
            }`}
          >
            كل الوصفات
          </button>
          <button
            type="button"
            onClick={() => setRecipesFilterMode("approved")}
            className={`rounded-[12px] border px-3 py-2 text-xs font-bold transition ${
              recipesFilterMode === "approved"
                ? "border-black/20 bg-black text-white dark:border-white/18 dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
                : "border-black/10 text-black/70 hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA]/70 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
            }`}
          >
            الوصفات المعتمدة
          </button>
          <button
            type="button"
            onClick={() => setRecipesFilterMode("unassigned")}
            className={`rounded-[12px] border px-3 py-2 text-xs font-bold transition ${
              recipesFilterMode === "unassigned"
                ? "border-black/20 bg-black text-white dark:border-white/18 dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
                : "border-black/10 text-black/70 hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA]/70 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
            }`}
          >
            بدون محمصة
          </button>
          <div className="relative min-w-[220px]">
            <select
              value={recipesRoasterFilter}
              onChange={(event) => setRecipesRoasterFilter(event.target.value)}
              className="ui-select h-10 w-full rounded-[12px] border border-black/10 bg-white/85 px-3 pr-3 pl-9 text-xs font-bold text-black/78 outline-none transition focus:border-black/20 dark:border-white/10 dark:bg-[#121722] dark:text-[#EAEAEA]"
            >
              <option value="all">كل أسماء المحامص</option>
              {recipesRoasterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <SelectChevron />
            </span>
          </div>
        </div>

        {selectedRecipeSlugs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm font-bold text-black/70 dark:text-[#EAEAEA]/78">
              تم تحديد {selectedRecipeSlugs.length} وصفة
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openBulkEditModal}
                className="rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/12 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                تعديل المحدد
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(true)}
                className="rounded-[12px] border border-[#D96C6C]/24 px-3 py-2 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white dark:border-[#F18A8A]/20 dark:text-[#F1A4A4] dark:hover:bg-[#D96C6C] dark:hover:text-[#0B0F1A]"
              >
                حذف المحدد
              </button>
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                {allVisibleSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
              <button
                type="button"
                onClick={clearSelectedRecipes}
                className="rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                مسح التحديد
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 grid min-w-0 gap-3 xl:grid-cols-2">
          {paginatedRecipes.length > 0 ? (
            paginatedRecipes.map((recipe) => (
              <article
                key={recipe.slug}
                className="rounded-[24px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]"
              >
                <div className="mb-3 flex items-center justify-end">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/8 bg-black/[0.03] px-3 py-1.5 text-xs font-bold text-black/68 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/75">
                    <input
                      type="checkbox"
                      checked={selectedSlugSet.has(recipe.slug)}
                      onChange={() => toggleRecipeSelection(recipe.slug)}
                      className="h-4 w-4 accent-black dark:accent-white"
                    />
                    تحديد
                  </label>
                </div>
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{recipe.name}</p>
                    {recipe.isRoasterApproved && (
                      <p className="mt-2 inline-flex rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-black/62 dark:border-white/12 dark:bg-white/[0.06] dark:text-[#EAEAEA]/78">
                        وصفة معتمدة من المحمصة
                      </p>
                    )}
                    <p className="mt-1 break-words text-sm text-black/45 dark:text-[#EAEAEA]/45">
                      {recipe.authorName} · {recipe.brewer}
                    </p>
                    <p className="mt-2 break-words text-sm text-black/45 dark:text-[#EAEAEA]/45">
                      {recipe.roasterName || MISC_RECIPES_LABEL} · {recipeStatText(recipe)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-black/40 dark:text-[#EAEAEA]/40">
                      {recipe.pourCount ? `${recipe.pourCount} صبات` : "بدون بيانات صبات"}
                      {" · "}
                      {recipe.firstPourTemperature
                        ? `${recipe.firstPourTemperature}° أول صبة`
                        : "بدون حرارة أولى"}
                    </p>
                  </div>

                  <div className="flex w-full max-w-[220px] flex-col gap-2 sm:w-auto">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openPreview(recipe)}
                        className="rounded-[14px] border border-black/8 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
                      >
                        عرض الوصفة
                      </button>
                      <a
                        href={recipe.xbloomUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[14px] border border-black/8 px-3 py-2 text-center text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
                      >
                        دخول xBloom
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRecipeNameEditor(recipe)}
                      className="rounded-[14px] border border-black/8 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
                    >
                      تعديل الاسم
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipePendingDelete(recipe)}
                      className="rounded-[14px] border border-[#D96C6C]/24 px-3 py-2 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white dark:border-[#F18A8A]/20 dark:text-[#F1A4A4] dark:hover:bg-[#D96C6C] dark:hover:text-[#0B0F1A]"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[24px] border border-black/8 bg-[#F8F8F5] px-5 py-8 text-center text-sm font-bold text-black/42 dark:border-white/10 dark:bg-[#101623] dark:text-[#EAEAEA]/42 xl:col-span-2">
              {recipes.length === 0
                ? "لا توجد وصفات مضافة حتى الآن."
                : "لا توجد وصفات تطابق الفلاتر الحالية."}
            </div>
          )}
        </div>

        {filteredRecipes.length > ADMIN_RECIPES_PER_PAGE && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-black/8 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-bold text-black/55 dark:text-[#EAEAEA]/55">
              صفحة {new Intl.NumberFormat("ar-EG").format(recipesPage)} من{" "}
              {new Intl.NumberFormat("ar-EG").format(totalRecipesPages)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecipesPage((current) => Math.max(1, current - 1))}
                disabled={recipesPage <= 1}
                className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={() =>
                  setRecipesPage((current) => Math.min(totalRecipesPages, current + 1))
                }
                disabled={recipesPage >= totalRecipesPages}
                className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </section>

      {previewRecipe && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/76 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0D1016] p-6 text-[#EAEAEA] shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setPreviewRecipe(null)}
                className="text-white/62 transition hover:text-white"
              >
                <CloseIcon />
              </button>
              <div className="text-right">
                <p className="text-[11px] font-bold tracking-[0.18em] text-white/34">
                  معاينة الوصفة
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  {previewRecipe.name}
                </h3>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["الناشر", previewRecipe.authorName],
                ["الأداة", previewRecipe.brewer],
                [
                  "الجرعة",
                  previewRecipe.brewType === "cold" && previewRecipe.iceGrams
                    ? `${previewRecipe.grams} جرام قهوة · ${previewRecipe.iceGrams} جرام ثلج`
                    : `${previewRecipe.grams} جرام`,
                ],
                ["الماء", previewRecipe.waterMl ? `${previewRecipe.waterMl} مل` : "حسب الوصفة"],
                ["الريشيو", previewRecipe.ratio],
                [
                  "النوع",
                  previewRecipe.brewType === "cold"
                    ? "بارد"
                    : previewRecipe.brewType === "filter"
                      ? "فلتر"
                      : "حار",
                ],
                ["عدد الصبات", previewRecipe.pourCount ? `${previewRecipe.pourCount}` : "غير متوفر"],
                [
                  "أول حرارة صبة",
                  previewRecipe.firstPourTemperature
                    ? `${previewRecipe.firstPourTemperature}°`
                    : "غير متوفرة",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4"
                >
                  <p className="text-xs font-bold text-white/38">{label}</p>
                  <p className="mt-2 text-base font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <a
                href={previewRecipe.xbloomUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/12 bg-[#EAEAEA] px-5 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105"
              >
                دخول xBloom
              </a>
              <button
                type="button"
                onClick={() => setPreviewRecipe(null)}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05070D]/84 p-4 backdrop-blur-md">
          <div className="relative max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0D1016] text-[#EAEAEA] shadow-[0_40px_140px_rgba(0,0,0,0.55)]">
            <div className="flex max-h-[94vh] flex-col overflow-y-auto hide-scrollbar bg-[linear-gradient(180deg,#12151C,#0B0E14)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0D1016]/92 px-6 py-5 backdrop-blur-xl sm:px-7">
                <div className="relative flex items-center justify-center">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="absolute right-0 text-[#EAEAEA]/68 transition hover:text-[#EAEAEA]"
                  >
                    <CloseIcon />
                  </button>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">إضافة وصفة جديدة</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-6 py-6 sm:px-7">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
                  <div className="mb-8 flex items-center justify-center gap-3 sm:gap-5">
                    {([
                      { step: 1 as Step, label: "1" },
                      { step: 2 as Step, label: "2" },
                      { step: 3 as Step, label: "3" },
                    ]).map((item, index, array) => {
                      const isActive = item.step === currentStep;
                      const isDone = item.step < currentStep;

                      return (
                        <div key={item.step} className="flex items-center gap-3 sm:gap-5">
                          <div
                            className={`grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition ${
                              isDone
                                ? "border-white/20 bg-[#EAEAEA] text-[#0B0F1A]"
                                : isActive
                                  ? "border-white/18 bg-white/[0.12] text-white shadow-[0_0_0_10px_rgba(255,255,255,0.035)]"
                                  : "border-white/10 bg-white/[0.04] text-white/48"
                            }`}
                          >
                            {item.label}
                          </div>
                          {index < array.length - 1 && (
                            <span className="h-px w-10 bg-white/10 sm:w-16" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                    {currentStep === 1 && (
                      <div className="mx-auto max-w-2xl">
                        <div className="text-center">
                          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                            <LinkIcon />
                          </span>
                          <h3 className="mt-4 text-xl font-bold text-white">
                            استيراد بيانات الوصفة من xBloom
                          </h3>
                        </div>

                        <label className="mt-8 block">
                          <span className="mb-3 block text-center text-sm font-bold text-[#EAEAEA]/78">
                            ألصق الرابط
                          </span>
                          <input
                            value={xbloomUrl}
                            onChange={(event) => setXbloomUrl(event.target.value)}
                            placeholder="https://share-h5.xbloom.com/?id=..."
                            className="h-[60px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white outline-none transition focus:border-white/18 focus:bg-white/[0.055]"
                          />
                        </label>

                        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            ["الاسم", name || "سيظهر بعد الاستيراد"],
                            ["كمية البن", `${grams || "--"} جرام`],
                            ["النسبة", ratioInput || "--"],
                            ["الصبات", pourCount || "--"],
                            [
                              "درجة الحرارة",
                              firstPourTemperature ? `${firstPourTemperature}°` : "--",
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4"
                            >
                              <p className="text-xs font-bold text-white/38">{label}</p>
                              <p className="mt-2 text-sm font-bold text-white/78">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                            <SparkIcon />
                          </span>
                          <h3 className="text-xl font-bold text-white">بيانات الوصفة</h3>
                        </div>

                        <div className="mt-8 grid gap-5 md:grid-cols-2">
                          <label className="block">
                            <span className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-[#EAEAEA]/78">
                              <span>اسم الوصفة</span>
                              <button
                                type="button"
                                onClick={handleTranslateSingleRecipeName}
                                className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-white/[0.11]"
                              >
                                ترجمة
                              </button>
                            </span>
                            <input
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              اسم الناشر
                            </span>
                            <input
                              value={authorName}
                              onChange={(event) => setAuthorName(event.target.value)}
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              كمية البن
                            </span>
                            <input
                              value={grams}
                              onChange={(event) => setGrams(event.target.value)}
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              الأداة
                            </span>
                            <div className="relative">
                              <select
                                value={brewer}
                                onChange={(event) => setBrewer(event.target.value)}
                                className="ui-select ui-select-dark h-14 w-full rounded-[18px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                              >
                                {brewerOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                                <SelectChevron />
                              </span>
                            </div>
                          </label>
                        </div>

                        <label className="mt-5 block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                            النسبة وكمية الماء
                          </span>
                          <input
                            value={ratioInput}
                            onChange={(event) => setRatioInput(event.target.value)}
                            placeholder="225ML - 1:16"
                            className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                          />
                        </label>

                        <div className="mt-5 grid gap-5 md:grid-cols-2">
                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              عدد الصبات
                            </span>
                            <input
                              value={pourCount}
                              onChange={(event) => setPourCount(event.target.value)}
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              درجة الحرارة
                            </span>
                            <input
                              value={firstPourTemperature}
                              onChange={(event) =>
                                setFirstPourTemperature(event.target.value)
                              }
                              placeholder="91"
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                            <BeanIcon />
                          </span>
                          <h3 className="text-xl font-bold text-white">
                            بيانات إضافية للوصفة
                          </h3>
                        </div>

                        <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.88fr]">
                          <label className="block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              اختر محمصة
                            </span>
                            <div className="relative">
                              <select
                                value={matchedRoaster?.slug ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (!value) {
                                    setRoasterName("");
                                    return;
                                  }

                                  const selectedRoaster =
                                    roasters.find((roaster) => roaster.slug === value) ?? null;
                                  setRoasterName(selectedRoaster?.name ?? "");
                                }}
                                className="ui-select ui-select-dark h-14 w-full rounded-[18px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                              >
                                <option value="">بدون محمصة</option>
                                {roasters.map((roaster) => (
                                  <option key={roaster.slug} value={roaster.slug}>
                                    {roaster.name}
                                  </option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                                <SelectChevron />
                              </span>
                            </div>
                          </label>

                          <div>
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              نوع التحضير
                            </span>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {[
                                {
                                  value: "hot" as const,
                                  label: "حار",
                                  icon: <FlameIcon />,
                                },
                                {
                                  value: "cold" as const,
                                  label: "بارد",
                                  icon: <SnowIcon />,
                                },
                              ].map((item) => (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setBrewType(item.value)}
                                  className={`flex h-14 items-center justify-between rounded-[18px] border px-4 text-right transition ${
                                    brewType === item.value
                                      ? "border-white/16 bg-white/[0.08] text-white shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
                                      : "border-white/8 bg-white/[0.025] text-white/62 hover:bg-white/[0.04]"
                                  }`}
                                >
                                  <span className="text-sm font-bold">{item.label}</span>
                                  <span className="text-white/72">{item.icon}</span>
                                </button>
                              ))}
                            </div>
                            {!brewType && (
                              <p className="mt-3 text-xs font-bold text-[#FFB4B4]">
                                اختر نوع التحضير قبل الحفظ.
                              </p>
                            )}
                          </div>

                        </div>

                        <label className="mt-5 flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">
                              وصفة معتمدة من المحمصة
                            </p>
                            <p className="mt-1 text-xs font-bold text-white/38">
                              ستظهر على الكارد كشارة اعتماد من المحمصة
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsRoasterApproved((current) => !current)}
                            className={`relative h-8 w-14 rounded-full border transition ${
                              isRoasterApproved
                                ? "border-white/20 bg-[#EAEAEA]"
                                : "border-white/10 bg-white/[0.06]"
                            }`}
                            aria-pressed={isRoasterApproved}
                          >
                            <span
                              className={`absolute top-1 h-5 w-5 rounded-full transition ${
                                isRoasterApproved
                                  ? "right-1 bg-[#0B0F1A]"
                                  : "right-8 bg-white/80"
                              }`}
                            />
                          </button>
                        </label>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-center gap-2 text-white/46">
                              <BeanIcon />
                              <p className="text-xs font-bold">كمية البن</p>
                            </div>
                            <p className="mt-2 text-base font-bold text-white">
                              {grams || "--"} جرام
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-center gap-2 text-white/46">
                              <SnowIcon />
                              <p className="text-xs font-bold">الثلج</p>
                            </div>
                            <p className="mt-2 text-base font-bold text-white">
                              {requiresIce ? `${iceGrams || "--"} جرام` : "غير مطلوب"}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-center gap-2 text-white/46">
                              <WaterIcon />
                              <p className="text-xs font-bold">النسبة</p>
                            </div>
                            <p className="mt-2 text-base font-bold text-white">
                              {ratioInput || "--"}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-center gap-2 text-white/46">
                              <LinkIcon />
                              <p className="text-xs font-bold">المحمصة</p>
                            </div>
                            <p className="mt-2 text-base font-bold text-white">
                              {roasterName || MISC_RECIPES_LABEL}
                            </p>
                          </div>
                        </div>

                        {requiresIce && (
                          <label className="mt-5 block">
                            <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                              جرامات الثلج
                            </span>
                            <input
                              value={iceGrams}
                              onChange={(event) => setIceGrams(event.target.value)}
                              placeholder="170"
                              className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {statusMessage && (
                    <p className={`mt-4 text-sm font-bold ${statusClassName}`}>
                      {statusMessage}
                    </p>
                  )}
                </div>

                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0D1016]/92 px-6 py-4 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/70 transition hover:text-white"
                  >
                    إلغاء
                  </button>

                  <div className="flex flex-wrap items-center gap-3">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setCurrentStep((currentStep - 1) as Step)}
                        className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        السابق
                      </button>
                    )}

                    {currentStep === 1 && (
                      <button
                        type="button"
                        onClick={handleFetchFromXbloom}
                        disabled={isFetchingXbloom}
                        className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-70"
                      >
                        {isFetchingXbloom
                          ? "جارٍ استيراد البيانات..."
                          : "استيراد بيانات الوصفة من xBloom"}
                      </button>
                    )}

                    {currentStep === 2 && (
                      <button
                        type="button"
                        onClick={goToStepThree}
                        className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105"
                      >
                        التالي
                      </button>
                    )}

                    {currentStep === 3 && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !canSave}
                        className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {isSaving ? "جارٍ الحفظ..." : "حفظ الوصفة"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {isBatchOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-[#05070D]/88 p-4 backdrop-blur-md">
          <div className="relative max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0D1016] text-[#EAEAEA] shadow-[0_40px_140px_rgba(0,0,0,0.55)]">
            <div className="flex max-h-[94vh] flex-col overflow-y-auto hide-scrollbar bg-[linear-gradient(180deg,#12151C,#0B0E14)]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0D1016]/92 px-6 py-5 backdrop-blur-xl sm:px-7">
                <div className="relative flex items-center justify-center">
                  <button
                    type="button"
                    onClick={closeBatchModal}
                    className="absolute right-0 text-[#EAEAEA]/68 transition hover:text-[#EAEAEA]"
                  >
                    <CloseIcon />
                  </button>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">إضافة عدة وصفات</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-6 py-6 sm:px-7">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
                  <div className="mb-8 flex items-center justify-center gap-3 sm:gap-5">
                    {([
                      { step: 1 as Step, label: "1" },
                      { step: 2 as Step, label: "2" },
                      { step: 3 as Step, label: "3" },
                    ]).map((item, index, array) => {
                      const isActive = item.step === currentStep;
                      const isDone = item.step < currentStep;

                      return (
                        <div key={item.step} className="flex items-center gap-3 sm:gap-5">
                          <div
                            className={`grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition ${
                              isDone
                                ? "border-white/20 bg-[#EAEAEA] text-[#0B0F1A]"
                                : isActive
                                  ? "border-white/18 bg-white/[0.12] text-white shadow-[0_0_0_10px_rgba(255,255,255,0.035)]"
                                  : "border-white/10 bg-white/[0.04] text-white/48"
                            }`}
                          >
                            {item.label}
                          </div>
                          {index < array.length - 1 && (
                            <span className="h-px w-10 bg-white/10 sm:w-16" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {currentStep === 1 && (
                    <div className="mx-auto max-w-3xl">
                      <div className="text-center">
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                          <SparkIcon />
                        </span>
                        <h3 className="mt-4 text-xl font-bold text-white">
                          استيراد عدة وصفات من xBloom
                        </h3>
                      </div>

                      <label className="mt-8 block">
                        <span className="mb-3 block text-center text-sm font-bold text-[#EAEAEA]/78">
                          ضع كل رابط في سطر مستقل
                        </span>
                        <textarea
                          value={batchUrls}
                          onChange={(event) => setBatchUrls(event.target.value)}
                          placeholder={"https://share-h5.xbloom.com/?id=...\nhttps://share-h5.xbloom.com/?id=..."}
                          className="min-h-[220px] w-full rounded-[22px] border border-white/10 bg-[#121722] px-5 py-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                        />
                      </label>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                          <LinkIcon />
                        </span>
                        <h3 className="text-xl font-bold text-white">بيانات الوصفات</h3>
                      </div>

                      <div className="mt-6 space-y-4">
                        {batchRecipes.map((recipe, index) => (
                          <div
                            key={recipe.key}
                            className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-white">
                                الوصفة {new Intl.NumberFormat("ar-EG").format(index + 1)}
                              </p>
                              <p className="truncate text-xs font-bold text-white/34">
                                {recipe.url}
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-xs font-bold text-white/58">
                                  <span>اسم الوصفة</span>
                                  <button
                                    type="button"
                                    onClick={() => handleTranslateBatchRecipeName(recipe.key)}
                                    className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-white/[0.11]"
                                  >
                                    ترجمة
                                  </button>
                                </div>
                                <input
                                  value={recipe.name}
                                  onChange={(event) =>
                                    updateBatchRecipe(recipe.key, (current) => ({
                                      ...current,
                                      name: event.target.value,
                                    }))
                                  }
                                  placeholder="اسم الوصفة"
                                  className="h-14 w-full rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                                />
                              </div>
                              <input
                                value={recipe.authorName}
                                onChange={(event) =>
                                  updateBatchRecipe(recipe.key, (current) => ({
                                    ...current,
                                    authorName: event.target.value,
                                  }))
                                }
                                placeholder="اسم الناشر"
                                className="h-14 rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                              />
                              <input
                                value={recipe.grams}
                                onChange={(event) =>
                                  updateBatchRecipe(recipe.key, (current) => ({
                                    ...current,
                                    grams: event.target.value,
                                  }))
                                }
                                placeholder="كمية البن"
                                className="h-14 rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                              />
                              <div className="relative">
                                <select
                                  value={recipe.brewer}
                                  onChange={(event) =>
                                    updateBatchRecipe(recipe.key, (current) => ({
                                      ...current,
                                      brewer: event.target.value,
                                    }))
                                  }
                                  className="ui-select ui-select-dark h-14 w-full rounded-[18px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                                >
                                  {brewerOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                                  <SelectChevron />
                                </span>
                              </div>
                            </div>
                            <input
                              value={recipe.ratioInput}
                              onChange={(event) =>
                                updateBatchRecipe(recipe.key, (current) => ({
                                  ...current,
                                  ratioInput: event.target.value,
                                }))
                              }
                              placeholder="225ML - 1:16"
                              className="mt-4 h-14 w-full rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                          <BeanIcon />
                        </span>
                        <h3 className="text-xl font-bold text-white">تنظيم الوصفات</h3>
                      </div>

                      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                          <p className="mb-3 text-sm font-bold text-[#EAEAEA]/78">
                            تعيين محمصة لجميع الوصفات (اختياري)
                          </p>
                          <div className="relative">
                            <select
                              value={matchedBatchRoaster?.slug ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (!value) {
                                  setBatchRoasterName("");
                                  setBatchRecipes((current) =>
                                    current.map((item) => ({
                                      ...item,
                                      roasterSlug: "",
                                    })),
                                  );
                                  return;
                                }

                                const selectedRoaster =
                                  roasters.find((roaster) => roaster.slug === value) ?? null;
                                setBatchRoasterName(selectedRoaster?.name ?? "");
                                setBatchRecipes((current) =>
                                  current.map((item) => ({
                                    ...item,
                                    roasterSlug: value,
                                  })),
                                );
                              }}
                              className="ui-select ui-select-dark h-14 w-full rounded-[18px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                            >
                              <option value="">بدون محمصة</option>
                              {roasters.map((roaster) => (
                                <option key={roaster.slug} value={roaster.slug}>
                                  {roaster.name}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                              <SelectChevron />
                            </span>
                          </div>
                        </div>

                        <label className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">وصفة معتمدة من المحمصة</p>
                            <p className="mt-1 text-xs font-bold text-white/38">
                              تطبق على كل الوصفات المستوردة
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBatchApproved((current) => !current)}
                            className={`relative h-8 w-14 rounded-full border transition ${
                              batchApproved
                                ? "border-white/20 bg-[#EAEAEA]"
                                : "border-white/10 bg-white/[0.06]"
                            }`}
                            aria-pressed={batchApproved}
                          >
                            <span
                              className={`absolute top-1 h-5 w-5 rounded-full transition ${
                                batchApproved
                                  ? "right-1 bg-[#0B0F1A]"
                                  : "right-8 bg-white/80"
                              }`}
                            />
                          </button>
                        </label>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => applyBatchBrewTypeToAll("hot")}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.08]"
                        >
                          تطبيق حار على الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBatchBrewTypeToAll("cold")}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.08]"
                        >
                          تطبيق بارد على الكل
                        </button>
                      </div>

                      <div className="mt-6 space-y-4">
                        {batchRecipes.map((recipe, index) => (
                          <div
                            key={recipe.key}
                            className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-white">{recipe.name || `وصفة ${index + 1}`}</p>
                              <p className="text-xs font-bold text-white/42">{recipe.authorName || "بدون ناشر"}</p>
                            </div>

                            <div className="relative mt-4">
                              <select
                                value={recipe.roasterSlug}
                                onChange={(event) =>
                                  updateBatchRecipe(recipe.key, (current) => ({
                                    ...current,
                                    roasterSlug: event.target.value,
                                  }))
                                }
                                className="ui-select ui-select-dark h-12 w-full rounded-[16px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                              >
                                <option value="">بدون محمصة</option>
                                {roasters.map((roaster) => (
                                  <option key={roaster.slug} value={roaster.slug}>
                                    {roaster.name}
                                  </option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                                <SelectChevron />
                              </span>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                              <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                  { value: "hot" as const, label: "حار", icon: <FlameIcon /> },
                                  { value: "cold" as const, label: "بارد", icon: <SnowIcon /> },
                                ].map((item) => (
                                  <button
                                    key={item.value}
                                    type="button"
                                    onClick={() =>
                                      updateBatchRecipe(recipe.key, (current) => ({
                                        ...current,
                                        brewType: item.value,
                                        iceGrams: item.value === "cold" ? current.iceGrams : "",
                                      }))
                                    }
                                    className={`flex h-14 items-center justify-between rounded-[18px] border px-4 text-right transition ${
                                      recipe.brewType === item.value
                                        ? "border-white/16 bg-white/[0.08] text-white shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
                                        : "border-white/8 bg-white/[0.025] text-white/62 hover:bg-white/[0.04]"
                                    }`}
                                  >
                                    <span className="text-sm font-bold">{item.label}</span>
                                    <span className="text-white/72">{item.icon}</span>
                                  </button>
                                ))}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-3">
                                  <p className="text-xs font-bold text-white/38">كمية البن</p>
                                  <p className="mt-2 text-sm font-bold text-white">
                                    {recipe.grams} جرام
                                  </p>
                                </div>
                                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-3">
                                  <p className="text-xs font-bold text-white/38">النسبة</p>
                                  <p className="mt-2 text-sm font-bold text-white">
                                    {recipe.ratioInput}
                                  </p>
                                </div>
                                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-3">
                                  <p className="text-xs font-bold text-white/38">الأداة</p>
                                  <p className="mt-2 text-sm font-bold text-white">
                                    {recipe.brewer}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {recipe.brewType === "cold" && (
                              <input
                                value={recipe.iceGrams}
                                onChange={(event) =>
                                  updateBatchRecipe(recipe.key, (current) => ({
                                    ...current,
                                    iceGrams: event.target.value,
                                  }))
                                }
                                placeholder="جرامات الثلج"
                                className="mt-4 h-14 w-full rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
                              />
                            )}

                            {!recipe.brewType && (
                              <p className="mt-3 text-xs font-bold text-[#FFB4B4]">
                                اختر نوع التحضير لهذه الوصفة.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {batchStatusMessage && (
                  <p className={`mt-4 text-sm font-bold ${batchStatusClassName}`}>
                    {batchStatusMessage}
                  </p>
                )}
              </div>

              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0D1016]/92 px-6 py-4 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={closeBatchModal}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/70 transition hover:text-white"
                >
                  إلغاء
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((currentStep - 1) as Step)}
                      className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      السابق
                    </button>
                  )}

                  {currentStep === 1 && (
                    <button
                      type="button"
                      onClick={handleFetchBatchRecipes}
                      disabled={isFetchingBatch}
                      className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-70"
                    >
                      {isFetchingBatch ? "جارٍ استيراد الروابط..." : "استيراد الروابط"}
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      type="button"
                      onClick={goBatchToStepThree}
                      className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105"
                    >
                      التالي
                    </button>
                  )}

                  {currentStep === 3 && (
                    <button
                      type="button"
                      onClick={handleSaveBatch}
                      disabled={isSavingBatch || !canSaveBatch}
                      className="rounded-full border border-white/12 bg-[#EAEAEA] px-6 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {isSavingBatch ? "جارٍ الحفظ..." : "حفظ الوصفات"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBatchDuplicateDialogOpen && (
        <div className="fixed inset-0 z-[171] flex items-center justify-center bg-black/76 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0D1016] p-6 text-[#EAEAEA] shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setIsBatchDuplicateDialogOpen(false)}
                className="text-white/62 transition hover:text-white"
              >
                <CloseIcon />
              </button>
              <div className="text-right">
                <p className="text-[11px] font-bold tracking-[0.18em] text-white/34">
                  روابط مكررة
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  تم العثور على تكرار في الروابط
                </h3>
              </div>
            </div>

            <div className="mt-5 max-h-[44vh] space-y-3 overflow-y-auto pr-1">
              {batchDuplicateEntries.map((entry) => (
                <article
                  key={`${entry.reason}-${entry.key}`}
                  className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        entry.reason === "input-duplicate"
                          ? "border border-[#F6C384]/30 bg-[#F6C384]/14 text-[#FFE5BF]"
                          : "border border-[#8EB4FF]/30 bg-[#8EB4FF]/14 text-[#D4E1FF]"
                      }`}
                    >
                      {entry.reason === "input-duplicate"
                        ? "مكرر داخل الإدخال"
                        : "موجود مسبقًا"}
                    </span>
                    <p className="text-xs font-bold text-white/56">
                      العدد: {new Intl.NumberFormat("ar-EG").format(entry.count)}
                    </p>
                  </div>
                  <p className="mt-2 break-all text-xs font-bold text-white/72">
                    {entry.sampleUrl}
                  </p>
                </article>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-white/48">
              يمكن المتابعة الآن وسيتم حذف الروابط المكررة تلقائيًا واستيراد الروابط الجديدة فقط.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBatchDuplicateDialogOpen(false)}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleContinueBatchAfterDedup();
                }}
                className="rounded-full border border-white/12 bg-[#EAEAEA] px-5 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105"
              >
                استمرار مع إزالة المكرر
              </button>
            </div>
          </div>
        </div>
      )}

      {recipeNameEditTarget && (
        <div className="fixed inset-0 z-[172] flex items-center justify-center bg-black/76 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0D1016] p-6 text-[#EAEAEA] shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={closeRecipeNameEditor}
                disabled={isRecipeNameSaving}
                className="text-white/62 transition hover:text-white disabled:opacity-50"
              >
                <CloseIcon />
              </button>
              <div className="text-right">
                <p className="text-[11px] font-bold tracking-[0.18em] text-white/34">
                  تعديل اسم
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">تعديل اسم الوصفة</h3>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">
                الاسم الجديد
              </span>
              <input
                value={recipeNameEditValue}
                onChange={(event) => setRecipeNameEditValue(event.target.value)}
                className="h-14 w-full rounded-[18px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/18"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeRecipeNameEditor}
                disabled={isRecipeNameSaving}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveRecipeName();
                }}
                disabled={isRecipeNameSaving}
                className="rounded-full border border-white/12 bg-[#EAEAEA] px-5 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-60"
              >
                {isRecipeNameSaving ? "جارٍ الحفظ..." : "حفظ الاسم"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkEditOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/74 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0D1016] p-6 text-[#EAEAEA] shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => {
                  if (!isBulkEditing) {
                    setIsBulkEditOpen(false);
                  }
                }}
                className="text-white/62 transition hover:text-white disabled:opacity-50"
                disabled={isBulkEditing}
              >
                <CloseIcon />
              </button>
              <div className="text-right">
                <p className="text-[11px] font-bold tracking-[0.18em] text-white/34">
                  تعديل جماعي
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">تعديل الوصفات المحددة</h3>
                <p className="mt-2 text-xs font-bold text-white/48">
                  عدد الوصفات المحددة: {selectedRecipeSlugs.length}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white/74">المحمصة</span>
                <select
                  value={bulkEditRoasterMode}
                  onChange={(event) =>
                    setBulkEditRoasterMode(
                      event.target.value as "keep" | "set" | "clear",
                    )
                  }
                  className="ui-select ui-select-dark h-12 w-full rounded-[16px] border border-white/12 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                >
                  <option value="keep">بدون تغيير</option>
                  <option value="set">تعيين محمصة</option>
                  <option value="clear">إزالة المحمصة</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white/74">نوع التحضير</span>
                <select
                  value={bulkEditBrewType}
                  onChange={(event) =>
                    setBulkEditBrewType(event.target.value as "keep" | "hot" | "cold")
                  }
                  className="ui-select ui-select-dark h-12 w-full rounded-[16px] border border-white/12 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                >
                  <option value="keep">بدون تغيير</option>
                  <option value="hot">حار</option>
                  <option value="cold">بارد</option>
                </select>
              </label>

              {bulkEditRoasterMode === "set" && (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-white/74">اختر المحمصة</span>
                  <select
                    value={bulkEditRoasterSlug}
                    onChange={(event) => setBulkEditRoasterSlug(event.target.value)}
                    className="ui-select ui-select-dark h-12 w-full rounded-[16px] border border-white/12 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                  >
                    <option value="">اختر محمصة</option>
                    {roasters.map((roaster) => (
                      <option key={roaster.slug} value={roaster.slug}>
                        {roaster.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {bulkEditBrewType === "cold" && (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-white/74">جرامات الثلج</span>
                  <input
                    value={bulkEditIceGrams}
                    onChange={(event) => setBulkEditIceGrams(event.target.value)}
                    placeholder="170"
                    className="h-12 w-full rounded-[16px] border border-white/10 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/20"
                  />
                </label>
              )}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-white/74">
                  وصفة معتمدة من المحمصة
                </span>
                <select
                  value={bulkEditApproval}
                  onChange={(event) =>
                    setBulkEditApproval(
                      event.target.value as "keep" | "approved" | "not-approved",
                    )
                  }
                  className="ui-select ui-select-dark h-12 w-full rounded-[16px] border border-white/12 bg-[#121722] px-4 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                >
                  <option value="keep">بدون تغيير</option>
                  <option value="approved">تفعيل الاعتماد</option>
                  <option value="not-approved">إلغاء الاعتماد</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                disabled={isBulkEditing}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/74 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleBulkEdit}
                disabled={isBulkEditing}
                className="rounded-full border border-white/12 bg-[#EAEAEA] px-5 py-3 text-sm font-bold text-[#080D16] transition hover:brightness-105 disabled:opacity-60"
              >
                {isBulkEditing ? "جارٍ تعديل المحدد..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={isBulkDeleteOpen}
        title="حذف الوصفات المحددة؟"
        description={`سيتم حذف ${selectedRecipeSlugs.length} وصفة نهائيًا من لوحة الإدارة.`}
        confirmLabel="حذف المحدد"
        cancelLabel="إلغاء"
        isLoading={isBulkDeleting}
        onCancel={() => {
          if (!isBulkDeleting) {
            setIsBulkDeleteOpen(false);
          }
        }}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />

      <ConfirmDialog
        open={!!recipePendingDelete}
        title="حذف الوصفة؟"
        description={
          recipePendingDelete
            ? `سيتم حذف وصفة ${recipePendingDelete.name} نهائيًا من لوحة الإدارة.`
            : ""
        }
        confirmLabel="حذف الوصفة"
        cancelLabel="إلغاء"
        isLoading={false}
        onCancel={() => setRecipePendingDelete(null)}
        onConfirm={() => {
          if (recipePendingDelete) {
            void handleDelete(recipePendingDelete.slug);
          }
        }}
      />
    </>
  );
}
