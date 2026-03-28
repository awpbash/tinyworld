import { User, ArrowRight, GraduationCap, Building2, MapPin, Trophy, Users } from "lucide-react";
import type { Person } from "../api/types";

interface Props {
  path: Person[];
}

const ENTITY_CONFIG: Record<string, { icon: typeof User; color: string; border: string; bg: string }> = {
  school: {
    icon: GraduationCap,
    color: "text-blue-400",
    border: "border-blue-400/30",
    bg: "bg-blue-400/10",
  },
  company: {
    icon: Building2,
    color: "text-amber-400",
    border: "border-amber-400/30",
    bg: "bg-amber-400/10",
  },
  location: {
    icon: MapPin,
    color: "text-violet-400",
    border: "border-violet-400/30",
    bg: "bg-violet-400/10",
  },
  event: {
    icon: Trophy,
    color: "text-pink-400",
    border: "border-pink-400/30",
    bg: "bg-pink-400/10",
  },
  team: {
    icon: Users,
    color: "text-emerald-400",
    border: "border-emerald-400/30",
    bg: "bg-emerald-400/10",
  },
};

function isEntity(person: Person): boolean {
  return !!person.node_type && person.node_type !== "person";
}

export default function ConnectionPath({ path }: Props) {
  if (path.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto py-4">
      <div className="flex items-center gap-2 min-w-max px-4">
        {path.map((person, i) => {
          const entity = isEntity(person);
          const config = entity
            ? ENTITY_CONFIG[person.node_type!] || ENTITY_CONFIG.company
            : null;
          const IconComp = config?.icon || User;

          return (
            <div key={person.id} className="flex items-center gap-2">
              {/* Node card */}
              <div
                className={`card-reveal glass-card flex flex-col items-center rounded-xl px-5 py-4 min-w-[140px] border ${
                  entity ? config!.border : "border-white/5"
                }`}
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {/* Avatar / Icon */}
                <div
                  className={`h-14 w-14 rounded-full bg-bg-surface border flex items-center justify-center overflow-hidden mb-2 ${
                    entity ? config!.border : "border-white/10"
                  }`}
                >
                  {!entity && person.image_url ? (
                    <img
                      src={person.image_url}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  ) : entity ? (
                    <IconComp className={`h-6 w-6 ${config!.color}`} />
                  ) : (
                    <User className="h-6 w-6 text-text-muted/40" />
                  )}
                </div>

                <span
                  className={`text-sm font-semibold text-center leading-tight ${
                    entity ? config!.color : "text-text"
                  }`}
                >
                  {person.name}
                </span>

                {/* Entity type badge */}
                {entity && (
                  <span
                    className={`mt-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config!.bg} ${config!.color}`}
                  >
                    {person.node_type}
                  </span>
                )}

                {/* Occupations for person nodes */}
                {!entity && person.occupations?.length > 0 && (
                  <span className="mt-1 text-[10px] text-text-muted text-center">
                    {person.occupations.slice(0, 2).join(", ")}
                  </span>
                )}
              </div>

              {/* Arrow between nodes */}
              {i < path.length - 1 && (
                <div
                  className="card-reveal flex flex-col items-center gap-1"
                  style={{ animationDelay: `${i * 0.2 + 0.1}s` }}
                >
                  <ArrowRight className="h-5 w-5 text-cyan" />
                  <span className="text-[10px] text-text-muted/60 max-w-[80px] text-center leading-tight">
                    {person.edge_to_next?.relationship_type || "connected"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
