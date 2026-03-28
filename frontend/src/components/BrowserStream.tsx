import { Shield } from "lucide-react";

interface Props {
  url: string | null;
  isActive: boolean;
}

export default function BrowserStream({ url, isActive }: Props) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
        isActive && url
          ? "browser-glow border-2 border-cyan/40"
          : isActive
          ? "border-2 border-cyan/20"
          : "border border-white/10"
      }`}
      style={
        isActive
          ? {
              background:
                "linear-gradient(90deg, rgba(6,182,212,0.15), rgba(168,85,247,0.15), rgba(6,182,212,0.15))",
              backgroundSize: "200% 200%",
              animation: "gradient-rotate 3s ease infinite",
              padding: "1px",
            }
          : undefined
      }
    >
      {/* Rotating border animation keyframes injected via style tag */}
      <style>{`
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes matrix-drop {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .matrix-col {
          position: absolute;
          top: 0;
          font-family: "Courier New", monospace;
          font-size: 10px;
          color: rgba(6, 182, 212, 0.3);
          writing-mode: vertical-lr;
          white-space: nowrap;
          animation: matrix-drop linear infinite;
          pointer-events: none;
        }
      `}</style>

      <div className="rounded-xl overflow-hidden bg-bg">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 bg-bg-surface/80 px-4 py-2.5 border-b border-white/5">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red/80" />
            <span className="h-3 w-3 rounded-full bg-yellow/80" />
            <span className="h-3 w-3 rounded-full bg-green/80" />
          </div>

          {/* URL bar */}
          <div className="flex-1 rounded-md bg-bg/60 px-3 py-1 text-xs font-mono text-text-muted truncate">
            {url || "about:blank"}
          </div>

          {/* LIVE indicator */}
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
              </span>
              LIVE
            </div>
          )}

          {!isActive && url && (
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted/50">
              Ended
            </div>
          )}
        </div>

        {/* Browser content area */}
        <div className="bg-bg h-[400px] relative">
          {url ? (
            <>
              <iframe
                src={url}
                className="w-full h-full border-0"
                title="TinyFish Browser"
                sandbox="allow-same-origin allow-scripts"
              />

              {/* Grid HUD overlay */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
              )}

              {/* Scanline overlay for style */}
              {isActive && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-cyan/[0.02] via-transparent to-cyan/[0.02]" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted relative overflow-hidden">
              {isActive ? (
                <>
                  {/* Matrix rain background */}
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="matrix-col"
                        style={{
                          left: `${8 + i * 8}%`,
                          animationDuration: `${2 + Math.random() * 3}s`,
                          animationDelay: `${Math.random() * 2}s`,
                        }}
                      >
                        {Array.from({ length: 20 })
                          .map(() =>
                            String.fromCharCode(
                              0x30a0 + Math.floor(Math.random() * 96)
                            )
                          )
                          .join("")}
                      </div>
                    ))}
                  </div>

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="text-5xl mb-4 animate-pulse">
                      <span role="img" aria-label="fish">&#x1F41F;</span>
                    </div>
                    <span className="text-sm font-medium">
                      Launching stealth browser...
                    </span>
                    <div className="mt-3 flex items-center gap-2">
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-cyan animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-cyan animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-cyan animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center opacity-40">
                  <div className="text-3xl mb-2">
                    <span role="img" aria-label="fish">&#x1F41F;</span>
                  </div>
                  <span className="text-sm">Browser session ended</span>
                </div>
              )}
            </div>
          )}

          {/* Stealth mode status bar */}
          {isActive && (
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 bg-bg-surface/90 backdrop-blur-sm px-3 py-1 border-t border-cyan/10 text-[10px] text-cyan/70 font-mono">
              <Shield className="h-3 w-3" />
              <span>TinyFish Stealth Mode Active</span>
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
