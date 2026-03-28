import { useNavigate } from "react-router-dom";
import { User, ExternalLink } from "lucide-react";
import type { Person } from "../api/types";

interface Props {
  person: Person;
  compact?: boolean;
  onClick?: () => void;
}

export default function PersonCard({ person, compact = false, onClick }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/profile/${person.id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`glass-card group w-full rounded-xl text-left transition-all duration-200 hover:glow-cyan ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className={`shrink-0 overflow-hidden rounded-lg bg-bg-surface flex items-center justify-center ${
            compact ? "h-10 w-10" : "h-16 w-16"
          }`}
        >
          {person.image_url ? (
            <img
              src={person.image_url}
              alt={person.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <User
            className={`text-text-muted/40 ${
              person.image_url ? "hidden" : ""
            } ${compact ? "h-5 w-5" : "h-8 w-8"}`}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-semibold text-text group-hover:text-cyan transition-colors truncate ${
                compact ? "text-sm" : "text-lg"
              }`}
            >
              {person.name}
            </h3>
            <ExternalLink className="h-4 w-4 shrink-0 text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {!compact && person.description && (
            <p className="mt-1 text-sm text-text-muted line-clamp-2">
              {person.description}
            </p>
          )}

          {/* Occupation tags */}
          {person.occupations && person.occupations.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-1" : "mt-2.5"}`}>
              {person.occupations.slice(0, compact ? 2 : 5).map((occ) => (
                <span
                  key={occ}
                  className="rounded-md bg-cyan/10 px-2 py-0.5 text-[11px] font-medium text-cyan"
                >
                  {occ}
                </span>
              ))}
              {person.occupations.length > (compact ? 2 : 5) && (
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-text-muted">
                  +{person.occupations.length - (compact ? 2 : 5)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
