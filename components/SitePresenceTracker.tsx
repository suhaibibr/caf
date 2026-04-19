"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "caf-site-session-id";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateSessionId() {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const next = createSessionId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

export function SitePresenceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    const sessionId = getOrCreateSessionId();
    let stopped = false;

    const ping = () => {
      if (stopped) {
        return;
      }

      fetch("/api/site-metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => {
        // Silent retry on the next interval.
      });
    };

    ping();
    const interval = window.setInterval(ping, 30000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}

