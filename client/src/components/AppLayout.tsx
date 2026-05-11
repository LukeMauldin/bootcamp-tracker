import { Home, LogOut, ShieldCheck, Trophy } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, coachOnly: false },
  { to: "/leaderboard", label: "Leaders", icon: Trophy, coachOnly: false },
  { to: "/admin", label: "Coach", icon: ShieldCheck, coachOnly: true }
] as const;

export function AppLayout() {
  const { profile, team, logout } = useAuth();
  const visibleItems = navItems.filter((item) => !item.coachOnly || profile?.role === "coach");

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 md:pb-0">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sentinel-navy px-5 py-6 text-white md:block">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Lady Sentinels</p>
          <h1 className="mt-2 text-2xl font-bold">Finish Strong</h1>
        </div>
        <nav className="space-y-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-white text-sentinel-navy" : "text-blue-100 hover:bg-white/10"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-6 left-5 right-5">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-sm font-semibold">{profile?.displayName}</p>
            <p className="text-xs text-blue-200">{team?.name ?? "Team pending"}</p>
          </div>
          <button className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-white/10" onClick={() => void logout()}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="mx-auto max-w-5xl px-4 py-5 md:ml-64 md:px-8 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid border-t border-gray-200 bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${isActive ? "text-blue-900" : "text-gray-500"}`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
