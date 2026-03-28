import { useState, useCallback, useRef, useEffect } from "react";
import {
  Globe, Zap, AlertCircle, User, Loader2, Calendar, Globe2,
  Fingerprint, ExternalLink, MapPin, Briefcase, Heart,
} from "lucide-react";
import StreamingLog, {
  makeLogEntry,
  type LogEntry,
} from "../components/StreamingLog";
import GraphVisualization from "../components/GraphVisualization";
import ConnectionPath from "../components/ConnectionPath";
import BrowserStream from "../components/BrowserStream";
import SearchStats from "../components/SearchStats";
import ConnectionStats from "../components/ConnectionStats";
import {
  searchPersonStream,
  findConnectionStream,
  getGraph,
} from "../api/client";
import type {
  Person, GraphData, SSEEvent, ConnectionSSEEvent,
  DeepSearchData, DeepConnectionData,
} from "../api/types";

type Phase = "idle" | "searching" | "connecting" | "done";

const TAGLINE = "Are you dating your distant cousin?";

export default function ConnectionPage() {
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");

  const [personA, setPersonA] = useState<Person | null>(null);
  const [personB, setPersonB] = useState<Person | null>(null);

  const [logsA, setLogsA] = useState<LogEntry[]>([]);
  const [logsB, setLogsB] = useState<LogEntry[]>([]);
  const [logsConnect, setLogsConnect] = useState<LogEntry[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [searchDoneA, setSearchDoneA] = useState(false);
  const [searchDoneB, setSearchDoneB] = useState(false);

  const [path, setPath] = useState<Person[]>([]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [connectionSummary, setConnectionSummary] = useState("");
  const [noConnection, setNoConnection] = useState(false);

  const [statsA, setStatsA] = useState<DeepSearchData | null>(null);
  const [statsB, setStatsB] = useState<DeepSearchData | null>(null);
  const [connStats, setConnStats] = useState<DeepConnectionData | null>(null);

  const [browserUrlA, setBrowserUrlA] = useState<string | null>(null);
  const [browserUrlB, setBrowserUrlB] = useState<string | null>(null);

  const cancelA = useRef<(() => void) | null>(null);
  const cancelB = useRef<(() => void) | null>(null);
  const cancelConn = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (searchDoneA && searchDoneB && personA && personB) {
      startConnectionDiscovery(personA.id, personB.id);
    }
  }, [searchDoneA, searchDoneB, personA, personB]);

  const handleInvestigate = useCallback(() => {
    if (!nameA.trim() || !nameB.trim()) return;

    setPersonA(null);
    setPersonB(null);
    setLogsA([]);
    setLogsB([]);
    setLogsConnect([]);
    setPath([]);
    setGraph(null);
    setConnectionSummary("");
    setNoConnection(false);
    setSearchDoneA(false);
    setSearchDoneB(false);
    setBrowserUrlA(null);
    setBrowserUrlB(null);
    setStatsA(null);
    setStatsB(null);
    setConnStats(null);
    setPhase("searching");

    cancelA.current?.();
    cancelB.current?.();
    cancelConn.current?.();

    // --- Agent A ---
    cancelA.current = searchPersonStream(
      nameA.trim(),
      (ev: SSEEvent) => {
        if (ev.type === "browser_url" && ev.streaming_url) setBrowserUrlA(ev.streaming_url);
        if (ev.type === "result" && ev.step === "tinyfish" && ev.data?.google_results !== undefined) setStatsA(ev.data);
        if (ev.type === "graph_update" && ev.graph) setGraph(ev.graph);
        if (ev.message) setLogsA((p) => [...p, makeLogEntry(ev.step ?? ev.type, ev.message!)]);
        if (ev.type === "complete" && ev.person) {
          setPersonA(ev.person);
          setLogsA((p) => [...p, makeLogEntry("complete", `Profile built for ${ev.person!.name}`)]);
          setSearchDoneA(true);
        }
        if (ev.type === "error") {
          setLogsA((p) => [...p, makeLogEntry("error", ev.message || "Search failed")]);
          setSearchDoneA(true);
        }
      },
      () => setSearchDoneA(true),
    );

    // --- Agent B ---
    cancelB.current = searchPersonStream(
      nameB.trim(),
      (ev: SSEEvent) => {
        if (ev.type === "browser_url" && ev.streaming_url) setBrowserUrlB(ev.streaming_url);
        if (ev.type === "result" && ev.step === "tinyfish" && ev.data?.google_results !== undefined) setStatsB(ev.data);
        if (ev.type === "graph_update" && ev.graph) setGraph(ev.graph);
        if (ev.message) setLogsB((p) => [...p, makeLogEntry(ev.step ?? ev.type, ev.message!)]);
        if (ev.type === "complete" && ev.person) {
          setPersonB(ev.person);
          setLogsB((p) => [...p, makeLogEntry("complete", `Profile built for ${ev.person!.name}`)]);
          setSearchDoneB(true);
        }
        if (ev.type === "error") {
          setLogsB((p) => [...p, makeLogEntry("error", ev.message || "Search failed")]);
          setSearchDoneB(true);
        }
      },
      () => setSearchDoneB(true),
    );
  }, [nameA, nameB]);

  const startConnectionDiscovery = useCallback(
    (aId: number, bId: number) => {
      setPhase("connecting");
      setLogsConnect([makeLogEntry("connect", "Both profiles ready. Finding connections...")]);

      cancelConn.current = findConnectionStream(aId, bId,
        (ev: ConnectionSSEEvent) => {
          const d = (ev as any).data;
          if ((ev as any).type === "graph_update" && (ev as any).graph) setGraph((ev as any).graph);
          if ((ev as any).type === "result" && (ev as any).step === "tinyfish" && d?.co_mentions !== undefined) setConnStats(d);
          if (ev.message) setLogsConnect((p) => [...p, makeLogEntry(ev.step ?? ev.type, ev.message!)]);
          if (ev.type === "complete") {
            const conn = (ev as any).connection;
            if (conn?.found && conn.path) {
              setPath(conn.path);
              if (conn.summary) setConnectionSummary(conn.summary);
            } else setNoConnection(true);
            getGraph().then(setGraph).catch(() => {});
            setPhase("done");
          }
          if (ev.type === "error") { setNoConnection(true); setPhase("done"); }
        },
        () => { setPhase("done"); getGraph().then(setGraph).catch(() => {}); },
      );
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && nameA.trim() && nameB.trim()) handleInvestigate();
  };

  const isSearching = phase === "searching";
  const isConnecting = phase === "connecting";
  const isWorking = isSearching || isConnecting;
  const highlightIds = path.map((p) => p.id);
  const showBrowserA = browserUrlA !== null || (isSearching && !searchDoneA);
  const showBrowserB = browserUrlB !== null || (isSearching && !searchDoneB);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden">
      {/* Animated bg */}
      <div className="pointer-events-none fixed inset-0 bg-dot-grid" />
      <div className="pointer-events-none fixed -top-60 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-cyan/[0.04] blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-purple/[0.04] blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan/[0.03] blur-[100px]" />

      {/* ════════ HERO ════════ */}
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-14 pb-8">
        {/* Logo + tagline */}
        <div className="relative mb-3">
          <div className="absolute inset-0 rounded-full bg-cyan/20 blur-2xl scale-150" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan/20 bg-bg-surface/80 backdrop-blur-sm">
            <Globe className="h-8 w-8 text-cyan text-glow-cyan" />
          </div>
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tight gradient-text mb-1">
          TinyWorld
        </h1>

        <p className="text-lg text-cyan/50 font-mono italic mb-8">
          "{TAGLINE}"
        </p>

        {/* ── Search area: inputs LEFT and RIGHT, button below ── */}
        <div className="w-full max-w-5xl">
          <div className="grid gap-6 md:grid-cols-[1fr,1fr] items-end">
            {/* Person A — LEFT */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan">
                <User className="h-3.5 w-3.5" />
                Subject A
              </label>
              <div className="glass-card-strong rounded-xl p-1">
                <input
                  type="text"
                  value={nameA}
                  onChange={(e) => setNameA(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Sam Altman"
                  disabled={isWorking}
                  className="w-full rounded-lg border-0 bg-transparent px-5 py-4 text-lg text-text placeholder-text-muted/40 outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Person B — RIGHT */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-purple">
                <User className="h-3.5 w-3.5" />
                Subject B
              </label>
              <div className="glass-card-strong rounded-xl p-1">
                <input
                  type="text"
                  value={nameB}
                  onChange={(e) => setNameB(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Mark Zuckerberg"
                  disabled={isWorking}
                  className="w-full rounded-lg border-0 bg-transparent px-5 py-4 text-lg text-text placeholder-text-muted/40 outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Investigate button — centered below */}
          <div className="mt-6 flex flex-col items-center gap-4">
            <button
              onClick={handleInvestigate}
              disabled={!nameA.trim() || !nameB.trim() || isWorking}
              className="group relative flex items-center gap-2 rounded-xl px-10 py-4 text-base font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan via-purple to-cyan opacity-90 group-hover:opacity-100 transition-opacity group-disabled:opacity-30 bg-[length:200%_100%] animate-[gradient-shift_3s_ease-in-out_infinite]" />
              <span className="absolute inset-[2px] rounded-[10px] bg-bg-surface/90" />
              <span className="relative flex items-center gap-2 bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">
                {isWorking ? (
                  <Loader2 className="h-5 w-5 text-cyan animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 text-cyan" />
                )}
                {isSearching ? "Hunting..." : isConnecting ? "Connecting..." : "Investigate"}
              </span>
            </button>

            {phase === "idle" && (
              <div className="flex items-center gap-4 text-[10px] text-text-muted/30 uppercase tracking-widest">
                <span>Wikipedia</span>
                <span className="h-px w-3 bg-text-muted/20" />
                <span>Wikidata</span>
                <span className="h-px w-3 bg-text-muted/20" />
                <span>Web Search</span>
                <span className="h-px w-3 bg-text-muted/20" />
                <span>Social Media</span>
                <span className="h-px w-3 bg-text-muted/20" />
                <span>News</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════ AGENT PANELS ════════ */}
      {phase !== "idle" && (
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Agent A */}
            <AgentPanel
              label={`Agent A — ${nameA}`}
              accent="cyan"
              logs={logsA}
              isActive={!searchDoneA}
              isDone={searchDoneA}
              person={personA}
              stats={statsA}
              browserUrl={browserUrlA}
              showBrowser={showBrowserA}
            />
            {/* Agent B */}
            <AgentPanel
              label={`Agent B — ${nameB}`}
              accent="purple"
              logs={logsB}
              isActive={!searchDoneB}
              isDone={searchDoneB}
              person={personB}
              stats={statsB}
              browserUrl={browserUrlB}
              showBrowser={showBrowserB}
            />
          </div>
        </div>
      )}

      {/* ════════ LIVE GRAPH (shows during search!) ════════ */}
      {graph && graph.nodes.length > 0 && (
        <div className="mx-auto max-w-[1400px] px-4 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Knowledge Graph
            </h2>
            {isWorking && (
              <span className="flex items-center gap-1.5 text-[10px] text-cyan font-mono">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
                </span>
                building live
              </span>
            )}
          </div>
          <GraphVisualization data={graph} highlightPath={highlightIds} height={550} />
        </div>
      )}

      {/* ════════ CONNECTION DISCOVERY ════════ */}
      {(isConnecting || logsConnect.length > 0) && (
        <div className="mx-auto max-w-6xl px-4 pb-8">
          <div className="glass-card-strong rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-yellow">
              <span className="relative flex h-2 w-2">
                {isConnecting && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow opacity-75" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${phase === "done" ? "bg-green" : "bg-yellow"}`} />
              </span>
              Connection Discovery Engine
            </div>
            <StreamingLog logs={logsConnect} isActive={isConnecting} />
            {connStats && (
              <div className="mt-4">
                <ConnectionStats
                  coMentions={connStats.co_mentions}
                  sharedEntities={connStats.shared_entities}
                  eventConnections={connStats.event_connections}
                  mutualConnections={connStats.mutual_connections}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ CONNECTION SUMMARY ════════ */}
      {connectionSummary && (
        <div className="mx-auto max-w-6xl px-4 pb-8">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan/10 via-purple/5 to-cyan/10" />
            <div className="relative glass-card-strong rounded-2xl px-8 py-6 border-l-4 border-cyan">
              <h3 className="text-lg font-bold gradient-text mb-3">Connection Found</h3>
              <p className="text-text text-base leading-relaxed">{connectionSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════ CONNECTION PATH ════════ */}
      {path.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Connection Path
          </h2>
          <ConnectionPath path={path} />
        </div>
      )}

      {/* ════════ NO CONNECTION ════════ */}
      {noConnection && (
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <div className="flex items-center gap-3 glass-card rounded-xl px-6 py-4 text-text-muted">
            <AlertCircle className="h-5 w-5 text-yellow shrink-0" />
            <span>
              No direct connection found yet. The graph may still contain interesting
              nearby nodes — try exploring it!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Agent Panel — self-contained column for each search agent
   ════════════════════════════════════════════════════════ */
function AgentPanel({
  label, accent, logs, isActive, isDone, person, stats, browserUrl, showBrowser,
}: {
  label: string;
  accent: "cyan" | "purple";
  logs: LogEntry[];
  isActive: boolean;
  isDone: boolean;
  person: Person | null;
  stats: DeepSearchData | null;
  browserUrl: string | null;
  showBrowser: boolean;
}) {
  const accentColor = accent === "cyan" ? "text-cyan" : "text-purple";
  const pingColor = accent === "cyan" ? "bg-cyan" : "bg-purple";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${accentColor}`}>
        <span className="relative flex h-2 w-2">
          {isActive && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${pingColor} opacity-75`} />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${isDone ? "bg-green" : pingColor}`} />
        </span>
        {label}
      </div>

      {/* Streaming log */}
      <StreamingLog logs={logs} isActive={isActive} />

      {/* Deep search stats */}
      {stats && (
        <SearchStats
          googleResults={stats.google_results}
          socialProfiles={stats.social_profiles}
          newsMentions={stats.news_mentions}
          hasProfile={stats.has_profile_data}
          label={`${accent === "cyan" ? "Subject A" : "Subject B"} Digital Footprint`}
          accent={accent}
        />
      )}

      {/* Live browser iframe */}
      {showBrowser && <BrowserStream url={browserUrl} isActive={isActive} />}

      {/* Person bio card */}
      {person && <PersonBioCard person={person} accent={accent} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Rich Person Bio Card
   ════════════════════════════════════════════════════════ */
function PersonBioCard({
  person,
  accent,
}: {
  person: Person;
  accent: "cyan" | "purple";
}) {
  const border = accent === "cyan" ? "border-cyan/20" : "border-purple/20";
  const tag = accent === "cyan" ? "bg-cyan/10 text-cyan" : "bg-purple/10 text-purple";
  const accentTxt = accent === "cyan" ? "text-cyan" : "text-purple";
  const ring = accent === "cyan" ? "ring-cyan/30" : "ring-purple/30";

  return (
    <div className={`glass-card-strong rounded-2xl overflow-hidden border ${border}`}>
      {/* Gradient banner */}
      <div
        className="h-20 relative"
        style={{
          background: accent === "cyan"
            ? "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(168,85,247,0.1))"
            : "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.1))",
        }}
      >
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
      </div>

      <div className="px-5 pb-5 -mt-10 relative">
        {/* Avatar */}
        <div className={`h-20 w-20 rounded-xl overflow-hidden border-4 border-bg-surface bg-bg-surface ring-2 ${ring} mb-3`}>
          {person.image_url ? (
            <img src={person.image_url} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-bg-card">
              <User className="h-8 w-8 text-text-muted/30" />
            </div>
          )}
        </div>

        {/* Name & meta */}
        <h3 className="text-lg font-bold text-text">{person.name}</h3>

        {(person.birth_date || person.nationality) && (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
            {person.birth_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {person.birth_date}
              </span>
            )}
            {person.nationality && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {person.nationality}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {person.description && (
          <p className="mt-3 text-sm text-text-muted leading-relaxed line-clamp-4">
            {person.description}
          </p>
        )}

        {/* Occupations */}
        {person.occupations && person.occupations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {person.occupations.map((o) => (
              <span key={o} className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${tag}`}>
                {o}
              </span>
            ))}
          </div>
        )}

        {/* Links row */}
        <div className="mt-4 flex items-center gap-4 text-xs">
          {person.wikipedia_url && (
            <a
              href={person.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 ${accentTxt} hover:underline`}
            >
              <ExternalLink className="h-3 w-3" />
              Wikipedia
            </a>
          )}
          {person.wikidata_id && (
            <a
              href={`https://www.wikidata.org/wiki/${person.wikidata_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-text-muted hover:text-text"
            >
              <Globe2 className="h-3 w-3" />
              Wikidata
            </a>
          )}
        </div>

        {/* Footprint badge */}
        <div className={`mt-3 flex items-center gap-1.5 text-[10px] ${accentTxt} opacity-60`}>
          <Fingerprint className="h-3 w-3" />
          <span>
            Digital footprint compiled from{" "}
            {[person.wikipedia_url, person.wikidata_id, person.image_url].filter(Boolean).length + 2}+ sources
          </span>
        </div>
      </div>
    </div>
  );
}
