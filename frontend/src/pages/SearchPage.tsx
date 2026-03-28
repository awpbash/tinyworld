import { useState, useCallback } from "react";
import { Fish, Clock, X } from "lucide-react";
import SearchBar from "../components/SearchBar";
import StreamingLog, {
  makeLogEntry,
  type LogEntry,
} from "../components/StreamingLog";
import PersonCard from "../components/PersonCard";
import { searchPersonStream } from "../api/client";
import type { Person, SSEEvent } from "../api/types";

const RECENT_KEY = "tinyfish_recent";

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecent(query: string) {
  const prev = getRecent().filter((q) => q !== query);
  const next = [query, ...prev].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export default function SearchPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecent);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      // Cancel any in-flight search
      cancelFn?.();

      setLogs([]);
      setResults([]);
      setIsSearching(true);
      addRecent(query);
      setRecentSearches(getRecent());

      const cancel = searchPersonStream(
        query,
        (ev: SSEEvent) => {
          // Append log
          if (ev.message) {
            setLogs((prev) => [
              ...prev,
              makeLogEntry(ev.step ?? ev.type, ev.message!),
            ]);
          }

          // Collect results
          if (ev.type === "result" && ev.person) {
            setResults((prev) => [...prev, ev.person!]);
          }

          if (ev.type === "complete") {
            setIsSearching(false);
            if (ev.person) {
              setResults((prev) => [...prev, ev.person!]);
            }
          }

          if (ev.type === "error") {
            setIsSearching(false);
          }
        },
        () => setIsSearching(false)
      );

      setCancelFn(() => cancel);
    },
    [cancelFn]
  );

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentSearches([]);
  };

  const showLog = logs.length > 0 || isSearching;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-dot-grid">
      {/* Hero / search area */}
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 pb-8">
        {/* Logo */}
        <div className="mb-2 flex items-center gap-3">
          <Fish className="h-10 w-10 text-cyan text-glow-cyan" />
          <h1 className="text-5xl font-black tracking-tight gradient-text">
            TinyFish
          </h1>
        </div>
        <p className="mb-10 text-text-muted text-lg">
          Digital Footprint Explorer
        </p>

        {/* Search bar */}
        <SearchBar onSearch={handleSearch} isSearching={isSearching} />

        {/* Streaming log */}
        <div
          className={`mt-6 w-full max-w-2xl transition-all duration-500 ${
            showLog
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none h-0"
          }`}
        >
          <StreamingLog logs={logs} isActive={isSearching} />
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
            Results
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        </section>
      )}

      {/* Recent searches */}
      {!showLog && results.length === 0 && recentSearches.length > 0 && (
        <section className="mx-auto max-w-2xl px-4 pb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-3.5 w-3.5" />
              Recent searches
            </div>
            <button
              onClick={clearRecent}
              className="text-xs text-text-muted/60 hover:text-text-muted transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="group flex items-center gap-1.5 rounded-lg border border-white/5 bg-bg-card/50 px-3 py-1.5 text-sm text-text-muted transition-all hover:border-cyan/20 hover:text-cyan"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-80 w-80 rounded-full bg-cyan/5 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple/5 blur-3xl" />
    </div>
  );
}
