import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph, GraphEdge, GraphNode } from "../api";

const COL_W = 250;
const ROW_H = 84;
const NODE_W = 168;
const NODE_H = 50;

const CONF_COLOR: Record<string, string> = {
  high: "#0a9d7d",
  medium: "#c08400",
};

const CONF_RU: Record<string, string> = {
  high: "высокая",
  medium: "средняя",
};

// Only high/medium exist; map any legacy value to a safe key.
const confKey = (c: string) => (c === "high" ? "high" : "medium");

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
  const movedRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<{ edge: GraphEdge; x: number; y: number } | null>(null);

  const positioned = useMemo(() => layout(graph.nodes), [graph]);

  // Bounding box of all nodes (graph coordinates), used to keep the graph
  // from ever being panned/zoomed completely out of view.
  const bounds = useMemo(() => {
    const vals = [...positioned.values()];
    if (!vals.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const xs = vals.map((n) => n.x);
    const ys = vals.map((n) => n.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [positioned]);

  // Clamp a transform: enforce finite values, a sane zoom range, and that at
  // least a margin of the graph stays inside the viewport. This is what makes
  // the graph impossible to "lose" while panning.
  const clampT = (tr: { x: number; y: number; k: number }) => {
    let { x, y, k } = tr;
    if (!Number.isFinite(k) || k <= 0) k = 1;
    k = Math.min(2.5, Math.max(0.25, k));
    if (!Number.isFinite(x)) x = size.w / 2;
    if (!Number.isFinite(y)) y = size.h / 2;
    const m = 140;
    const a = m - (bounds.maxX + NODE_W / 2) * k;
    const b = size.w - m - (bounds.minX - NODE_W / 2) * k;
    const c = m - (bounds.maxY + NODE_H / 2) * k;
    const d = size.h - m - (bounds.minY - NODE_H / 2) * k;
    x = Math.min(Math.max(x, Math.min(a, b)), Math.max(a, b));
    y = Math.min(Math.max(y, Math.min(c, d)), Math.max(c, d));
    return { x, y, k };
  };

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
    setT(clampT({ x: size.w / 2, y: size.h / 2, k: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.focus.slug, size.w, size.h]);

  // Pan via window listeners so a fast/outside mouse-up is never lost.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      // Button released but the up event was missed → stop panning.
      if ((e.buttons & 1) === 0) {
        drag.current = null;
        setGrabbing(false);
        return;
      }
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.hypot(dx, dy) > 4) movedRef.current = true;
      setT((prev) => clampT({ ...prev, x: drag.current!.tx + dx, y: drag.current!.ty + dy }));
    };
    const onUp = () => {
      drag.current = null;
      setGrabbing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size.w, size.h]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const k = Math.min(2.5, Math.max(0.25, t.k * factor));
    const gx = (mx - t.x) / t.k;
    const gy = (my - t.y) / t.k;
    setT(clampT({ k, x: mx - gx * k, y: my - gy * k }));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Prevent native text/element drag which can hijack the mouse-up.
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    movedRef.current = false;
    setGrabbing(true);
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
            const c = CONF_COLOR[confKey(e.confidence)];
            return (
              <path
                key={e.id}
                d={p.d}
                fill="none"
                stroke={c}
                strokeWidth={hoverEdge?.edge.id === e.id ? 3.4 : 1.7}
                strokeOpacity={hoverEdge && hoverEdge.edge.id !== e.id ? 0.25 : 0.8}
                markerEnd={`url(#arrow-${confKey(e.confidence)})`}
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
                  // Ignore the click that ends a pan drag.
                  if (movedRef.current) return;
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
          <span className={`pill ${confKey(hoverEdge.edge.confidence)}`}>
            надёжность источника: {CONF_RU[confKey(hoverEdge.edge.confidence)]} · {hoverEdge.edge.sourceCount} источн.
          </span>
        </div>
      )}
    </div>
  );
}
