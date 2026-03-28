import { Search, Building2, Calendar, UserPlus } from "lucide-react";

interface Props {
  coMentions: number;
  sharedEntities: number;
  eventConnections: number;
  mutualConnections: number;
}

const stats = [
  { icon: Search, label: "Co-Mentions", key: "coMentions" },
  { icon: Building2, label: "Shared Entities", key: "sharedEntities" },
  { icon: Calendar, label: "Event Links", key: "eventConnections" },
  { icon: UserPlus, label: "Mutual Contacts", key: "mutualConnections" },
] as const;

export default function ConnectionStats({
  coMentions,
  sharedEntities,
  eventConnections,
  mutualConnections,
}: Props) {
  const values: Record<string, number> = {
    coMentions,
    sharedEntities,
    eventConnections,
    mutualConnections,
  };

  return (
    <div className="glass-card rounded-xl p-3 border border-yellow/20 shadow-[0_0_20px_rgba(234,179,8,0.08)] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
        Connection Intelligence
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ icon: Icon, label: statLabel, key }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <div className="rounded-lg bg-yellow/10 p-1.5">
              <Icon className="h-3.5 w-3.5 text-yellow" />
            </div>
            <span className="text-lg font-bold text-yellow">
              {values[key]}
            </span>
            <span className="text-[9px] text-text-muted text-center leading-tight">
              {statLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
