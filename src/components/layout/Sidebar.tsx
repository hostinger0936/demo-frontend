// src/components/layout/Sidebar.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type NavItem = { label: string; path: string; icon: string };

const items: NavItem[] = [
  { label: "Dashboard", path: "/", icon: "▦" },
  { label: "Devices", path: "/devices", icon: "📱" },
  { label: "Forms & Payments", path: "/forms", icon: "🧾" },
  { label: "Notifications", path: "/sms", icon: "💬" },
  { label: "Favorites", path: "/favorites", icon: "★" },
  { label: "Admin Sessions", path: "/sessions", icon: "👤" },
  { label: "Crashes", path: "/crashes", icon: "⚠️" },
  { label: "Settings", path: "/settings", icon: "⚙️" },
];

function isActive(pathname: string, target: string) {
  if (target === "/") return pathname === "/";
  return pathname.startsWith(target);
}

function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/zt-logo.png"
      alt="ZeroTrace"
      width={size}
      height={size}
      className="rounded-lg object-cover shrink-0 border"
      draggable={false}
    />
  );
}

export default function Sidebar() {
  const loc = useLocation();
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    const toggle = () => setOpenMobile((v) => !v);
    window.addEventListener("zerotrace:toggle-sidebar", toggle as any);
    return () => window.removeEventListener("zerotrace:toggle-sidebar", toggle as any);
  }, []);

  useEffect(() => {
    setOpenMobile(false);
  }, [loc.pathname]);

  const nav = useMemo(() => items, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r min-h-screen">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} />
            <div className="leading-tight">
              <div className="font-semibold">ZeroTrace</div>
              <div className="text-xs text-gray-400">Admin Panel</div>
            </div>
          </div>
        </div>

        <nav className="p-2 flex-1 space-y-1">
          {nav.map((it) => {
            const active = isActive(loc.pathname, it.path);
            return (
              <Link
                key={it.path}
                to={it.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  active ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="w-5 text-center">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t text-xs text-gray-400">WS events + REST APIs synced</div>
      </aside>

      {/* Mobile overlay sidebar (optional) */}
      {openMobile && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">Menu</div>
              <button className="px-2 py-1 border rounded" onClick={() => setOpenMobile(false)} type="button">
                ✕
              </button>
            </div>

            <nav className="p-2 space-y-1">
              {nav.map((it) => {
                const active = isActive(loc.pathname, it.path);
                return (
                  <Link
                    key={it.path}
                    to={it.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                      active
                        ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-5 text-center">{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}