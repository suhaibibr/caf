import type { Metadata } from "next";
import "./globals.css";
import { SitePresenceTracker } from "@/components/SitePresenceTracker";
import { SiteNotificationCenter } from "@/components/SiteNotificationCenter";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "كــاف",
  description: "منصة عربية لاكتشاف المحامص ووصفات القهوة.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
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
        <footer className="border-t border-[color:var(--page-line)] bg-[var(--page-surface)] px-4 py-4 text-center text-sm font-bold text-[var(--page-muted)]">
          جميع الحقوق محفوظة لـ كاف
        </footer>
        <SitePresenceTracker />
        <SiteNotificationCenter />
      </body>
    </html>
  );
}
