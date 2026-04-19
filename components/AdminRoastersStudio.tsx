"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  announceRoastersUpdated,
} from "@/lib/admin-roasters-storage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Roaster } from "@/lib/data";

type AdminRoastersStudioProps = {
  initialRoasters: Roaster[];
};

const ADMIN_ROASTERS_PER_PAGE = 24;

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

export function AdminRoastersStudio({
  initialRoasters,
}: AdminRoastersStudioProps) {
  const router = useRouter();
  const [roasters, setRoasters] = useState<Roaster[]>(initialRoasters);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [roasterPendingDelete, setRoasterPendingDelete] = useState<Roaster | null>(null);
  const [roastersPage, setRoastersPage] = useState(1);
  const [roasterSearchQuery, setRoasterSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewImage = uploadedImage || imageUrl.trim();
  const editingRoaster = useMemo(
    () => roasters.find((roaster) => roaster.slug === editingSlug),
    [editingSlug, roasters],
  );
  const filteredRoasters = useMemo(() => {
    const query = roasterSearchQuery.trim().toLowerCase();
    if (!query) {
      return roasters;
    }

    return roasters.filter((roaster) =>
      roaster.name.toLowerCase().includes(query),
    );
  }, [roasterSearchQuery, roasters]);
  const totalRoasterPages = Math.max(
    1,
    Math.ceil(filteredRoasters.length / ADMIN_ROASTERS_PER_PAGE),
  );
  const currentRoastersPage = Math.min(roastersPage, totalRoasterPages);
  const paginatedRoasters = useMemo(() => {
    const start = (currentRoastersPage - 1) * ADMIN_ROASTERS_PER_PAGE;
    return filteredRoasters.slice(start, start + ADMIN_ROASTERS_PER_PAGE);
  }, [currentRoastersPage, filteredRoasters]);

  const resetForm = () => {
    setName("");
    setImageUrl("");
    setUploadedImage("");
    setEditingSlug(null);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setUploadedImage(result);
      setStatusMessage("تم تحميل الصورة بنجاح.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const finalImage = uploadedImage || imageUrl.trim();

    if (!trimmedName || !finalImage) {
      setStatusMessage("أضف اسم المحمصة والصورة أولاً.");
      return;
    }

    setIsSaving(true);

    try {
      if (editingRoaster) {
        const response = await fetch(`/api/roasters/${editingRoaster.slug}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            image: finalImage,
          }),
        });

        if (!response.ok) {
          throw new Error("تعذر تحديث المحمصة.");
        }

        const updated = await readJsonSafely<Roaster>(response);
        if (!updated) {
          throw new Error("الرد من الخادم غير مكتمل.");
        }
        setRoasters((current) =>
          current.map((roaster) =>
            roaster.slug === updated.slug ? updated : roaster,
          ),
        );
        setStatusMessage("تم تحديث المحمصة.");
      } else {
        const response = await fetch("/api/roasters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            image: finalImage,
          }),
        });

        if (!response.ok) {
          throw new Error("تعذر إضافة المحمصة.");
        }

        const created = await readJsonSafely<Roaster>(response);
        if (!created) {
          throw new Error("الرد من الخادم غير مكتمل.");
        }
        setRoasters((current) => [created, ...current]);
        setStatusMessage("تمت إضافة محمصة جديدة.");
      }

      announceRoastersUpdated();
      router.refresh();
      resetForm();
    } catch {
      setStatusMessage("حدث خطأ أثناء حفظ المحمصة.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (roaster: Roaster) => {
    setEditingSlug(roaster.slug);
    setName(roaster.name);
    setImageUrl(roaster.coverImage.startsWith("data:") ? "" : roaster.coverImage);
    setUploadedImage(roaster.coverImage.startsWith("data:") ? roaster.coverImage : "");
    setStatusMessage(`تعديل ${roaster.name}`);
  };

  const handleDelete = async (roaster: Roaster) => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/roasters/${roaster.slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("تعذر حذف المحمصة.");
      }

      setRoasters((current) =>
        current.filter((currentRoaster) => currentRoaster.slug !== roaster.slug),
      );

      if (editingSlug === roaster.slug) {
        resetForm();
      }

      announceRoastersUpdated();
      router.refresh();
      setStatusMessage(`تم حذف ${roaster.name}.`);
      setRoasterPendingDelete(null);
    } catch {
      setStatusMessage("حدث خطأ أثناء حذف المحمصة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section className="mt-6 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
              المحامص
            </p>
            <h2 className="mt-1 text-2xl font-bold">إدارة المحامص</h2>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-[14px] border border-black/10 px-4 py-2 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white/12 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
          >
            إضافة محمصة
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
            بحث المحامص
          </p>
          <input
            value={roasterSearchQuery}
            onChange={(event) => {
              setRoasterSearchQuery(event.target.value);
              setRoastersPage(1);
            }}
            placeholder="ابحث عن محمصة..."
            className="h-11 w-full rounded-[14px] border border-black/10 bg-[#F8F8F5] px-4 text-sm font-bold text-black/78 outline-none transition focus:border-black/22 dark:border-white/10 dark:bg-[#101623] dark:text-[#EAEAEA] dark:focus:border-[#EAEAEA]/28"
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {paginatedRoasters.map((roaster) => (
            <article
              key={roaster.slug}
              className="group overflow-hidden rounded-[20px] border border-black/8 bg-[#F8F8F5] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#101623]"
            >
              <div className="relative h-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={roaster.coverImage}
                  alt={roaster.name}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/56 to-transparent" />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold">{roaster.name}</h3>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(roaster)}
                    disabled={isSaving}
                    className="rounded-[12px] border border-black/8 px-3 py-2 text-xs font-bold text-black/55 transition hover:bg-black hover:text-white dark:border-white/10 dark:text-[#EAEAEA]/55 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoasterPendingDelete(roaster)}
                    disabled={isSaving}
                    className="rounded-[12px] border border-[#D96C6C]/24 px-3 py-2 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white dark:border-[#F18A8A]/20 dark:text-[#F1A4A4] dark:hover:bg-[#D96C6C] dark:hover:text-[#0B0F1A]"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {paginatedRoasters.length === 0 && (
          <div className="mt-4 rounded-[16px] border border-black/8 bg-black/[0.03] px-4 py-4 text-center text-sm font-bold text-black/55 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#EAEAEA]/55">
            لا توجد محامص تطابق البحث.
          </div>
        )}

        {filteredRoasters.length > ADMIN_ROASTERS_PER_PAGE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-black/8 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-bold text-black/55 dark:text-[#EAEAEA]/55">
              صفحة {new Intl.NumberFormat("ar-EG").format(currentRoastersPage)} من{" "}
              {new Intl.NumberFormat("ar-EG").format(totalRoasterPages)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoastersPage(Math.max(1, currentRoastersPage - 1))}
                disabled={currentRoastersPage <= 1}
                className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={() => setRoastersPage(Math.min(totalRoasterPages, currentRoastersPage + 1))}
                disabled={currentRoastersPage >= totalRoasterPages}
                className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-[#EAEAEA] dark:hover:bg-white dark:hover:text-[#0B0F1A]"
              >
                التالي
              </button>
            </div>
          </div>
        )}
        </div>

        <div className="h-fit self-start rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
          إضافة / تعديل
        </p>
        <h2 className="mt-1 text-2xl font-bold">
          {editingRoaster ? "تعديل المحمصة" : "إضافة محمصة"}
        </h2>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">
              اسم المحمصة
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              className="mt-2 h-12 w-full rounded-[16px] border border-black/8 bg-[#F8F8F5] px-4 text-sm font-bold outline-none transition focus:border-black/22 dark:border-white/10 dark:bg-[#101623] dark:focus:border-[#EAEAEA]/28"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">
              رابط الصورة
            </span>
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              disabled={isSaving}
              placeholder="https://..."
              className="mt-2 h-12 w-full rounded-[16px] border border-black/8 bg-[#F8F8F5] px-4 text-sm font-bold outline-none transition focus:border-black/22 dark:border-white/10 dark:bg-[#101623] dark:focus:border-[#EAEAEA]/28"
            />
          </label>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
            className="rounded-[20px] border border-dashed border-black/16 bg-[#F8F8F5] p-6 text-center dark:border-white/18 dark:bg-[#101623]"
          >
            <p className="font-bold">اسحب الصورة هنا</p>
            <p className="mt-2 text-sm text-black/42 dark:text-[#EAEAEA]/42">
              أو اختر صورة من جهازك.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="mt-4 rounded-[14px] border border-black/10 px-4 py-2 text-sm font-bold dark:border-white/12"
            >
              اختيار صورة
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>

          {previewImage && (
            <div className="relative h-40 overflow-hidden rounded-[18px] border border-black/8 dark:border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="معاينة صورة المحمصة"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {statusMessage && (
            <p className="text-sm font-bold text-black/48 dark:text-[#EAEAEA]/48">
              {statusMessage}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-[16px] bg-black px-5 py-3 text-sm font-bold text-white dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
            >
              {isSaving
                ? "جارٍ الحفظ..."
                : editingRoaster
                  ? "حفظ التعديل"
                  : "إضافة المحمصة"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSaving}
              className="rounded-[16px] border border-black/10 px-5 py-3 text-sm font-bold dark:border-white/12"
            >
              إلغاء
            </button>
          </div>
        </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!roasterPendingDelete}
        title="حذف المحمصة؟"
        description={
          roasterPendingDelete
            ? `سيتم حذف ${roasterPendingDelete.name} من قائمة المحامص.`
            : ""
        }
        confirmLabel="حذف المحمصة"
        cancelLabel="إلغاء"
        isLoading={isSaving}
        onCancel={() => {
          if (!isSaving) {
            setRoasterPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (roasterPendingDelete) {
            void handleDelete(roasterPendingDelete);
          }
        }}
      />
    </>
  );
}
