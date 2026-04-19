"use client";

import type { ReactNode } from "react";

type XbloomTrackedLinkProps = {
  href: string;
  recipeSlug: string;
  className?: string;
  children: ReactNode;
};

function sendClick(recipeSlug: string) {
  const payload = JSON.stringify({ recipeSlug });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/xbloom-clicks", blob);
    return;
  }

  void fetch("/api/xbloom-clicks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Ignore tracking failures to keep navigation uninterrupted.
  });
}

export function XbloomTrackedLink({
  href,
  recipeSlug,
  className = "",
  children,
}: XbloomTrackedLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => sendClick(recipeSlug)}
      className={className}
    >
      {children}
    </a>
  );
}
