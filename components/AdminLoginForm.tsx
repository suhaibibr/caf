"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AdminLoginFormProps = {
  nextPath: string;
};

type LoginResponsePayload = {
  message?: string;
  redirectTo?: string;
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

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const destination = useMemo(() => {
    if (!nextPath || !nextPath.startsWith("/")) {
      return "/admin";
    }
    return nextPath;
  }, [nextPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe,
          nextPath: destination,
        }),
      });

      const payload =
        (await readJsonSafely<LoginResponsePayload>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر تسجيل الدخول.");
      }

      router.replace(payload.redirectTo || destination || "/admin");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "حدث خطأ أثناء تسجيل الدخول.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      <label className="block">
        <span className="text-sm font-bold text-white/72">البريد الإلكتروني</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="mt-2 h-12 w-full rounded-[14px] border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white outline-none transition focus:border-white/24"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-white/72">كلمة المرور</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 h-12 w-full rounded-[14px] border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white outline-none transition focus:border-white/24"
        />
      </label>

      <label className="mt-1 flex items-center gap-2 text-sm font-bold text-white/68">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 accent-white"
        />
        تذكرني لمدة أطول
      </label>

      {errorMessage ? (
        <p className="text-sm font-bold text-[#FFB4B4]">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-12 rounded-[14px] border border-white/12 bg-white text-sm font-bold text-[#0B0F1A] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "جارٍ تسجيل الدخول..." : "دخول لوحة الإدارة"}
      </button>
    </form>
  );
}

