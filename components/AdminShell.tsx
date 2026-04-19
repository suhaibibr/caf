import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminUserMenu } from "@/components/AdminUserMenu";

const sidebarItems = [
  {
    label: "لوحة التحكم",
    href: "/admin",
    path: "M5 12h14M5 6h14M5 18h14",
  },
  {
    label: "المحامص",
    href: "/admin/roasters",
    path: "M6 19V8l6-4 6 4v11M9 19v-7h6v7",
  },
  {
    label: "الوصفات",
    href: "/admin/recipes",
    path: "M7 4h10v16H7zM10 8h4M10 12h4M10 16h3",
  },
  {
    label: "مراجعة الوصفات",
    href: "/admin/reviews",
    path: "M7 7h10M7 12h10M7 17h6M4 4h16v16H4z",
  },
  {
    label: "الحسابات الإدارية",
    href: "/admin/accounts",
    path: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a6 6 0 0 1 12 0M19 8v6M22 11h-6",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="h-4 w-4"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

type AdminShellProps = {
  activePath: string;
  children: React.ReactNode;
};

export function AdminShell({ activePath, children }: AdminShellProps) {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[#F6F6F3] text-[#141414] dark:bg-[#0B0F1A] dark:text-[#EAEAEA]"
    >
      <aside className="fixed right-0 top-0 z-30 hidden h-screen w-[240px] border-l border-black/8 bg-white/72 px-4 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101623]/78 lg:block">
        <div className="flex h-full flex-col">
          <div className="px-3">
            <p className="text-[22px] font-bold tracking-[-0.01em]">كــاف</p>
            <p className="mt-1 text-xs font-bold text-black/38 dark:text-[#EAEAEA]/42">
              استوديو المحتوى
            </p>
          </div>

          <nav className="mt-10 space-y-1">
            {sidebarItems.map((item) => {
              const isActive = item.href !== "#" && item.href === activePath;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-bold transition duration-200 ${
                    isActive
                      ? "bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.14)] dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
                      : "text-black/55 hover:bg-black/[0.04] hover:text-black dark:text-[#EAEAEA]/55 dark:hover:bg-white/[0.06] dark:hover:text-[#EAEAEA]"
                  }`}
                >
                  <Icon path={item.path} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[20px] border border-black/8 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm font-bold">وصفة جديدة</p>
            <p className="mt-2 text-xs leading-6 text-black/45 dark:text-[#EAEAEA]/45">
              أضف وصفة جديدة بشكل أسرع.
            </p>
            <Link
              href="/admin/recipes?create=1"
              className="mt-4 block w-full rounded-[14px] bg-black px-4 py-3 text-center text-sm font-bold text-white transition hover:scale-[1.01] dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
            >
              إضافة وصفة
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pr-[240px]">
        <header className="sticky top-0 z-20 border-b border-black/8 bg-[#F6F6F3]/78 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0F1A]/78 sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <div className="flex h-11 flex-1 items-center gap-3 rounded-[18px] border border-black/8 bg-white/70 px-4 text-black/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#EAEAEA]/45">
              <SearchIcon />
              <input
                aria-label="بحث في لوحة الإدارة"
                placeholder="ابحث عن محمصة، وصفة، أو صورة"
                className="h-full flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/35 dark:text-[#EAEAEA] dark:placeholder:text-[#EAEAEA]/35"
              />
            </div>
            <ThemeToggle />
            <AdminUserMenu />
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
