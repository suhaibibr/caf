"use client";

import { useMemo, useState } from "react";

type AdminAccountItem = {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isCurrentUser?: boolean;
};

type AdminAccountsStudioProps = {
  initialAdmins: AdminAccountItem[];
  currentAdminId: number;
};

type ApiPayload = {
  message?: string;
  generatedPassword?: string;
  admin?: AdminAccountItem | null;
  admins?: AdminAccountItem[];
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

export function AdminAccountsStudio({ initialAdmins, currentAdminId }: AdminAccountsStudioProps) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");

  const sortedAdmins = useMemo(
    () => [...admins].sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin)),
    [admins],
  );

  const handleCreate = async () => {
    setStatusMessage("");
    setGeneratedPassword("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatusMessage("أدخل البريد الإلكتروني أولًا.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await readJsonSafely<ApiPayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر إنشاء الحساب.");
      }

      if (payload.admin) {
        setAdmins((current) => [payload.admin as AdminAccountItem, ...current]);
      }
      setGeneratedPassword(payload.generatedPassword || "");
      setStatusMessage(payload.message || "تم إنشاء الحساب.");
      setEmail("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء الإنشاء.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (admin: AdminAccountItem) => {
    if (!window.confirm(`تأكيد حذف الحساب الإداري ${admin.email}؟`)) {
      return;
    }

    setStatusMessage("");
    setIsDeleting(admin.id);
    try {
      const response = await fetch(`/api/admin/accounts/${admin.id}`, {
        method: "DELETE",
      });
      const payload = (await readJsonSafely<ApiPayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر حذف الحساب.");
      }

      setAdmins((current) => current.filter((item) => item.id !== admin.id));
      setStatusMessage("تم حذف الحساب الإداري.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء الحذف.");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <section className="mt-6 grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">إنشاء حساب</p>
        <h2 className="mt-1 text-2xl font-bold">إضافة حساب إداري</h2>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">
              البريد الإلكتروني
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@domain.com"
              className="mt-2 h-12 w-full rounded-[16px] border border-black/8 bg-[#F8F8F5] px-4 text-sm font-bold outline-none transition focus:border-black/22 dark:border-white/10 dark:bg-[#101623] dark:focus:border-[#EAEAEA]/28"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              void handleCreate();
            }}
            disabled={isCreating}
            className="rounded-[16px] bg-black px-5 py-3 text-sm font-bold text-white dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
          >
            {isCreating ? "جارٍ الإنشاء..." : "إنشاء حساب إداري"}
          </button>

          {generatedPassword ? (
            <div className="rounded-[14px] border border-black/10 bg-[#F8F8F5] p-3 dark:border-white/10 dark:bg-[#101623]">
              <p className="text-xs font-bold text-black/45 dark:text-[#EAEAEA]/45">
                كلمة المرور المؤقتة (انسخها الآن، لن تظهر مرة أخرى):
              </p>
              <p className="mt-2 break-all font-mono text-sm font-bold">{generatedPassword}</p>
            </div>
          ) : null}

          {statusMessage ? (
            <p className="text-sm font-bold text-black/55 dark:text-[#EAEAEA]/55">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">الحسابات</p>
        <h2 className="mt-1 text-2xl font-bold">الإدارة</h2>

        <div className="mt-5 space-y-3">
          {sortedAdmins.map((admin) => (
            <article
              key={admin.id}
              className="rounded-[16px] border border-black/10 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{admin.email}</p>
                  <p className="mt-1 text-xs text-black/45 dark:text-[#EAEAEA]/45">
                    {admin.isSuperAdmin ? "صلاحية عليا" : "إداري عادي"}{" "}
                    {admin.mustChangePassword ? "· تغيير كلمة مرور إجباري" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {admin.id === currentAdminId ? (
                    <span className="rounded-[10px] border border-black/10 px-3 py-1.5 text-xs font-bold dark:border-white/10">
                      حسابك الحالي
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(admin);
                      }}
                      disabled={isDeleting === admin.id}
                      className="rounded-[10px] border border-[#D96C6C]/24 px-3 py-1.5 text-xs font-bold text-[#A94848] transition hover:bg-[#A94848] hover:text-white disabled:opacity-60 dark:border-[#F18A8A]/20 dark:text-[#F1A4A4]"
                    >
                      {isDeleting === admin.id ? "جارٍ الحذف..." : "حذف"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
