"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Roaster } from "@/lib/data";
import {
  MISC_RECIPES_LABEL,
  isMiscRecipesName,
  isMiscRecipesSlug,
} from "@/lib/misc-recipes-roaster";
import type { ManagedPourStep } from "@/lib/recipes-db";

type GuestRecipeEntryProps = {
  roasters: Roaster[];
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

const brewerOptions = ["Omni", "Other", "xBloom", "V60", "Chemex", "Espresso"];

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

export function GuestRecipeEntry({ roasters }: GuestRecipeEntryProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingXbloom, setIsFetchingXbloom] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [publicMessage, setPublicMessage] = useState("");
  const [xbloomUrl, setXbloomUrl] = useState("");
  const [name, setName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [grams, setGrams] = useState("15");
  const [iceGrams, setIceGrams] = useState("");
  const [pourCount, setPourCount] = useState("");
  const [firstPourTemperature, setFirstPourTemperature] = useState("");
  const [pourSteps, setPourSteps] = useState<ManagedPourStep[]>([]);
  const [brewer, setBrewer] = useState("Omni");
  const [ratioInput, setRatioInput] = useState("225ML - 1:16");
  const [roasterSlug, setRoasterSlug] = useState("");
  const [brewType, setBrewType] = useState<AdminBrewType>("");

  const selectableRoasters = useMemo(
    () =>
      roasters.filter(
        (roaster) =>
          !isMiscRecipesSlug(roaster.slug) &&
          !isMiscRecipesName(roaster.name) &&
          !isMiscRecipesName(roaster.shortName),
      ),
    [roasters],
  );
  const matchedRoaster = useMemo(
    () => selectableRoasters.find((roaster) => roaster.slug === roasterSlug) ?? null,
    [roasterSlug, selectableRoasters],
  );

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

  const statusClassName =
    statusTone === "error"
      ? "text-[#FFB4B4]"
      : statusTone === "success"
        ? "text-[#B8F5E6]"
        : "text-[#EAEAEA]/60";

  const setStatus = (message: string, tone: StatusTone = "neutral") => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const resetForm = () => {
    setCurrentStep(1);
    setStatusMessage("");
    setStatusTone("neutral");
    setXbloomUrl("");
    setName("");
    setAuthorName("");
    setGrams("15");
    setIceGrams("");
    setPourCount("");
    setFirstPourTemperature("");
    setPourSteps([]);
    setBrewer("Omni");
    setRatioInput("225ML - 1:16");
    setRoasterSlug("");
    setBrewType("");
  };

  const openModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSaving || isFetchingXbloom) {
      return;
    }
    setIsOpen(false);
  };

  const buildRatioInput = (payload: XbloomPayload) => {
    const waterPart = payload.waterMl ? `${payload.waterMl}ML` : "";
    const ratioPart = payload.ratio ?? "";
    return [waterPart, ratioPart].filter(Boolean).join(" - ");
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

  const handleFetchFromXbloom = async () => {
    if (!xbloomUrl.trim()) {
      setStatus("أضف رابط xBloom أولاً.", "error");
      return;
    }

    setIsFetchingXbloom(true);
    setStatus("");

    try {
      const payload = await fetchXbloomRecipe(xbloomUrl.trim());

      if (payload.name) {
        setName(payload.name);
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
        error instanceof Error ? error.message : "حدث خطأ أثناء جلب بيانات xBloom.",
        "error",
      );
    } finally {
      setIsFetchingXbloom(false);
    }
  };

  const goToStepThree = () => {
    if (!canContinueStepTwo) {
      setStatus("تأكد من الاسم واسم الناشر وكمية البن والأداة والنسبة أولًا.", "error");
      return;
    }

    setCurrentStep(3);
    setStatus("");
  };

  const handleSave = async () => {
    if (!canSave) {
      setStatus("أكمل البيانات المطلوبة قبل حفظ الوصفة.", "error");
      return;
    }

    setIsSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/recipe-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          authorName,
          isRoasterApproved: false,
          grams: Number(grams),
          iceGrams: requiresIce ? Number(iceGrams) : null,
          pourCount: pourCount ? Number(pourCount) : null,
          firstPourTemperature: firstPourTemperature ? Number(firstPourTemperature) : null,
          pourSteps,
          brewer,
          ratioInput,
          roasterSlug: matchedRoaster?.slug ?? null,
          roasterName: matchedRoaster?.name ?? MISC_RECIPES_LABEL,
          brewType,
          xbloomUrl,
        }),
      });

      const payload =
        (await readJsonSafely<{ message?: string; slug?: string; recipeUrl?: string }>(response)) ?? {
          message: "الرد من الخادم غير مكتمل.",
        };
      if (!response.ok) {
        throw new Error(payload.message || "تعذر إرسال الوصفة.");
      }

      const createdSlug =
        typeof payload.slug === "string" && payload.slug.trim()
          ? payload.slug.trim()
          : null;
      if (createdSlug) {
        const params = new URLSearchParams({
          slug: createdSlug,
          from: "guest",
        });
        setIsOpen(false);
        resetForm();
        router.push(`/recipes/success?${params.toString()}`);
        return;
      }

      router.refresh();
      setIsOpen(false);
      resetForm();
      setPublicMessage(payload.message || "تم إرسال وصفتك بنجاح.");
      setTimeout(() => setPublicMessage(""), 3500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "حدث خطأ أثناء إضافة الوصفة.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-5 left-5 z-[115] sm:bottom-7 sm:left-7">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-[var(--page-surface)] px-4 py-3 text-sm font-bold text-[var(--page-fg)] shadow-[0_14px_46px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:brightness-105"
        >
          <PlusIcon />
          <span>إضافة وصفة</span>
        </button>
        {publicMessage ? (
          <p className="mt-2 text-xs font-bold text-[#B8F5E6]">{publicMessage}</p>
        ) : null}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#05070D]/84 p-4 backdrop-blur-md">
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
                    {([1, 2, 3] as const).map((step, index, array) => {
                      const isActive = step === currentStep;
                      const isDone = step < currentStep;
                      return (
                        <div key={step} className="flex items-center gap-3 sm:gap-5">
                          <div
                            className={`grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition ${
                              isDone
                                ? "border-white/20 bg-[#EAEAEA] text-[#0B0F1A]"
                                : isActive
                                  ? "border-white/18 bg-white/[0.12] text-white shadow-[0_0_0_10px_rgba(255,255,255,0.035)]"
                                  : "border-white/10 bg-white/[0.04] text-white/48"
                            }`}
                          >
                            {step}
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
                        <h3 className="mt-4 text-xl font-bold text-white">استيراد بيانات الوصفة من xBloom</h3>
                      </div>

                      <label className="mt-8 block">
                        <span className="mb-3 block text-center text-sm font-bold text-[#EAEAEA]/78">ألصق الرابط</span>
                        <input
                          value={xbloomUrl}
                          onChange={(event) => setXbloomUrl(event.target.value)}
                          placeholder="https://share-h5.xbloom.com/?id=..."
                          className="h-[60px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white outline-none transition focus:border-white/18 focus:bg-white/[0.055]"
                        />
                      </label>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div>
                      <h3 className="text-xl font-bold text-white">بيانات الوصفة</h3>
                      <div className="mt-8 grid gap-5 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">اسم الوصفة</span>
                          <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">اسم الناشر</span>
                          <input
                            value={authorName}
                            onChange={(event) => setAuthorName(event.target.value)}
                            className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">كمية البن</span>
                          <input
                            value={grams}
                            onChange={(event) => setGrams(event.target.value)}
                            className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">الأداة</span>
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
                        <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">النسبة وكمية الماء</span>
                        <input
                          value={ratioInput}
                          onChange={(event) => setRatioInput(event.target.value)}
                          placeholder="225ML - 1:16"
                          className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                        />
                      </label>

                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">عدد الصبات</span>
                          <input
                            value={pourCount}
                            onChange={(event) => setPourCount(event.target.value)}
                            className="h-14 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none transition focus:border-white/18"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">درجة الحرارة</span>
                          <input
                            value={firstPourTemperature}
                            onChange={(event) => setFirstPourTemperature(event.target.value)}
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
                        <h3 className="text-xl font-bold text-white">بيانات إضافية للوصفة</h3>
                      </div>

                      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.88fr]">
                        <label className="block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">اختر محمصة</span>
                          <div className="relative">
                            <select
                              value={roasterSlug}
                              onChange={(event) => setRoasterSlug(event.target.value)}
                              className="ui-select ui-select-dark h-14 w-full rounded-[18px] border border-white/12 bg-[#121722] px-4 pr-4 pl-10 text-sm font-bold text-[#EAEAEA] outline-none transition focus:border-white/22"
                            >
                              <option value="">{MISC_RECIPES_LABEL}</option>
                              {selectableRoasters.map((roaster) => (
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
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">نوع التحضير</span>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              { value: "hot" as const, label: "حار", icon: <FlameIcon /> },
                              { value: "cold" as const, label: "بارد", icon: <SnowIcon /> },
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
                        </div>
                      </div>

                      {requiresIce && (
                        <label className="mt-5 block">
                          <span className="mb-3 block text-sm font-bold text-[#EAEAEA]/78">جرامات الثلج</span>
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

                  {statusMessage && <p className={`mt-4 text-sm font-bold ${statusClassName}`}>{statusMessage}</p>}
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
                        {isFetchingXbloom ? "جارٍ استيراد البيانات..." : "استيراد بيانات الوصفة من xBloom"}
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
        </div>
      )}
    </>
  );
}
