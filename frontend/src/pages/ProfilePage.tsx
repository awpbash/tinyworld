import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User,
  Calendar,
  Globe,
  Briefcase,
  ExternalLink,
  GitFork,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getPersonProfile, getPersonNetwork } from "../api/client";
import GraphVisualization from "../components/GraphVisualization";
import type { Person, GraphData } from "../api/types";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [network, setNetwork] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const pid = Number(id);
    setLoading(true);
    setError(null);

    Promise.all([
      getPersonProfile(pid).catch(() => null),
      getPersonNetwork(pid).catch(() => null),
    ]).then(([p, n]) => {
      if (!p) {
        setError("Person not found");
      } else {
        setPerson(p);
        setNetwork(n);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <span className="text-sm text-text-muted">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-text-muted">{error ?? "Person not found"}</p>
      </div>
    );
  }

  const facts = [
    {
      icon: Calendar,
      label: "Born",
      value: person.birth_date,
    },
    {
      icon: Globe,
      label: "Nationality",
      value: person.nationality,
    },
    {
      icon: Briefcase,
      label: "Occupations",
      value: person.occupations?.join(", "),
    },
  ].filter((f) => f.value);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* ── Hero ─────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="shrink-0 h-32 w-32 rounded-xl bg-bg-surface border border-white/10 flex items-center justify-center overflow-hidden">
            {person.image_url ? (
              <img
                src={person.image_url}
                alt={person.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-14 w-14 text-text-muted/30" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-text">{person.name}</h1>
            {person.aliases?.length > 0 && (
              <p className="mt-1 text-sm text-text-muted">
                Also known as: {person.aliases.join(", ")}
              </p>
            )}
            {person.description && (
              <p className="mt-3 text-text-muted leading-relaxed">
                {person.description}
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-3">
              {person.wikipedia_url && (
                <a
                  href={person.wikipedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-cyan/10 px-3 py-1.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Wikipedia
                </a>
              )}
              <button
                onClick={() => navigate(`/connect?a=${person.id}`)}
                className="flex items-center gap-1.5 rounded-lg bg-purple/10 px-3 py-1.5 text-sm font-medium text-purple transition-colors hover:bg-purple/20"
              >
                <GitFork className="h-3.5 w-3.5" />
                Find Connection To...
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Facts grid ───────────────────────────────── */}
      {facts.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {facts.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="glass-card rounded-xl px-5 py-4"
            >
              <div className="flex items-center gap-2 text-xs text-text-muted uppercase tracking-wider mb-1.5">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="text-sm font-medium text-text">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Occupation tags ──────────────────────────── */}
      {person.occupations?.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Occupations
          </h2>
          <div className="flex flex-wrap gap-2">
            {person.occupations.map((occ) => (
              <span
                key={occ}
                className="rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-1 text-sm text-cyan glow-cyan"
              >
                {occ}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Ego network graph ────────────────────────── */}
      {network && network.nodes.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Known Connections
          </h2>
          <GraphVisualization
            data={network}
            highlightPath={[person.id]}
            height={450}
          />
        </div>
      )}

      {/* ── Sources ──────────────────────────────────── */}
      <div className="mt-8">
        <button
          onClick={() => setShowSources(!showSources)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted hover:text-text transition-colors"
        >
          Sources
          {showSources ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {showSources && (
          <div className="mt-3 glass-card rounded-xl px-5 py-4 text-sm text-text-muted space-y-1.5">
            {person.wikipedia_url && (
              <div>
                Wikipedia:{" "}
                <a
                  href={person.wikipedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan underline"
                >
                  {person.wikipedia_url}
                </a>
              </div>
            )}
            {person.wikidata_id && (
              <div>
                Wikidata:{" "}
                <a
                  href={`https://www.wikidata.org/wiki/${person.wikidata_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan underline"
                >
                  {person.wikidata_id}
                </a>
              </div>
            )}
            {!person.wikipedia_url && !person.wikidata_id && (
              <div>No external sources available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
