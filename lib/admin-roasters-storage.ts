import type { Roaster } from "@/lib/data";

export const ADMIN_ROASTERS_UPDATED_EVENT = "jabara-admin-roasters-updated";

export function announceRoastersUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_ROASTERS_UPDATED_EVENT));
}

export function subscribeToStoredRoasters(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(ADMIN_ROASTERS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener(ADMIN_ROASTERS_UPDATED_EVENT, callback);
  };
}

export async function fetchStoredRoasters() {
  const response = await fetch("/api/roasters", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر تحميل المحامص.");
  }

  return (await response.json()) as Roaster[];
}
