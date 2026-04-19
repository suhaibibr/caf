"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminChangePasswordFormProps = {
  nextPath: string;
};

type ApiPayload = {
  message?: string;
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

export function AdminChangePasswordForm({ nextPath }: AdminChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = (await readJsonSafely<ApiPayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر تغيير كلمة المرور.");
      }

      setIsError(false);
      setMessage("تم تغيير كلمة المرور بنجاح.");
      setTimeout(() => {
        router.replace(nextPath || "/admin");
        router.refresh();
      }, 500);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
      <label className="block">
        <span className="text-sm font-bold text-white/72">كلمة المرور الحالية</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          className="mt-2 h-12 w-full rounded-[14px] border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white outline-none transition focus:border-white/24"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-white/72">كلمة المرور الجديدة</span>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          className="mt-2 h-12 w-full rounded-[14px] border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white outline-none transition focus:border-white/24"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-white/72">تأكيد كلمة المرور</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          className="mt-2 h-12 w-full rounded-[14px] border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white outline-none transition focus:border-white/24"
        />
      </label>

      {message ? (
        <p className={`text-sm font-bold ${isError ? "text-[#FFB4B4]" : "text-[#B8F5E6]"}`}>
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-1 h-12 rounded-[14px] border border-white/12 bg-white text-sm font-bold text-[#0B0F1A] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
      </button>
    </form>
  );
}

