import { useState, useCallback, useMemo } from "react";
import {
  History, Sparkles, X, User, Building2,
  GraduationCap, MapPin, Calendar, Globe2, ExternalLink,
  MousePointer2,
} from "lucide-react";
import GraphVisualization from "../components/GraphVisualization";
import type { GraphData, GraphNode } from "../api/types";

/* ════════════════════════════════════════════════════════
   ONE BIG KNOWLEDGE GRAPH — all people, companies, schools,
   events, locations from Silicon Valley / Sports / Music.
   Click any two people to find the shortest path between them.
   ════════════════════════════════════════════════════════ */

const BIG_GRAPH: GraphData = {
  nodes: [
    // ── Tech people ──
    { id: "sam", name: "Sam Altman", val: 7, color: "", occupations: ["CEO of OpenAI"], image_url: null, node_type: "person", description: "CEO of OpenAI, former president of Y Combinator" },
    { id: "mark", name: "Mark Zuckerberg", val: 7, color: "", occupations: ["CEO of Meta"], image_url: null, node_type: "person", description: "Co-founder and CEO of Meta Platforms" },
    { id: "elon", name: "Elon Musk", val: 7, color: "", occupations: ["CEO of Tesla", "CEO of SpaceX"], image_url: null, node_type: "person", description: "CEO of Tesla/SpaceX, co-founded OpenAI" },
    { id: "peter", name: "Peter Thiel", val: 5, color: "", occupations: ["Investor"], image_url: null, node_type: "person", description: "PayPal co-founder, first Facebook investor" },
    { id: "reid", name: "Reid Hoffman", val: 5, color: "", occupations: ["Investor"], image_url: null, node_type: "person", description: "LinkedIn co-founder, OpenAI board" },
    { id: "dustin", name: "Dustin Moskovitz", val: 4, color: "", occupations: ["CEO of Asana"], image_url: null, node_type: "person", description: "Facebook co-founder" },
    { id: "satya", name: "Satya Nadella", val: 5, color: "", occupations: ["CEO of Microsoft"], image_url: null, node_type: "person", description: "CEO of Microsoft" },
    { id: "sheryl", name: "Sheryl Sandberg", val: 4, color: "", occupations: ["Executive"], image_url: null, node_type: "person", description: "Former COO of Meta" },
    { id: "yann", name: "Yann LeCun", val: 4, color: "", occupations: ["AI Researcher"], image_url: null, node_type: "person", description: "Chief AI Scientist at Meta" },
    { id: "greg", name: "Greg Brockman", val: 4, color: "", occupations: ["President of OpenAI"], image_url: null, node_type: "person", description: "OpenAI co-founder & president" },
    { id: "paul", name: "Paul Graham", val: 4, color: "", occupations: ["Investor"], image_url: null, node_type: "person", description: "Y Combinator co-founder" },
    { id: "jensen", name: "Jensen Huang", val: 5, color: "", occupations: ["CEO of NVIDIA"], image_url: null, node_type: "person", description: "CEO of NVIDIA" },
    { id: "sundar", name: "Sundar Pichai", val: 5, color: "", occupations: ["CEO of Google"], image_url: null, node_type: "person", description: "CEO of Google/Alphabet" },
    { id: "tim", name: "Tim Cook", val: 5, color: "", occupations: ["CEO of Apple"], image_url: null, node_type: "person", description: "CEO of Apple" },
    { id: "beckham", name: "David Beckham", val: 4, color: "", occupations: ["Former Footballer"], image_url: null, node_type: "person", description: "Former Real Madrid, Inter Miami co-owner" },
    // ── Sports / Entertainment ──
    { id: "taylor", name: "Taylor Swift", val: 6, color: "", occupations: ["Singer"], image_url: null, node_type: "person", description: "14x Grammy winner" },
    { id: "travis", name: "Travis Kelce", val: 5, color: "", occupations: ["NFL Player"], image_url: null, node_type: "person", description: "Chiefs tight end" },
    { id: "patrick", name: "Patrick Mahomes", val: 5, color: "", occupations: ["NFL Quarterback"], image_url: null, node_type: "person", description: "Chiefs QB, 3x Super Bowl MVP" },
    { id: "cr7", name: "Cristiano Ronaldo", val: 6, color: "", occupations: ["Footballer"], image_url: null, node_type: "person", description: "5x Ballon d'Or winner" },
    { id: "messi", name: "Lionel Messi", val: 6, color: "", occupations: ["Footballer"], image_url: null, node_type: "person", description: "8x Ballon d'Or winner" },
    { id: "neymar", name: "Neymar Jr", val: 4, color: "", occupations: ["Footballer"], image_url: null, node_type: "person", description: "Brazilian forward" },
    { id: "mbappe", name: "Kylian Mbappé", val: 5, color: "", occupations: ["Footballer"], image_url: null, node_type: "person", description: "French forward, now at Real Madrid" },
    { id: "lebron", name: "LeBron James", val: 5, color: "", occupations: ["NBA Player"], image_url: null, node_type: "person", description: "4x NBA champion, LA Lakers" },

    // ── Companies ──
    { id: "openai", name: "OpenAI", val: 6, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Creator of ChatGPT" },
    { id: "meta", name: "Meta", val: 6, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Facebook, Instagram, WhatsApp" },
    { id: "microsoft", name: "Microsoft", val: 6, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "$13B investor in OpenAI" },
    { id: "google", name: "Google", val: 6, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Search, Android, DeepMind" },
    { id: "apple", name: "Apple", val: 6, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "iPhone, Mac, Apple Intelligence" },
    { id: "nvidia", name: "NVIDIA", val: 5, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "GPU maker powering AI" },
    { id: "tesla_co", name: "Tesla", val: 5, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Electric vehicles" },
    { id: "yc", name: "Y Combinator", val: 4, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Startup accelerator" },
    { id: "paypal", name: "PayPal", val: 4, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "PayPal Mafia origin" },
    { id: "linkedin", name: "LinkedIn", val: 3, color: "#f59e0b", occupations: [], image_url: null, node_type: "company", description: "Professional network" },

    // ── Teams ──
    { id: "chiefs", name: "Kansas City Chiefs", val: 5, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "NFL dynasty" },
    { id: "lakers", name: "LA Lakers", val: 4, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "NBA franchise" },
    { id: "real", name: "Real Madrid", val: 6, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "15x Champions League" },
    { id: "barca", name: "FC Barcelona", val: 6, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "Messi's boyhood club" },
    { id: "psg", name: "PSG", val: 4, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "Paris Saint-Germain" },
    { id: "miami", name: "Inter Miami", val: 4, color: "#10b981", occupations: [], image_url: null, node_type: "team", description: "MLS club" },

    // ── Schools ──
    { id: "harvard", name: "Harvard", val: 5, color: "#3b82f6", occupations: [], image_url: null, node_type: "school", description: "Where Facebook started" },
    { id: "stanford", name: "Stanford", val: 5, color: "#3b82f6", occupations: [], image_url: null, node_type: "school", description: "Silicon Valley's university" },

    // ── Locations ──
    { id: "sf", name: "San Francisco", val: 3, color: "#8b5cf6", occupations: [], image_url: null, node_type: "location" },
    { id: "la", name: "Los Angeles", val: 3, color: "#8b5cf6", occupations: [], image_url: null, node_type: "location" },
  ],
  links: [
    // Tech connections
    { source: "sam", target: "openai", relationship_type: "CEO", strength: 1, description: "" },
    { source: "sam", target: "yc", relationship_type: "former president", strength: 0.8, description: "" },
    { source: "sam", target: "stanford", relationship_type: "attended", strength: 0.6, description: "" },
    { source: "sam", target: "elon", relationship_type: "co-founded OpenAI", strength: 0.7, description: "" },
    { source: "sam", target: "sf", relationship_type: "based in", strength: 0.3, description: "" },
    { source: "mark", target: "meta", relationship_type: "CEO", strength: 1, description: "" },
    { source: "mark", target: "harvard", relationship_type: "attended", strength: 0.7, description: "" },
    { source: "mark", target: "dustin", relationship_type: "co-founded Facebook", strength: 0.8, description: "" },
    { source: "elon", target: "tesla_co", relationship_type: "CEO", strength: 1, description: "" },
    { source: "elon", target: "openai", relationship_type: "co-founded", strength: 0.6, description: "" },
    { source: "elon", target: "paypal", relationship_type: "co-founded", strength: 0.7, description: "" },
    { source: "elon", target: "peter", relationship_type: "PayPal Mafia", strength: 0.6, description: "" },
    { source: "peter", target: "meta", relationship_type: "first investor", strength: 0.9, description: "" },
    { source: "peter", target: "paypal", relationship_type: "co-founded", strength: 0.8, description: "" },
    { source: "peter", target: "stanford", relationship_type: "attended", strength: 0.5, description: "" },
    { source: "peter", target: "openai", relationship_type: "backer", strength: 0.5, description: "" },
    { source: "reid", target: "openai", relationship_type: "board member", strength: 0.7, description: "" },
    { source: "reid", target: "meta", relationship_type: "early advisor", strength: 0.5, description: "" },
    { source: "reid", target: "linkedin", relationship_type: "co-founded", strength: 0.9, description: "" },
    { source: "reid", target: "paypal", relationship_type: "worked at", strength: 0.6, description: "" },
    { source: "reid", target: "stanford", relationship_type: "attended", strength: 0.4, description: "" },
    { source: "dustin", target: "meta", relationship_type: "co-founded", strength: 0.9, description: "" },
    { source: "dustin", target: "openai", relationship_type: "donor", strength: 0.4, description: "" },
    { source: "dustin", target: "harvard", relationship_type: "attended", strength: 0.6, description: "" },
    { source: "satya", target: "microsoft", relationship_type: "CEO", strength: 1, description: "" },
    { source: "microsoft", target: "openai", relationship_type: "invested $13B", strength: 0.95, description: "" },
    { source: "microsoft", target: "linkedin", relationship_type: "acquired", strength: 0.7, description: "" },
    { source: "sheryl", target: "meta", relationship_type: "former COO", strength: 0.9, description: "" },
    { source: "sheryl", target: "harvard", relationship_type: "attended", strength: 0.6, description: "" },
    { source: "yann", target: "meta", relationship_type: "Chief AI Scientist", strength: 0.9, description: "" },
    { source: "greg", target: "openai", relationship_type: "President", strength: 0.9, description: "" },
    { source: "paul", target: "yc", relationship_type: "co-founded", strength: 0.9, description: "" },
    { source: "paul", target: "sam", relationship_type: "mentored", strength: 0.7, description: "" },
    { source: "jensen", target: "nvidia", relationship_type: "CEO", strength: 1, description: "" },
    { source: "nvidia", target: "openai", relationship_type: "GPU supplier", strength: 0.6, description: "" },
    { source: "nvidia", target: "meta", relationship_type: "GPU supplier", strength: 0.5, description: "" },
    { source: "nvidia", target: "google", relationship_type: "GPU supplier", strength: 0.5, description: "" },
    { source: "sundar", target: "google", relationship_type: "CEO", strength: 1, description: "" },
    { source: "sundar", target: "stanford", relationship_type: "attended", strength: 0.5, description: "" },
    { source: "tim", target: "apple", relationship_type: "CEO", strength: 1, description: "" },
    { source: "apple", target: "la", relationship_type: "offices", strength: 0.3, description: "" },
    { source: "google", target: "sf", relationship_type: "HQ nearby", strength: 0.4, description: "" },
    { source: "openai", target: "sf", relationship_type: "HQ", strength: 0.4, description: "" },
    // Sports
    { source: "taylor", target: "travis", relationship_type: "dating", strength: 1, description: "" },
    { source: "travis", target: "chiefs", relationship_type: "plays for", strength: 1, description: "" },
    { source: "patrick", target: "chiefs", relationship_type: "plays for", strength: 1, description: "" },
    { source: "travis", target: "patrick", relationship_type: "teammate", strength: 0.8, description: "" },
    { source: "cr7", target: "real", relationship_type: "played for", strength: 0.9, description: "" },
    { source: "messi", target: "barca", relationship_type: "played for", strength: 0.95, description: "" },
    { source: "messi", target: "psg", relationship_type: "played for", strength: 0.6, description: "" },
    { source: "messi", target: "miami", relationship_type: "plays for", strength: 0.8, description: "" },
    { source: "neymar", target: "barca", relationship_type: "played for", strength: 0.7, description: "" },
    { source: "neymar", target: "psg", relationship_type: "played for", strength: 0.7, description: "" },
    { source: "neymar", target: "messi", relationship_type: "teammate", strength: 0.7, description: "" },
    { source: "mbappe", target: "psg", relationship_type: "played for", strength: 0.8, description: "" },
    { source: "mbappe", target: "real", relationship_type: "plays for", strength: 0.9, description: "" },
    { source: "mbappe", target: "messi", relationship_type: "former teammate", strength: 0.5, description: "" },
    { source: "beckham", target: "real", relationship_type: "played for", strength: 0.7, description: "" },
    { source: "beckham", target: "miami", relationship_type: "co-owner", strength: 0.9, description: "" },
    { source: "lebron", target: "lakers", relationship_type: "plays for", strength: 1, description: "" },
    { source: "lebron", target: "la", relationship_type: "based in", strength: 0.4, description: "" },
    // Cross-domain bridges
    { source: "taylor", target: "la", relationship_type: "performs in", strength: 0.3, description: "" },
    { source: "elon", target: "la", relationship_type: "SpaceX HQ", strength: 0.3, description: "" },
    { source: "chiefs", target: "apple", relationship_type: "NFL on Apple TV", strength: 0.3, description: "" },
    { source: "mark", target: "sf", relationship_type: "offices", strength: 0.3, description: "" },
  ],
};

/* ════════════════════════════════════════════════════════
   BFS shortest path on the graph
   ════════════════════════════════════════════════════════ */
function findShortestPath(graph: GraphData, startId: string, endId: string): string[] | null {
  const adj: Record<string, Set<string>> = {};
  for (const n of graph.nodes) {
    adj[String(n.id)] = new Set();
  }
  for (const l of graph.links) {
    const s = String(l.source);
    const t = String(l.target);
    adj[s]?.add(t);
    adj[t]?.add(s);
  }

  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    if (current === endId) return path;

    for (const neighbor of adj[current] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════════════════
   Profile sidebar data
   ════════════════════════════════════════════════════════ */
const PROFILES: Record<string, { type: string; details: { label: string; value: string }[] }> = {
  sam: { type: "person", details: [{ label: "Born", value: "Apr 22, 1985" }, { label: "Education", value: "Stanford (dropped out)" }, { label: "Role", value: "CEO of OpenAI" }] },
  mark: { type: "person", details: [{ label: "Born", value: "May 14, 1984" }, { label: "Education", value: "Harvard (dropped out)" }, { label: "Role", value: "CEO of Meta" }] },
  elon: { type: "person", details: [{ label: "Born", value: "Jun 28, 1971" }, { label: "Education", value: "Penn, Stanford (dropped out)" }, { label: "Companies", value: "Tesla, SpaceX, X" }] },
  peter: { type: "person", details: [{ label: "Born", value: "Oct 11, 1967" }, { label: "Education", value: "Stanford" }, { label: "Key", value: "First FB investor + PayPal" }] },
  reid: { type: "person", details: [{ label: "Born", value: "Aug 5, 1967" }, { label: "Education", value: "Stanford" }, { label: "Key", value: "LinkedIn + OpenAI board" }] },
  taylor: { type: "person", details: [{ label: "Born", value: "Dec 13, 1989" }, { label: "From", value: "West Reading, PA" }, { label: "Awards", value: "14x Grammy winner" }] },
  travis: { type: "person", details: [{ label: "Born", value: "Oct 5, 1989" }, { label: "College", value: "Univ. of Cincinnati" }, { label: "Team", value: "Kansas City Chiefs" }] },
  cr7: { type: "person", details: [{ label: "Born", value: "Feb 5, 1985" }, { label: "From", value: "Funchal, Portugal" }, { label: "Goals", value: "900+ career goals" }] },
  messi: { type: "person", details: [{ label: "Born", value: "Jun 24, 1987" }, { label: "From", value: "Rosario, Argentina" }, { label: "Awards", value: "8x Ballon d'Or" }] },
  lebron: { type: "person", details: [{ label: "Born", value: "Dec 30, 1984" }, { label: "From", value: "Akron, Ohio" }, { label: "Titles", value: "4x NBA Champion" }] },
  jensen: { type: "person", details: [{ label: "Born", value: "Feb 17, 1963" }, { label: "Education", value: "Oregon State, Stanford" }, { label: "Role", value: "CEO of NVIDIA" }] },
  sundar: { type: "person", details: [{ label: "Born", value: "Jun 10, 1972" }, { label: "Education", value: "Stanford, IIT Kharagpur" }, { label: "Role", value: "CEO of Google" }] },
  openai: { type: "company", details: [{ label: "Founded", value: "2015" }, { label: "HQ", value: "San Francisco" }, { label: "Valuation", value: "$157B (2024)" }] },
  meta: { type: "company", details: [{ label: "Founded", value: "2004 (as Facebook)" }, { label: "HQ", value: "Menlo Park" }, { label: "Users", value: "3.9B monthly" }] },
  microsoft: { type: "company", details: [{ label: "Founded", value: "1975" }, { label: "HQ", value: "Redmond, WA" }, { label: "OpenAI", value: "$13B invested" }] },
  harvard: { type: "school", details: [{ label: "Founded", value: "1636" }, { label: "Location", value: "Cambridge, MA" }, { label: "Notable", value: "Zuckerberg, Gates, Obama" }] },
  stanford: { type: "school", details: [{ label: "Founded", value: "1885" }, { label: "Location", value: "Palo Alto, CA" }, { label: "Notable", value: "Google, HP, Altman, Thiel" }] },
  real: { type: "team", details: [{ label: "Founded", value: "1902" }, { label: "Stadium", value: "Santiago Bernabéu" }, { label: "UCL Titles", value: "15 (record)" }] },
  barca: { type: "team", details: [{ label: "Founded", value: "1899" }, { label: "Stadium", value: "Camp Nou" }, { label: "Messi Years", value: "2000-2021" }] },
  chiefs: { type: "team", details: [{ label: "Founded", value: "1960" }, { label: "Stadium", value: "Arrowhead" }, { label: "Super Bowls", value: "4 wins" }] },
};

const TYPE_ICONS: Record<string, any> = {
  person: User, company: Building2, school: GraduationCap,
  team: Building2, location: MapPin, event: Calendar,
};
const TYPE_COLORS: Record<string, string> = {
  person: "text-cyan", company: "text-yellow", school: "text-blue-400",
  team: "text-green", location: "text-purple", event: "text-pink-400",
};

/* ════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════ */
export default function HistoryPage() {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);

  const path = useMemo(() => {
    if (!selectedA || !selectedB || selectedA === selectedB) return null;
    return findShortestPath(BIG_GRAPH, selectedA, selectedB);
  }, [selectedA, selectedB]);

  const highlightIds = path ?? (selectedA ? [selectedA] : []);

  const handleNodeClick = useCallback((nodeId: string | number) => {
    const id = String(nodeId);
    // Only allow selecting person nodes
    const node = BIG_GRAPH.nodes.find((n) => String(n.id) === id);
    if (!node || node.node_type !== "person") return;

    if (!selectedA) {
      setSelectedA(id);
    } else if (!selectedB && id !== selectedA) {
      setSelectedB(id);
    } else {
      // Reset and start new selection
      setSelectedA(id);
      setSelectedB(null);
    }
  }, [selectedA, selectedB]);

  const nodeA = BIG_GRAPH.nodes.find((n) => String(n.id) === selectedA);
  const nodeB = BIG_GRAPH.nodes.find((n) => String(n.id) === selectedB);

  // Build path description
  const pathDescription = useMemo(() => {
    if (!path || path.length < 2) return null;
    return path.map((id) => {
      const node = BIG_GRAPH.nodes.find((n) => String(n.id) === id);
      return node?.name ?? id;
    }).join(" → ");
  }, [path]);

  // Get profile for selected nodes
  const profileA = selectedA ? PROFILES[selectedA] : null;
  const profileB = selectedB ? PROFILES[selectedB] : null;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="pointer-events-none fixed inset-0 bg-dot-grid" />

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <History className="h-6 w-6 text-cyan" />
              <h1 className="text-2xl font-bold">Knowledge Graph Explorer</h1>
            </div>
            <p className="text-text-muted text-sm">
              Click any two people to find how they're connected
            </p>
          </div>

          {/* Selection status */}
          <div className="flex items-center gap-3">
            {selectedA ? (
              <button
                onClick={() => { setSelectedA(null); setSelectedB(null); }}
                className="flex items-center gap-2 rounded-lg bg-cyan/10 border border-cyan/20 px-3 py-1.5 text-sm text-cyan"
              >
                <span className="font-semibold">{nodeA?.name}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <MousePointer2 className="h-4 w-4" />
                Click a person...
              </div>
            )}

            {selectedA && !selectedB && (
              <span className="text-text-muted text-sm">→ click another person</span>
            )}

            {selectedB && (
              <>
                <span className="text-text-muted">→</span>
                <button
                  onClick={() => setSelectedB(null)}
                  className="flex items-center gap-2 rounded-lg bg-purple/10 border border-purple/20 px-3 py-1.5 text-sm text-purple"
                >
                  <span className="font-semibold">{nodeB?.name}</span>
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connection result */}
        {path && path.length > 1 && (
          <div className="glass-card-strong rounded-xl px-6 py-4 border-l-4 border-cyan mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-cyan" />
              <span className="text-sm font-bold text-cyan">
                Connected in {path.length - 1} degree{path.length - 1 !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-text font-mono text-sm">{pathDescription}</p>
          </div>
        )}

        {selectedA && selectedB && !path && (
          <div className="glass-card rounded-xl px-6 py-4 text-text-muted text-sm mb-6">
            No path found between {nodeA?.name} and {nodeB?.name}
          </div>
        )}

        {/* Main layout: graph + sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Graph */}
          <GraphVisualization
            data={BIG_GRAPH}
            highlightPath={highlightIds}
            height={700}
            onPersonClick={handleNodeClick}
          />

          {/* Sidebar: profiles */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              {selectedA || selectedB ? "Selected Profiles" : "Select people on the graph"}
            </h3>

            {[
              { node: nodeA, profile: profileA, accent: "cyan" as const },
              { node: nodeB, profile: profileB, accent: "purple" as const },
            ].map(({ node, profile, accent }) =>
              node ? (
                <ProfileCard key={String(node.id)} node={node} profile={profile} accent={accent} />
              ) : null
            )}

            {/* Path breakdown */}
            {path && path.length > 2 && (
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">
                  Path Breakdown
                </h4>
                <div className="space-y-2">
                  {path.map((id, i) => {
                    const node = BIG_GRAPH.nodes.find((n) => String(n.id) === id);
                    if (!node) return null;
                    const Icon = TYPE_ICONS[node.node_type] || User;
                    const color = TYPE_COLORS[node.node_type] || "text-text-muted";
                    // Find the edge to next node
                    let edgeLabel = "";
                    if (i < path.length - 1) {
                      const nextId = path[i + 1];
                      const edge = BIG_GRAPH.links.find(
                        (l) =>
                          (String(l.source) === id && String(l.target) === nextId) ||
                          (String(l.target) === id && String(l.source) === nextId)
                      );
                      edgeLabel = edge?.relationship_type || "connected";
                    }
                    return (
                      <div key={id}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                          <span className="text-sm text-text font-medium">{node.name}</span>
                          <span className={`text-[10px] ${color} uppercase`}>{node.node_type}</span>
                        </div>
                        {edgeLabel && (
                          <div className="ml-[22px] border-l border-white/10 pl-3 py-1 text-[11px] text-text-muted">
                            ↓ {edgeLabel}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Profile card ── */
function ProfileCard({
  node, profile, accent,
}: {
  node: GraphNode;
  profile: { type: string; details: { label: string; value: string }[] } | null;
  accent: "cyan" | "purple";
}) {
  const Icon = TYPE_ICONS[node.node_type] || User;
  const border = accent === "cyan" ? "border-cyan/20" : "border-purple/20";
  const accentColor = accent === "cyan" ? "text-cyan" : "text-purple";
  const accentBg = accent === "cyan" ? "bg-cyan/10" : "bg-purple/10";

  return (
    <div className={`glass-card rounded-xl overflow-hidden border ${border}`}>
      <div className={`px-4 py-2 ${accentBg} flex items-center gap-2`}>
        <Icon className={`h-3.5 w-3.5 ${accentColor}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>
          {node.node_type}
        </span>
      </div>
      <div className="px-4 py-3">
        <h4 className="font-bold text-text">{node.name}</h4>
        {node.description && (
          <p className="text-xs text-text-muted mt-1">{node.description}</p>
        )}
        {node.occupations && node.occupations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {node.occupations.map((o) => (
              <span key={o} className={`rounded-md px-1.5 py-0.5 text-[10px] ${accentBg} ${accentColor}`}>
                {o}
              </span>
            ))}
          </div>
        )}
        {profile && (
          <div className="mt-3 space-y-1.5">
            {profile.details.map((d) => (
              <div key={d.label} className="text-xs">
                <span className="text-text-muted">{d.label}: </span>
                <span className="text-text">{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
