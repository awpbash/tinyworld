import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";

interface Props {
  onSearch: (query: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  initialValue?: string;
  compact?: boolean;
}

export default function SearchBar({
  onSearch,
  isSearching = false,
  placeholder = "Search for anyone...",
  initialValue = "",
  compact = false,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const submit = () => {
    const q = value.trim();
    if (q) onSearch(q);
  };

  return (
    <div
      className={`relative w-full transition-all duration-300 ${
        compact ? "max-w-md" : "max-w-2xl"
      }`}
    >
      {/* Outer glow ring */}
      <div
        className={`absolute -inset-[2px] rounded-xl transition-opacity duration-300 ${
          focused || isSearching
            ? "opacity-100"
            : "opacity-0"
        } ${isSearching ? "pulse-glow" : ""}`}
        style={{
          background:
            "linear-gradient(135deg, rgba(6,182,212,0.4), rgba(168,85,247,0.4))",
          filter: "blur(4px)",
        }}
      />

      {/* Input container */}
      <div
        className={`relative flex items-center gap-3 rounded-xl border bg-bg-surface/80 backdrop-blur-sm transition-all duration-200 ${
          focused
            ? "border-cyan/40"
            : "border-white/10 hover:border-white/20"
        } ${compact ? "px-3 py-2" : "px-5 py-3.5"}`}
      >
        {isSearching ? (
          <Loader2
            className={`text-cyan animate-spin ${
              compact ? "h-4 w-4" : "h-5 w-5"
            }`}
          />
        ) : (
          <Search
            className={`text-text-muted ${compact ? "h-4 w-4" : "h-5 w-5"}`}
          />
        )}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className={`flex-1 bg-transparent outline-none placeholder-text-muted/60 text-text ${
            compact ? "text-sm" : "text-lg"
          }`}
        />

        {value && (
          <button
            onClick={submit}
            disabled={isSearching}
            className="rounded-lg bg-cyan/10 px-4 py-1.5 text-sm font-medium text-cyan transition-all hover:bg-cyan/20 disabled:opacity-50"
          >
            Search
          </button>
        )}
      </div>
    </div>
  );
}
