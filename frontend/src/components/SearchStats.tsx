import { Globe, Users, Newspaper, UserCheck } from "lucide-react";

interface Props {
  googleResults: number;
  socialProfiles: number;
  newsMentions: number;
  hasProfile: boolean;
  label: string;
  accent: "cyan" | "purple";
}

const stats = [
  { icon: Globe, label: "Search Results", key: "google" },
  { icon: Users, label: "Social Profiles", key: "social" },
  { icon: Newspaper, label: "News Mentions", key: "news" },
  { icon: UserCheck, label: "Profile Data", key: "profile" },
] as const;

export default function SearchStats({
  googleResults,
  socialProfiles,
  newsMentions,
  hasProfile,
  label,
  accent,
}: Props) {
  const values: Record<string, number> = {
    google: googleResults,
    social: socialProfiles,
    news: newsMentions,
    profile: hasProfile ? 1 : 0,
  };
  const accentColor = accent === "cyan" ? "text-cyan" : "text-purple";
  const accentBg = accent === "cyan" ? "bg-cyan/10" : "bg-purple/10";
  const accentBorder =
    accent === "cyan" ? "border-cyan/20" : "border-purple/20";
  const accentGlow =
    accent === "cyan"
      ? "shadow-[0_0_20px_rgba(6,182,212,0.08)]"
      : "shadow-[0_0_20px_rgba(168,85,247,0.08)]";

  return (
    <div
      className={`glass-card rounded-xl p-3 border ${accentBorder} ${accentGlow} animate-in fade-in slide-in-from-bottom-2 duration-500`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
        {label}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ icon: Icon, label: statLabel, key }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <div className={`rounded-lg ${accentBg} p-1.5`}>
              <Icon className={`h-3.5 w-3.5 ${accentColor}`} />
            </div>
            <span className={`text-lg font-bold ${accentColor}`}>
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
