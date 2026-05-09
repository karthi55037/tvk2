"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Leader Dashboard", icon: "🏠" },
  { href: "/live-news", label: "Live News", icon: "📰" },
  { href: "/mla-directory", label: "MLA Directory", icon: "👥" },
  { href: "/criminal-cases", label: "Criminal Cases", icon: "⚖️" },
  { href: "/district-fir", label: "District FIR", icon: "🗺️" },
  { href: "/manifesto", label: "Manifesto Tracker", icon: "📋" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        flex flex-col bg-gray-900 border-r border-gray-800
        transition-all duration-300 min-h-screen
        ${collapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm tvk-glow"
              style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
            >
              TVK
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Tamilaga Vettri</p>
              <p className="text-xs font-bold leading-tight" style={{ color: "#FFD700" }}>
                Kazhagam
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs tvk-glow mx-auto"
            style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
          >
            T
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded"
          aria-label="Toggle sidebar"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? "text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
                }
              `}
              style={
                isActive
                  ? { background: "linear-gradient(135deg, #C8102E22, #C8102E11)", borderLeft: "3px solid #C8102E", color: "#fff" }
                  : {}
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 live-dot" />
            <span className="text-xs text-gray-500">Live updates active</span>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Data from public RSS & ECI sources only
          </p>
        </div>
      )}
    </aside>
  );
}
