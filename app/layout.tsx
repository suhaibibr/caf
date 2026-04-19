import type { Metadata } from "next";
import "./globals.css";
import { SitePresenceTracker } from "@/components/SitePresenceTracker";
import { SiteNotificationCenter } from "@/components/SiteNotificationCenter";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "كــاف",
  description: "منصة عربية لاكتشاف المحامص ووصفات القهوة.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootScript = `
    (function () {
      try {
        var stored = window.localStorage.getItem("${THEME_STORAGE_KEY}");
        var theme = stored === "light" || stored === "dark"
          ? stored
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        var root = document.documentElement;
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        if (theme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      } catch (error) {}
    })();
  `;

  return (
    <html
      lang="ar"
      dir="rtl"
      className="h-full scroll-smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        {children}
        <SitePresenceTracker />
        <SiteNotificationCenter />
      </body>
    </html>
  );
}
