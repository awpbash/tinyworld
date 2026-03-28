import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  icon: string;
  message: string;
  color: "cyan" | "purple" | "green" | "yellow" | "red" | "muted";
}

interface Props {
  logs: LogEntry[];
  isActive?: boolean;
}

const colorMap: Record<string, string> = {
  cyan: "text-cyan",
  purple: "text-purple",
  green: "text-green",
  yellow: "text-yellow",
  red: "text-red",
  muted: "text-text-muted",
};

export function makeLogEntry(
  step: string | undefined,
  message: string
): LogEntry {
  const now = new Date();
  const ts = now.toLocaleTimeString("en-US", { hour12: false });

  let icon = ">";
  let color: LogEntry["color"] = "muted";

  const s = (step ?? "").toLowerCase();
  const m = message.toLowerCase();

  // TinyFish / browser steps
  if (s.includes("tinyfish") || m.includes("tinyfish") || m.includes("\u{1F41F}")) {
    icon = "\u{1F41F}";
    color = "cyan";
  } else if (s.includes("browser") || m.includes("browser")) {
    icon = "\u{1F310}";
    color = "cyan";
  } else if (s.includes("wikipedia") || m.includes("wikipedia") || m.includes("searching")) {
    icon = "\u{1F50D}";
    color = "cyan";
  } else if (s.includes("wikidata") || m.includes("wikidata") || m.includes("structured")) {
    icon = "\u{1F4CA}";
    color = "purple";
  } else if (s.includes("llm") || s.includes("ai") || m.includes("extract") || m.includes("analyz")) {
    icon = "\u{1F916}";
    color = "green";
  } else if (s.includes("connect") || m.includes("connect") || m.includes("link") || m.includes("relationship")) {
    icon = "\u{1F517}";
    color = "yellow";
  } else if (s.includes("complete") || m.includes("complete") || m.includes("done") || m.includes("success")) {
    icon = "\u{2705}";
    color = "green";
  } else if (s.includes("error") || m.includes("error") || m.includes("fail")) {
    icon = "\u{274C}";
    color = "red";
  } else if (m.includes("found")) {
    icon = "\u{2705}";
    color = "green";
  }

  return { timestamp: ts, icon, message, color };
}

export default function StreamingLog({ logs, isActive = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0 && !isActive) return null;

  return (
    <div className="terminal w-full rounded-lg border border-white/5 overflow-hidden transition-all duration-500">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-bg/60 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green/80" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Terminal className="h-3 w-3" />
          <span>tinyfish — streaming log</span>
        </div>
        {isActive && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-cyan">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            live
          </span>
        )}
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed"
      >
        {logs.map((log, i) => (
          <div key={i} className={`log-line flex gap-2 ${colorMap[log.color]}`}>
            <span className="shrink-0 text-text-muted/50 select-none">
              [{log.timestamp}]
            </span>
            <span className="shrink-0 select-none">{log.icon}</span>
            <span>{log.message}</span>
          </div>
        ))}
        {isActive && logs.length > 0 && (
          <div className="log-line flex gap-2 text-text-muted">
            <span className="shrink-0 text-text-muted/50 select-none">
              [{new Date().toLocaleTimeString("en-US", { hour12: false })}]
            </span>
            <span className="cursor-blink" />
          </div>
        )}
      </div>
    </div>
  );
}
