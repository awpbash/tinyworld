import { NavLink, Outlet } from "react-router-dom";
import { Globe, Search, Radar, History, Network, Share2 } from "lucide-react";

const links = [
  { to: "/", label: "Investigate", icon: Radar },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/history", label: "History", icon: History },
  { to: "/search", label: "Search", icon: Search },
];

export default function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* ── Nav bar ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-bg/80 backdrop-blur-lg">
        <nav className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4">
          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <Globe className="h-6 w-6 text-cyan" />
            <span className="gradient-text">TinyWorld</span>
          </NavLink>

          {/* Links */}
          <div className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-cyan"
                      : "text-text-muted hover:text-text"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" />
                    {label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-cyan glow-cyan" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="flex-1" />

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </a>
        </nav>
      </header>

      {/* ── Main content ─────────────────────────────── */}
      <main className="flex-1">
        {/* Always-mounted children (ConnectionPage) */}
        {children}
        {/* Route-based pages */}
        <Outlet />
      </main>
    </div>
  );
}
