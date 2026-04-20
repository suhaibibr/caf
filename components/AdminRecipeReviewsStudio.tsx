"use client";

import { useMemo, useState } from "react";
import { MISC_RECIPES_LABEL } from "@/lib/misc-recipes-roaster";

type Submission = {
  id: number;
  name: string;
  authorName: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: Array<{
    name: string;
    volumeMl: number | null;
    temperatureC: number | null;
    seconds: number | null;
  }>;
  brewer: string;
  ratioInput: string;
  roasterSlug: string | null;
  roasterName: string | null;
  brewType: "hot" | "cold";
  xbloomUrl: string;
  submitterIp: string;
  status: "pending" | "approved" | "reviewed" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
};

type AdminRecipeReviewsStudioProps = {
  initialSubmissions: Submission[];
};

type ApiPayload = {
  message?: string;
  affected?: number;
  deletedRecipes?: number;
};

type EditDraft = {
  id: number;
  name: string;
  authorName: string;
  grams: string;
  ratioInput: string;
  brewer: string;
  brewType: "hot" | "cold";
  iceGrams: string;
  roasterName: string;
  xbloomUrl: string;
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

function toDraft(submission: Submission): EditDraft {
  return {
    id: submission.id,
    name: submission.name,
    authorName: submission.authorName,
    grams: String(submission.grams),
    ratioInput: submission.ratioInput,
    brewer: submission.brewer,
    brewType: submission.brewType,
    iceGrams: submission.iceGrams ? String(submission.iceGrams) : "",
    roasterName: submission.roasterName ?? "",
    xbloomUrl: submission.xbloomUrl,
  };
}

export function AdminRecipeReviewsStudio({ initialSubmissions }: AdminRecipeReviewsStudioProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [editing, setEditing] = useState<EditDraft | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    submissions.length > 0 && submissions.every((submission) => selectedSet.has(submission.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(submissions.map((submission) => submission.id));
  };

  const removeIdsLocally = (ids: number[]) => {
    const removeSet = new Set(ids);
    setSubmissions((current) => current.filter((item) => !removeSet.has(item.id)));
    setSelectedIds((current) => current.filter((id) => !removeSet.has(id)));
  };

  const runBulkAction = async (action: "mark-reviewed" | "delete", ids: number[]) => {
    if (ids.length === 0) {
      setStatusMessage("حدد وصفة واحدة على الأقل.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/recipe-submissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ids,
        }),
      });

      const payload = (await readJsonSafely<ApiPayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر تنفيذ العملية.");
      }

      removeIdsLocally(ids);
      if (action === "delete") {
        const deletedRecipes = Number(payload.deletedRecipes ?? 0);
        setStatusMessage(
          deletedRecipes > 0
            ? `تم حذف ${deletedRecipes} وصفة نهائيًا من الموقع.`
            : "تم حذف السجلات المحددة. لم يتم العثور على وصفات منشورة مطابقة.",
        );
      } else {
        setStatusMessage("تمت مراجعة الوصفات المحددة.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء التنفيذ.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/admin/recipe-submissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          ids: [editing.id],
          payload: {
            name: editing.name,
            authorName: editing.authorName,
            grams: Number(editing.grams),
            ratioInput: editing.ratioInput,
            brewer: editing.brewer,
            brewType: editing.brewType,
            iceGrams: editing.brewType === "cold" ? Number(editing.iceGrams || 0) : null,
            roasterName: editing.roasterName || MISC_RECIPES_LABEL,
            roasterSlug: null,
            xbloomUrl: editing.xbloomUrl,
          },
        }),
      });
      const payload = (await readJsonSafely<ApiPayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر حفظ التعديل.");
      }

      setSubmissions((current) =>
        current.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                name: editing.name,
                authorName: editing.authorName,
                grams: Number(editing.grams),
                ratioInput: editing.ratioInput,
                brewer: editing.brewer,
                brewType: editing.brewType,
                iceGrams: editing.brewType === "cold" ? Number(editing.iceGrams || 0) : null,
                roasterName: editing.roasterName || MISC_RECIPES_LABEL,
                xbloomUrl: editing.xbloomUrl,
              }
            : item,
        ),
      );
      setEditing(null);
      setStatusMessage("تم حفظ التعديل.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء الحفظ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 accent-black dark:accent-white"
          />
          <p className="text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">
            تحديد الكل ({submissions.length})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void runBulkAction("mark-reviewed", selectedIds);
            }}
            disabled={isLoading}
            className="rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white disabled:opacity-60 dark:border-white/10 dark:hover:bg-white dark:hover:text-[#0B0F1A]"
          >
            تعليم كمراجعة
          </button>
          <button
            type="button"
            onClick={() => {
              void runBulkAction("delete", selectedIds);
            }}
            disabled={isLoading}
            className="rounded-[12px] border border-[#D96C6C]/24 px-3 py-2 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white disabled:opacity-60 dark:border-[#F18A8A]/20 dark:text-[#F1A4A4]"
          >
            حذف نهائي من الموقع
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">{statusMessage}</p>
      ) : null}

      <div className="mt-5 space-y-3">
        {submissions.map((submission) => (
          <article
            key={submission.id}
            className="rounded-[16px] border border-black/10 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedSet.has(submission.id)}
                  onChange={() => toggleSelect(submission.id)}
                  className="mt-1 h-4 w-4 accent-black dark:accent-white"
                />
                <div>
                  <p className="font-bold">{submission.name}</p>
                  <p className="mt-1 text-xs text-black/45 dark:text-[#EAEAEA]/45">
                    {submission.authorName} · {submission.brewer} · {submission.ratioInput}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(toDraft(submission))}
                  className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:hover:bg-white dark:hover:text-[#0B0F1A]"
                >
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void runBulkAction("delete", [submission.id]);
                  }}
                  className="rounded-[10px] border border-[#D96C6C]/24 px-3 py-1.5 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white dark:border-[#F18A8A]/20 dark:text-[#F1A4A4]"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-black/10 bg-[#F8F8F5] p-4 text-center text-sm font-bold text-black/55 dark:border-white/10 dark:bg-[#101623] dark:text-[#EAEAEA]/55">
          لا توجد وصفات جديدة بانتظار المراجعة.
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[175] flex items-center justify-center bg-black/72 p-4">
          <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-[#0D1016] p-6 text-[#EAEAEA]">
            <h3 className="text-2xl font-bold">تعديل وصفة من سجل المراجعة</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-white/56">اسم الوصفة</span>
                <input
                  value={editing.name}
                  onChange={(event) =>
                    setEditing((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-white/56">اسم الناشر</span>
                <input
                  value={editing.authorName}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, authorName: event.target.value } : current,
                    )
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-white/56">كمية البن</span>
                <input
                  value={editing.grams}
                  onChange={(event) =>
                    setEditing((current) => (current ? { ...current, grams: event.target.value } : current))
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-white/56">النسبة</span>
                <input
                  value={editing.ratioInput}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, ratioInput: event.target.value } : current,
                    )
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-white/56">نوع التحضير</span>
                <select
                  value={editing.brewType}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? { ...current, brewType: event.target.value as "hot" | "cold" }
                        : current,
                    )
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                >
                  <option value="hot">حار</option>
                  <option value="cold">بارد</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-white/56">جرامات الثلج</span>
                <input
                  value={editing.iceGrams}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, iceGrams: event.target.value } : current,
                    )
                  }
                  className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-bold text-white/56">رابط xBloom</span>
              <input
                value={editing.xbloomUrl}
                onChange={(event) =>
                  setEditing((current) =>
                    current ? { ...current, xbloomUrl: event.target.value } : current,
                  )
                }
                className="mt-2 h-11 w-full rounded-[12px] border border-white/10 bg-[#121722] px-3 text-sm font-bold outline-none"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-[12px] border border-white/12 px-4 py-2 text-sm font-bold text-white/72 transition hover:bg-white/[0.08] hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveEdit();
                }}
                className="rounded-[12px] border border-white/12 bg-[#EAEAEA] px-4 py-2 text-sm font-bold text-[#080D16] transition hover:brightness-105"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
