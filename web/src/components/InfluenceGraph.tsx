import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph, GraphEdge, GraphNode } from "../api";

const COL_W = 250;
const ROW_H = 84;
const NODE_W = 168;
const NODE_H = 50;

const CONF_COLOR: Record<string, string> = {
  high: "#0a9d7d",
  medium: "#c08400",
  low: "#9aa3b5",
};

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

function layout(nodes: GraphNode[]): Map<number, Positioned> {
  const byLevel = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    if (!byLevel.has(n.level)) byLevel.set(n.level, []);
    byLevel.get(n.level)!.push(n);
  }
  const pos = new Map<number, Positioned>();
  for (const [level, group] of byLevel) {
    group.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const n = group.length;
    group.forEach((node, i) => {
      pos.set(node.id, {
        ...node,
        x: level * COL_W,
        y: (i - (n - 1) / 2) * ROW_H,
      });
    });
  }
  return pos;
}

export default function InfluenceGraph({
  graph,
  onSelectNode,
  onOpenArtist,
}: {
  graph: Graph;
  onSelectNode: (slug: string) => void;
  onOpenArtist: (slug: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [t, setT] = useState({ x: 400, y: 300, k: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<{ edge: GraphEdge; x: number; y: number } | null>(null);

  const positioned = useMemo(() => layout(graph.nodes), [graph]);

  // Measure container.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Re-center on focus whenever the graph changes.
  useEffect(() => {
    setT({ x: size.w / 2, y: size.h / 2, k: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.focus.slug, size.w, size.h]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const k = Math.min(2.5, Math.max(0.25, t.k * factor));
    // keep point under cursor stable
    const gx = (mx - t.x) / t.k;
    const gy = (my - t.y) / t.k;
    setT({ k, x: mx - gx * k, y: my - gy * k });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    setGrabbing(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setT((prev) => ({
      ...prev,
      x: drag.current!.tx + (e.clientX - drag.current!.x),
      y: drag.current!.ty + (e.clientY - drag.current!.y),
    }));
  };
  const endDrag = () => {
    drag.current = null;
    setGrabbing(false);
  };

  const edgePath = (e: GraphEdge) => {
    const a = positioned.get(e.from);
    const b = positioned.get(e.to);
    if (!a || !b) return null;
    // from = influenced (descendant), to = root (influence source)
    const x1 = a.x - NODE_W / 2, y1 = a.y;
    const x2 = b.x + NODE_W / 2, y2 = b.y;
    const mx = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, mid: { x: mx, y: (y1 + y2) / 2 } };
  };

  return (
    <div
      className="graph-wrap"
      ref={wrapRef}
      style={{ position: "absolute", inset: 0 }}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <svg
        className={`graph-svg${grabbing ? " grabbing" : ""}`}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <defs>
          {Object.entries(CONF_COLOR).map(([k, c]) => (
            <marker
              key={k}
              id={`arrow-${k}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {graph.edges.map((e) => {
            const p = edgePath(e);
            if (!p) return null;
            const c = CONF_COLOR[e.confidence];
            return (
              <path
                key={e.id}
                d={p.d}
                fill="none"
                stroke={c}
                strokeWidth={hoverEdge?.edge.id === e.id ? 3.4 : 1.7}
                strokeOpacity={hoverEdge && hoverEdge.edge.id !== e.id ? 0.25 : 0.8}
                markerEnd={`url(#arrow-${e.confidence})`}
                style={{ cursor: "help" }}
                onMouseEnter={(ev) => {
                  const rect = wrapRef.current!.getBoundingClientRect();
                  setHoverEdge({ edge: e, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                }}
                onMouseMove={(ev) => {
                  const rect = wrapRef.current!.getBoundingClientRect();
                  setHoverEdge((h) => (h ? { ...h, x: ev.clientX - rect.left, y: ev.clientY - rect.top } : h));
                }}
                onMouseLeave={() => setHoverEdge(null)}
              />
            );
          })}

          {[...positioned.values()].map((n) => {
            const isFocus = n.id === graph.focus.id;
            const roleColor = n.level < 0 ? "#ef7a1a" : n.level > 0 ? "#2f86ff" : "#6b4eff";
            return (
              <g
                key={n.id}
                className="graph-node"
                transform={`translate(${n.x},${n.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isFocus) onSelectNode(n.slug);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenArtist(n.slug);
                }}
              >
                <rect
                  x={-NODE_W / 2}
                  y={-NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={isFocus ? "#efeaff" : "#ffffff"}
                  stroke={roleColor}
                  strokeWidth={isFocus ? 2.6 : 1.4}
                />
                <text
                  x={0}
                  y={-2}
                  textAnchor="middle"
                  fill="#1b2233"
                  fontSize={13}
                  fontWeight={700}
                >
                  {n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name}
                </text>
                <text x={0} y={14} textAnchor="middle" fill="#5f6b85" fontSize={10}>
                  {n.type === "band" ? "группа" : "артист"}
                  {n.activeFrom ? ` · ${n.activeFrom}` : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hoverEdge && (
        <div
          className="edge-tip"
          style={{ left: Math.min(hoverEdge.x + 14, size.w - 320), top: hoverEdge.y + 14 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {positioned.get(hoverEdge.edge.from)?.name} ← {positioned.get(hoverEdge.edge.to)?.name}
          </div>
          <div className="muted" style={{ marginBottom: 6 }}>{hoverEdge.edge.description}</div>
          <span className={`pill ${hoverEdge.edge.confidence}`}>
            {hoverEdge.edge.sourceCount} источн. · {hoverEdge.edge.confidence}
          </span>
        </div>
      )}
    </div>
  );
}
