import { useLocation } from "react-router-dom";

/**
 * MobileBottomNav.tsx — FULL & FINAL (UPDATED)
 *
 * Bottom navigation for mobile (md:hidden).
 * App.tsx already mounts it.
 */

type Item = { label: string; path: string; icon: string };

const items: Item[] = [
  { label: "Home", path: "/", icon: "▦" },
  { label: "Devices", path: "/devices", icon: "📱" },
  { label: "Forms", path: "/forms", icon: "🧾" },
  { label: "SMS", path: "/sms", icon: "💬" },
  { label: "More", path: "/settings", icon: "⚙️" },
];

function isActive(pathname: string, target: string) {
  if (target === "/") return pathname === "/";
  return pathname.startsWith(target);
}

export default function MobileBottomNav() {
  const loc = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const active = isActive(loc.pathname, it.path);
          return (
            <a
              key={it.path}
              href={it.path}
              className={`flex flex-col items-center justify-center py-2 text-xs ${
                active ? "text-[var(--brand)] font-medium" : "text-gray-600"
              }`}
            >
              <div className="text-base">{it.icon}</div>
              <div>{it.label}</div>
            </a>
          );
        })}
      </div>
    </nav>
  );
}