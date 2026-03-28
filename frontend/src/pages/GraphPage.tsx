import { useEffect, useState } from "react";
import { Network, RefreshCw, Database } from "lucide-react";
import GraphVisualization from "../components/GraphVisualization";
import { getGraph } from "../api/client";
import type { GraphData } from "../api/types";

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = () => {
    setLoading(true);
    setError(null);
    getGraph()
      .then(setGraph)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(fetchGraph, []);

  const personCount = graph?.nodes.filter((n) => n.node_type === "person").length ?? 0;
  const entityCount = graph?.nodes.filter((n) => n.node_type !== "person").length ?? 0;
  const linkCount = graph?.links.length ?? 0;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="pointer-events-none fixed inset-0 bg-dot-grid" />

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Network className="h-6 w-6 text-cyan" />
              <h1 className="text-2xl font-bold">Full Knowledge Graph</h1>
            </div>
            <p className="text-text-muted text-sm">
              Every person, company, school, and connection discovered so far
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats */}
            {graph && (
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  {personCount} people
                </span>
                <span>{entityCount} entities</span>
                <span>{linkCount} connections</span>
              </div>
            )}

            <button
              onClick={fetchGraph}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg glass-card px-3 py-1.5 text-xs font-medium text-text-muted hover:text-cyan hover:border-cyan/30 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && !graph && (
          <div className="flex h-[500px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
              <span className="text-sm text-text-muted">Loading graph...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="glass-card rounded-xl px-6 py-4 text-red text-sm">
            Failed to load graph: {error}
          </div>
        )}

        {graph && graph.nodes.length === 0 && (
          <div className="glass-card rounded-xl px-6 py-8 text-center">
            <Network className="h-12 w-12 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted">
              No data yet. Go to <strong className="text-cyan">Investigate</strong> and search for people to build the graph.
            </p>
          </div>
        )}

        {graph && graph.nodes.length > 0 && (
          <GraphVisualization data={graph} height={Math.max(600, window.innerHeight - 180)} />
        )}
      </div>
    </div>
  );
}
