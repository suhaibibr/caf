"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LogoutResponse = {
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

export function AdminLogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      const payload = (await readJsonSafely<LogoutResponse>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message || "تعذر تسجيل الخروج.");
      }
    } catch {
      // Clear stale client state even if the request fails.
    } finally {
      setIsLoading(false);
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold text-black/60 transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-[#EAEAEA]/70 dark:hover:bg-white dark:hover:text-[#0B0F1A]"
    >
      {isLoading ? "جارٍ الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
