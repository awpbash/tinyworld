import { useCallback, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2 } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode, GraphLink } from "../api/types";

interface Props {
  data: GraphData;
  highlightPath?: (number | string)[];
  width?: number;
  height?: number;
  onPersonClick?: (nodeId: string | number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  entertainment: "#a855f7",
  sports: "#06b6d4",
  politics: "#ef4444",
  science: "#22c55e",
  business: "#eab308",
  music: "#f97316",
  default: "#64748b",
};

const ENTITY_COLORS: Record<string, string> = {
  school: "#3b82f6",
  company: "#f59e0b",
  team: "#10b981",
  event: "#ec4899",
  location: "#8b5cf6",
};

function guessCategory(occupations: string[]): string {
  const joined = (occupations ?? []).join(" ").toLowerCase();
  if (/actor|actress|director|film|television|comedian/.test(joined))
    return "entertainment";
  if (/athlete|player|driver|sport|football|basketball|tennis|racing/.test(joined))
    return "sports";
  if (/politic|president|minister|senator|governor/.test(joined))
    return "politics";
  if (/scien|physic|chemist|biolog|research|engineer/.test(joined))
    return "science";
  if (/business|ceo|entrepreneur|investor|executive/.test(joined))
    return "business";
  if (/singer|musician|rapper|composer|band|dj/.test(joined)) return "music";
  return "default";
}

function getNodeColor(node: GraphNode): string {
  if (node.node_type && node.node_type !== "person") {
    return ENTITY_COLORS[node.node_type] || CATEGORY_COLORS.default;
  }
  return node.color || CATEGORY_COLORS[guessCategory(node.occupations)] || CATEGORY_COLORS.default;
}

function isEntityNode(node: GraphNode): boolean {
  return !!node.node_type && node.node_type !== "person";
}

/* ── Shape drawing helpers ────────────────────────── */

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawPentagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const spikes = 5;
  const outerR = r;
  const innerR = r * 0.5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.866, y + r * 0.5);
  ctx.lineTo(x - r * 0.866, y + r * 0.5);
  ctx.closePath();
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  nodeType: string,
  x: number,
  y: number,
  r: number
) {
  switch (nodeType) {
    case "company":
      drawDiamond(ctx, x, y, r);
      break;
    case "school":
      drawHexagon(ctx, x, y, r);
      break;
    case "team":
      drawPentagon(ctx, x, y, r);
      break;
    case "event":
      drawStar(ctx, x, y, r);
      break;
    case "location":
      drawTriangle(ctx, x, y, r);
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      break;
  }
}

export default function GraphVisualization({
  data,
  highlightPath = [],
  width,
  height,
  onPersonClick,
}: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: width ?? 800, h: height ?? 500 });
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  const highlightSet = new Set(highlightPath);

  useEffect(() => {
    if (width && height) {
      setDims({ w: width, h: height });
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect;
      setDims({ w, h: Math.max(h, 400) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  // Tune force simulation once mounted for a clean, stable layout
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const nodeCount = data.nodes.length;

    // Scale forces based on graph size
    const charge = nodeCount > 30 ? -400 : nodeCount > 15 ? -300 : -200;
    const maxDist = nodeCount > 30 ? 600 : 400;
    const linkDistPP = nodeCount > 30 ? 160 : 120;
    const linkDistPE = nodeCount > 30 ? 100 : 70;

    fg.d3Force("charge")?.strength(charge).distanceMax(maxDist);
    fg.d3Force("link")?.distance((link: any) => {
      const s = typeof link.source === "object" ? link.source : null;
      const t = typeof link.target === "object" ? link.target : null;
      if (s?.node_type === "person" && t?.node_type === "person") return linkDistPP;
      return linkDistPE;
    });
    fg.d3Force("center")?.strength(0.05);

    fg.d3ReheatSimulation();
    setTimeout(() => fg.zoomToFit(600, 60), 2500);
  }, [data]);

  // Enrich nodes with colors
  const enriched = {
    nodes: data.nodes.map((n) => ({
      ...n,
      color: getNodeColor(n),
    })),
    links: data.links.map((l) => ({ ...l })),
  };

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const entity = isEntityNode(node);
      const baseR = Math.max(4, (node.val || 1) * 2 + 4);
      const r = entity ? baseR * 0.75 : baseR;
      const isHighlighted = highlightSet.has(node.id);
      const isHovered = hoverNode?.id === node.id;

      // Glow
      if (isHighlighted || isHovered) {
        if (entity && node.node_type !== "person") {
          drawNodeShape(ctx, node.node_type, node.x, node.y, r + 6);
        } else {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
        }
        ctx.fillStyle = isHighlighted
          ? "rgba(6, 182, 212, 0.25)"
          : "rgba(168, 85, 247, 0.2)";
        ctx.fill();
      }

      // Node shape
      if (entity) {
        drawNodeShape(ctx, node.node_type, node.x, node.y, r);
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      }
      ctx.fillStyle = isHighlighted ? "#06b6d4" : node.color;
      ctx.fill();

      // Border
      ctx.strokeStyle = isHighlighted
        ? "#06b6d4"
        : isHovered
        ? "#a855f7"
        : "rgba(255,255,255,0.1)";
      ctx.lineWidth = isHighlighted || isHovered ? 2 : 0.5;
      ctx.stroke();

      // Label — only show when zoomed in enough or node is highlighted/hovered
      const showLabel = globalScale > 0.8 || isHighlighted || isHovered;
      if (showLabel) {
        const fontSize = Math.max(10, 12 / globalScale);
        const fontStyle = entity ? "italic " : "";
        ctx.font = `${fontStyle}${isHighlighted ? "bold " : ""}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHighlighted
          ? "#06b6d4"
          : isHovered
          ? "#e2e8f0"
          : entity
          ? "rgba(226, 232, 240, 0.35)"
          : "rgba(226, 232, 240, 0.55)";
        ctx.fillText(node.name, node.x, node.y + r + 3);
      }
    },
    [hoverNode, highlightSet]
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      const isHighlighted =
        highlightSet.has(sourceId) && highlightSet.has(targetId);

      const src = typeof link.source === "object" ? link.source : null;
      const tgt = typeof link.target === "object" ? link.target : null;
      if (!src || !tgt) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isHighlighted
        ? "rgba(6, 182, 212, 0.6)"
        : `rgba(148, 163, 184, ${0.05 + (link.strength ?? 0.5) * 0.15})`;
      ctx.lineWidth = isHighlighted ? 2.5 : 0.8;
      ctx.stroke();

      // Label on highlighted links
      if (isHighlighted && link.relationship_type) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
        ctx.fillText(link.relationship_type, mx, my - 4);
      }
    },
    [highlightSet]
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      if (onPersonClick) {
        onPersonClick(node.id);
        return;
      }
      // Default: navigate for person nodes with numeric IDs
      if (!isEntityNode(node) && typeof node.id === "number") {
        navigate(`/profile/${node.id}`);
      }
    },
    [navigate, onPersonClick]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg border border-white/5 bg-bg-surface overflow-hidden"
      style={{ minHeight: 400 }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={enriched}
        width={dims.w}
        height={dims.h}
        backgroundColor="#111119"
        nodeRelSize={6}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHoverNode(node)}
        onNodeDragEnd={(node: any) => {
          // Pin dragged node in place
          node.fx = node.x;
          node.fy = node.y;
        }}
        cooldownTicks={200}
        cooldownTime={4000}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.5}
        warmupTicks={80}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.5}
        maxZoom={6}
      />

      {/* Zoom to fit button */}
      <button
        onClick={() => {
          if (fgRef.current) {
            fgRef.current.zoomToFit(400, 40);
          }
        }}
        className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-bg-surface/90 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-text-muted hover:text-text hover:border-cyan/30 transition-all cursor-pointer"
        title="Zoom to fit"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit
      </button>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 rounded-lg bg-bg-surface/80 backdrop-blur-sm border border-white/10 px-3 py-2.5 text-[10px]">
        <div className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1.5">
          Legend
        </div>
        <div className="flex flex-col gap-1">
          {([
            ["Person", "#64748b", "circle"],
            ["School", "#3b82f6", "hexagon"],
            ["Company", "#f59e0b", "diamond"],
            ["Team", "#10b981", "pentagon"],
            ["Event", "#ec4899", "star"],
            ["Location", "#8b5cf6", "triangle"],
          ] as const).map(([label, color, shape]) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14">
                {shape === "circle" && (
                  <circle cx="7" cy="7" r="5" fill={color} opacity="0.8" />
                )}
                {shape === "hexagon" && (
                  <polygon
                    points="7,1.5 12,4.25 12,9.75 7,12.5 2,9.75 2,4.25"
                    fill={color}
                    opacity="0.8"
                  />
                )}
                {shape === "diamond" && (
                  <polygon
                    points="7,1 13,7 7,13 1,7"
                    fill={color}
                    opacity="0.8"
                  />
                )}
                {shape === "pentagon" && (
                  <polygon
                    points="7,1.5 12.5,5.5 10.5,12 3.5,12 1.5,5.5"
                    fill={color}
                    opacity="0.8"
                  />
                )}
                {shape === "star" && (
                  <polygon
                    points="7,1 8.5,5 13,5.5 9.5,8.5 10.5,13 7,10.5 3.5,13 4.5,8.5 1,5.5 5.5,5"
                    fill={color}
                    opacity="0.8"
                  />
                )}
                {shape === "triangle" && (
                  <polygon
                    points="7,1.5 13,12.5 1,12.5"
                    fill={color}
                    opacity="0.8"
                  />
                )}
              </svg>
              <span className="text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div className="pointer-events-none absolute left-4 bottom-4 glass-card rounded-lg px-4 py-3 text-sm max-w-xs">
          <div className="font-semibold text-text">{hoverNode.name}</div>
          {isEntityNode(hoverNode) && (
            <div className="mt-1">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${ENTITY_COLORS[hoverNode.node_type] || CATEGORY_COLORS.default}20`,
                  color: ENTITY_COLORS[hoverNode.node_type] || CATEGORY_COLORS.default,
                }}
              >
                {hoverNode.node_type}
              </span>
            </div>
          )}
          {hoverNode.description && (
            <p className="mt-1 text-[11px] text-text-muted leading-snug">
              {hoverNode.description}
            </p>
          )}
          {!isEntityNode(hoverNode) && hoverNode.occupations?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hoverNode.occupations.slice(0, 3).map((o) => (
                <span
                  key={o}
                  className="rounded bg-cyan/10 px-1.5 py-0.5 text-[10px] text-cyan"
                >
                  {o}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 text-[11px] text-text-muted">
            {isEntityNode(hoverNode) ? "Entity node" : "Click to view profile"}
          </div>
        </div>
      )}
    </div>
  );
}
